/**
 * Alert Engine — Evaluates incoming metrics against configured thresholds
 * Fires Discord bot DM alerts when thresholds are exceeded
 * Implements cooldown to prevent alert spam
 */
const logger = require('./logger');
const database = require('./database');
const discordBot = require('./discord-bot');

// In-memory state for cooldowns and resolved tracking
const alertState = new Map(); // nodeId:metric -> { firedAt, severity, notifiedThreshold }

// Cooldown: don't re-fire same alert type within this window (ms)
const ALERT_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes

// Hysteresis: metric must drop this many % below threshold before resolving
const RESOLVE_HYSTERESIS = 5;

/**
 * Evaluate a single metric value against thresholds
 * Returns alert severity or null
 */
function evaluateMetric(value, threshold) {
  if (value == null || threshold == null) return null;
  if (value >= threshold + 10) return 'critical';
  if (value >= threshold) return 'warning';
  return null;
}

/**
 * Check incoming metrics against configured thresholds and fire alerts
 * Called after each metric save
 * 
 * Now supports per-node alert settings. Falls back to global thresholds
 * if no per-node settings exist.
 * 
 * @param {string} nodeId
 * @param {object} metrics - The full metrics object from the node
 * @param {string} hostname - Node hostname for display
 */
async function checkMetrics(nodeId, metrics, hostname) {
  // Check if alerts are enabled globally
  const alertsEnabled = database.getSetting('alerts_enabled');
  if (alertsEnabled !== 'true') return;

  // Check per-node settings first, then fall back to global
  const nodeSettings = database.getNodeAlertSettings(nodeId);

  // If per-node settings exist and alerts are disabled for this node, skip
  if (nodeSettings && !nodeSettings.enabled) return;

  let thresholds;
  if (nodeSettings) {
    thresholds = {
      cpu: nodeSettings.cpu_threshold,
      memory: nodeSettings.memory_threshold,
      disk: nodeSettings.disk_threshold,
    };
  } else {
    // Fall back to global thresholds
    const thresholdsRaw = database.getSetting('alerts_thresholds');
    if (!thresholdsRaw) return;
    try {
      thresholds = JSON.parse(thresholdsRaw);
    } catch {
      return;
    }
  }

  const nodeName = hostname || nodeId;

  // Extract current metric values
  const cpuUsage = metrics?.cpu?.usage;
  const memUsage = metrics?.memory?.usagePercent;
  const diskUsage = metrics?.disk?.[0]?.usagePercent;

  const checks = [
    { metric: 'cpu', label: 'CPU Usage', value: cpuUsage, threshold: thresholds.cpu, unit: '%' },
    { metric: 'memory', label: 'Memory Usage', value: memUsage, threshold: thresholds.memory, unit: '%' },
    { metric: 'disk', label: 'Disk Usage', value: diskUsage, threshold: thresholds.disk, unit: '%' },
  ];

  for (const check of checks) {
    if (check.value == null || check.threshold == null) continue;

    const stateKey = `${nodeId}:${check.metric}`;
    const severity = evaluateMetric(check.value, check.threshold);
    const existing = alertState.get(stateKey);

    if (severity) {
      // Threshold exceeded — check cooldown
      if (existing) {
        const elapsed = Date.now() - existing.firedAt;
        // Don't re-fire if within cooldown and same or lower severity
        if (elapsed < ALERT_COOLDOWN_MS && existing.severity === severity) {
          continue;
        }
        // Escalation: if severity went from warning to critical, always fire
        if (severity === 'warning' && existing.severity === 'critical' && elapsed < ALERT_COOLDOWN_MS) {
          continue;
        }
      }

      // Fire the alert
      const rounded = Math.round(check.value * 10) / 10;

      // Find the top process causing the spike (for CPU/memory alerts)
      let topProcess = null;
      if (check.metric === 'cpu' && metrics?.processes?.list?.length) {
        topProcess = metrics.processes.list[0]; // already sorted by CPU desc
      } else if (check.metric === 'memory' && metrics?.processes?.list?.length) {
        // Sort by memory for memory alerts
        const byMem = [...metrics.processes.list].sort((a, b) => (b.mem || 0) - (a.mem || 0));
        topProcess = byMem[0];
      }

      let processInfo = '';
      if (topProcess) {
        const procCpu = (topProcess.cpu || 0).toFixed(1);
        const procMem = (topProcess.mem || 0).toFixed(1);
        processInfo = `\n\n🔍 **Top Process:** \`${topProcess.name}\` (PID ${topProcess.pid}) — CPU: ${procCpu}%, MEM: ${procMem}%`;
        if (topProcess.command) {
          const cmd = topProcess.command.length > 80 ? topProcess.command.substring(0, 80) + '…' : topProcess.command;
          processInfo += `\n\`${cmd}\``;
        }
      }

      const alert = {
        type: `${check.label} ${severity === 'critical' ? 'CRITICAL' : 'Warning'}`,
        severity,
        nodeName,
        nodeId,
        metric: check.metric,
        message: `**${check.label}** on **${nodeName}** is at **${rounded}${check.unit}** (threshold: ${check.threshold}${check.unit})${processInfo}`,
        details: {
          'Current': `${rounded}${check.unit}`,
          'Threshold': `${check.threshold}${check.unit}`,
        },
        topProcess: topProcess ? {
          name: topProcess.name,
          pid: topProcess.pid,
          cpu: topProcess.cpu,
          mem: topProcess.mem,
          command: topProcess.command,
        } : null,
      };

      const sent = await discordBot.sendAlert(alert);

      // Update state
      alertState.set(stateKey, {
        firedAt: Date.now(),
        severity,
        notifiedThreshold: check.threshold,
      });

      // Save to alert history (for mobile polling)
      try {
        database.addAlertHistory({
          nodeId,
          nodeName,
          metric: check.metric,
          severity,
          type: alert.type,
          message: `${check.label} on ${nodeName} is at ${rounded}${check.unit} (threshold: ${check.threshold}${check.unit})`,
          value: rounded,
          threshold: check.threshold,
          topProcess: alert.topProcess,
          firedAt: Date.now(),
        });
      } catch { /* ignore db failures */ }

      // Clean old alerts periodically (7 days)
      try { database.cleanOldAlerts(); } catch {}
    } else if (existing) {
      // Metric is below threshold — check if we should send a resolved notification
      if (check.value <= check.threshold - RESOLVE_HYSTERESIS) {
        const rounded = Math.round(check.value * 10) / 10;

        await discordBot.sendAlert({
          type: `${check.label} Resolved`,
          severity: 'resolved',
          nodeName,
          message: `**${check.label}** on **${nodeName}** has normalized to **${rounded}${check.unit}** (threshold: ${check.threshold}${check.unit})`,
          details: {
            'Current': `${rounded}${check.unit}`,
            'Threshold': `${check.threshold}${check.unit}`,
          },
        });

        // Save resolved to alert history
        try {
          database.addAlertHistory({
            nodeId,
            nodeName,
            metric: check.metric,
            severity: 'resolved',
            type: `${check.label} Resolved`,
            message: `${check.label} on ${nodeName} has normalized to ${rounded}${check.unit}`,
            value: rounded,
            threshold: check.threshold,
            firedAt: Date.now(),
          });
        } catch {}

        alertState.delete(stateKey);
      }
    }
  }
}

/**
 * Check if a node has gone offline (no metrics received within expected interval)
 * Called from the metrics broadcast loop
 */
async function checkNodeOffline(nodeId, hostname, lastSeen, reportInterval) {
  const alertsEnabled = database.getSetting('alerts_enabled');
  if (alertsEnabled !== 'true') return;

  const stateKey = `${nodeId}:offline`;
  const existing = alertState.get(stateKey);

  // Consider offline if no metrics for 3x the report interval
  const offlineThreshold = (reportInterval || 5) * 3 * 1000;
  const timeSinceLastSeen = Date.now() - (lastSeen || 0);

  if (timeSinceLastSeen > offlineThreshold) {
    if (existing && (Date.now() - existing.firedAt) < ALERT_COOLDOWN_MS) return;

    await discordBot.sendAlert({
      type: 'Node Offline',
      severity: 'critical',
      nodeName: hostname || nodeId,
      message: `**${hostname || nodeId}** has not reported metrics for ${Math.round(timeSinceLastSeen / 1000)}s`,
      details: {
        'Last Seen': lastSeen ? new Date(lastSeen).toISOString() : 'Never',
        'Expected Interval': `${reportInterval || 5}s`,
      },
    });

    alertState.set(stateKey, { firedAt: Date.now(), severity: 'critical' });
  } else if (existing) {
    // Node is back online
    await discordBot.sendAlert({
      type: 'Node Online',
      severity: 'resolved',
      nodeName: hostname || nodeId,
      message: `**${hostname || nodeId}** is back online and reporting metrics`,
    });

    alertState.delete(stateKey);
  }
}

/**
 * Get current alert states for dashboard display
 */
function getActiveAlerts() {
  const alerts = [];
  for (const [key, state] of alertState.entries()) {
    const [nodeId, metric] = key.split(':');
    alerts.push({
      nodeId,
      metric,
      severity: state.severity,
      firedAt: state.firedAt,
    });
  }
  return alerts;
}

/**
 * Clear all alert states (used when thresholds change)
 */
function clearAlertStates() {
  alertState.clear();
}

module.exports = {
  checkMetrics,
  checkNodeOffline,
  getActiveAlerts,
  clearAlertStates,
};
