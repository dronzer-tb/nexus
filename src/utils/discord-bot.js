/**
 * Discord Bot — Sends alerts directly to Discord users via DMs
 * Uses discord.js to maintain a persistent bot connection
 */
const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const logger = require('./logger');
const database = require('./database');

let client = null;
let isReady = false;

// Track dismissed alerts (nodeId:metric -> timestamp)
const dismissedAlerts = new Map();

// Track active tail sessions (userId -> { nodeId, interval })
const tailSessions = new Map();

// Severity colors for embeds
const SEVERITY_COLORS = {
  critical: 0xFF0000,  // Red
  warning: 0xFF9500,   // Orange
  info: 0x00D4AA,      // Cyan
  resolved: 0x22C55E,  // Green
};

const SEVERITY_EMOJI = {
  critical: '🔴',
  warning: '🟠',
  info: '🔵',
  resolved: '🟢',
};

/**
 * Initialize the Discord bot with the stored token
 */
async function init() {
  const token = database.getSetting('discord_bot_token');
  if (!token) {
    logger.info('[Discord] No bot token configured, skipping initialization');
    return false;
  }

  if (client && isReady) {
    logger.info('[Discord] Bot already connected');
    return true;
  }

  try {
    client = new Client({
      intents: [GatewayIntentBits.Guilds, GatewayIntentBits.DirectMessages],
    });

    client.on('ready', () => {
      isReady = true;
      logger.info(`[Discord] Bot connected as ${client.user.tag}`);
    });

    // Handle button interactions (False Alarm / Tail)
    client.on('interactionCreate', async (interaction) => {
      if (!interaction.isButton()) return;

      const { customId } = interaction;

      try {
        if (customId.startsWith('alert_dismiss_')) {
          // False Alarm — dismiss the alert
          const alertKey = customId.replace('alert_dismiss_', '');
          dismissedAlerts.set(alertKey, Date.now());
          
          await interaction.update({
            components: [],
            embeds: interaction.message.embeds.map(e => {
              const embed = EmbedBuilder.from(e);
              embed.setFooter({ text: '✅ Dismissed — False Alarm' });
              embed.setColor(0x666666);
              return embed;
            }),
          });
          logger.info(`[Discord] Alert dismissed: ${alertKey}`);
        } else if (customId.startsWith('alert_tail_')) {
          // Tail — start a live log stream in DMs
          const parts = customId.replace('alert_tail_', '').split(':');
          const nodeId = parts[0];
          const metric = parts[1] || 'cpu';
          const userId = interaction.user.id;

          // Stop existing tail for this user if any
          const existing = tailSessions.get(userId);
          if (existing) {
            clearInterval(existing.interval);
            tailSessions.delete(userId);
          }

          await interaction.update({
            components: [],
            embeds: interaction.message.embeds.map(e => {
              const embed = EmbedBuilder.from(e);
              embed.setFooter({ text: '📡 Tail started — live metrics for 2 minutes' });
              return embed;
            }),
          });

          // Send live metrics every 10 seconds for 2 minutes
          let ticks = 0;
          const maxTicks = 12; // 12 * 10s = 2 minutes

          const sendTail = async () => {
            ticks++;
            try {
              const node = database.getNode(nodeId);
              const metricsRows = database.getLatestMetrics(nodeId, 1);
              const latestMetrics = metricsRows?.[0]?.data || null;

              if (!node || !latestMetrics) {
                await interaction.user.send({
                  content: `\`\`\`\n[TAIL] Node ${nodeId} — No metrics available\n\`\`\``,
                });
                clearInterval(interval);
                tailSessions.delete(userId);
                return;
              }

              const cpu = latestMetrics.cpu?.usage?.toFixed(1) || '—';
              const mem = latestMetrics.memory?.usagePercent?.toFixed(1) || '—';
              const procs = latestMetrics.processes?.list?.slice(0, 5) || [];

              let output = `\`\`\`ansi\n`;
              output += `[TAIL] ${node.hostname || nodeId} — ${new Date().toISOString()}\n`;
              output += `─────────────────────────────────────────\n`;
              output += `CPU: ${cpu}%  │  MEM: ${mem}%  │  Tick ${ticks}/${maxTicks}\n`;
              output += `─────────────────────────────────────────\n`;
              output += `PID     CPU%   MEM%   PROCESS\n`;
              for (const p of procs) {
                const pid = String(p.pid).padEnd(8);
                const pcpu = (p.cpu || 0).toFixed(1).padStart(5);
                const pmem = (p.mem || 0).toFixed(1).padStart(5);
                output += `${pid}${pcpu}  ${pmem}   ${(p.name || '').substring(0, 30)}\n`;
              }
              output += `\`\`\``;

              await interaction.user.send({ content: output });

              if (ticks >= maxTicks) {
                await interaction.user.send({
                  content: `\`\`\`\n[TAIL] Session ended after ${maxTicks * 10}s\n\`\`\``,
                });
                clearInterval(interval);
                tailSessions.delete(userId);
              }
            } catch (err) {
              logger.error(`[Discord] Tail error:`, err.message);
              clearInterval(interval);
              tailSessions.delete(userId);
            }
          };

          // Send first update immediately
          await sendTail();
          const interval = setInterval(sendTail, 10000);
          tailSessions.set(userId, { nodeId, interval });
        }
      } catch (err) {
        logger.error(`[Discord] Button interaction error:`, err.message);
        try {
          if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: 'An error occurred processing this action.', ephemeral: true });
          }
        } catch {}
      }
    });

    client.on('disconnect', () => {
      isReady = false;
      logger.warn('[Discord] Bot disconnected');
    });

    client.on('error', (err) => {
      logger.error('[Discord] Bot error:', err.message);
    });

    await client.login(token);
    return true;
  } catch (err) {
    logger.error('[Discord] Failed to initialize bot:', err.message);
    client = null;
    isReady = false;
    return false;
  }
}

/**
 * Destroy the bot connection
 */
async function destroy() {
  if (client) {
    client.destroy();
    client = null;
    isReady = false;
    logger.info('[Discord] Bot disconnected');
  }
}

/**
 * Restart the bot (used when token changes)
 */
async function restart() {
  await destroy();
  return await init();
}

/**
 * Send an alert DM to the configured Discord user
 * @param {{ type: string, severity: string, nodeName: string, message: string, details?: object }} alert
 */
async function sendAlert(alert) {
  if (!client || !isReady) {
    logger.warn('[Discord] Bot not ready, cannot send alert');
    return false;
  }

  const userId = database.getSetting('discord_user_id');
  if (!userId) {
    logger.warn('[Discord] No Discord user ID configured');
    return false;
  }

  try {
    const user = await client.users.fetch(userId);
    if (!user) {
      logger.error('[Discord] Could not find user with ID:', userId);
      return false;
    }

    const embed = new EmbedBuilder()
      .setTitle(`${SEVERITY_EMOJI[alert.severity] || '⚡'} Nexus Alert — ${alert.type}`)
      .setDescription(alert.message)
      .setColor(SEVERITY_COLORS[alert.severity] || SEVERITY_COLORS.info)
      .addFields(
        { name: 'Node', value: alert.nodeName || 'Unknown', inline: true },
        { name: 'Severity', value: (alert.severity || 'info').toUpperCase(), inline: true },
      )
      .setTimestamp()
      .setFooter({ text: 'Nexus Monitor' });

    // Add detail fields if provided
    if (alert.details) {
      for (const [key, value] of Object.entries(alert.details)) {
        embed.addFields({ name: key, value: String(value), inline: true });
      }
    }

    // Add top process field if available
    if (alert.topProcess) {
      embed.addFields({
        name: '🔍 Top Process',
        value: `\`${alert.topProcess.name}\` (PID ${alert.topProcess.pid})\nCPU: ${(alert.topProcess.cpu || 0).toFixed(1)}% — MEM: ${(alert.topProcess.mem || 0).toFixed(1)}%`,
        inline: false,
      });
    }

    const messagePayload = { embeds: [embed] };

    // Add interactive buttons for warning/critical alerts (not resolved)
    if (alert.severity !== 'resolved' && alert.severity !== 'info' && alert.nodeId) {
      const alertKey = `${alert.nodeId}:${alert.metric || 'unknown'}`;
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`alert_dismiss_${alertKey}`)
          .setLabel('False Alarm')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('🔕'),
        new ButtonBuilder()
          .setCustomId(`alert_tail_${alertKey}`)
          .setLabel('Tail')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('📡'),
      );
      messagePayload.components = [row];
    }

    await user.send(messagePayload);
    logger.info(`[Discord] Alert sent to ${user.tag}: ${alert.type} on ${alert.nodeName}`);
    return true;
  } catch (err) {
    logger.error('[Discord] Failed to send alert:', err.message);
    return false;
  }
}

/**
 * Send a test message to verify the bot setup
 */
async function sendTestMessage() {
  return await sendAlert({
    type: 'Test Alert',
    severity: 'info',
    nodeName: 'Nexus Server',
    message: 'This is a test alert from your Nexus monitoring system. If you see this, Discord alerts are working correctly!',
    details: {
      'Status': 'Bot Connected',
      'Timestamp': new Date().toISOString(),
    },
  });
}

/**
 * Check if the bot is currently connected
 */
function getStatus() {
  return {
    connected: isReady,
    username: client?.user?.tag || null,
    userId: database.getSetting('discord_user_id') || null,
  };
}

module.exports = {
  init,
  destroy,
  restart,
  sendAlert,
  sendTestMessage,
  getStatus,
  isDismissed: (nodeId, metric) => dismissedAlerts.has(`${nodeId}:${metric}`),
  clearDismissed: (nodeId, metric) => dismissedAlerts.delete(`${nodeId}:${metric}`),
};
