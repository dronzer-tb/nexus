import { useState, useEffect, useCallback } from 'react';
import {
  SendDiagonal, Check, WarningTriangle, Refresh, Shield, Key, Flash, InfoCircle,
} from 'iconoir-react';
import axios from 'axios';

function DiscordAlertSettings({ showFeedback }) {
  const [discordStatus, setDiscordStatus] = useState(null);
  const [botToken, setBotToken] = useState('');
  const [userId, setUserId] = useState('');
  const [alertsEnabled, setAlertsEnabled] = useState(false);
  const [thresholds, setThresholds] = useState({ cpu: 80, memory: 85, disk: 90 });
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadStatus = useCallback(async () => {
    try {
      const [statusRes, thresholdRes] = await Promise.all([
        axios.get('/api/alerts/discord/status'),
        axios.get('/api/alerts/thresholds'),
      ]);
      setDiscordStatus(statusRes.data.discord);
      setUserId(statusRes.data.discord?.userId || '');
      setAlertsEnabled(thresholdRes.data.alertsEnabled || false);
      if (thresholdRes.data.thresholds) {
        setThresholds(thresholdRes.data.thresholds);
      }
    } catch (err) {
      console.error('Failed to load alert settings:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadStatus(); }, [loadStatus]);

  const saveDiscordSettings = async () => {
    setSaving(true);
    try {
      await axios.post('/api/alerts/discord/settings', {
        botToken: botToken || undefined,
        userId,
      });
      setBotToken('');
      showFeedback('Discord settings saved!');
      loadStatus();
    } catch (err) {
      showFeedback('Failed to save Discord settings');
    } finally {
      setSaving(false);
    }
  };

  const saveThresholds = async () => {
    setSaving(true);
    try {
      await axios.post('/api/alerts/thresholds', {
        enabled: alertsEnabled,
        thresholds,
      });
      showFeedback('Alert thresholds saved!');
    } catch (err) {
      showFeedback('Failed to save thresholds');
    } finally {
      setSaving(false);
    }
  };

  const testAlert = async () => {
    setTesting(true);
    try {
      const res = await axios.post('/api/alerts/discord/test');
      showFeedback(res.data.message);
    } catch (err) {
      showFeedback('Failed to send test alert');
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 text-center text-tx/30">
        <div className="animate-spin w-6 h-6 border-2 border-tx/10 border-t-neon-cyan rounded-full mx-auto" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Discord Bot Connection */}
      <div className="border-[3px] border-tx/10 bg-brutal-card p-5">
        <h3 className="font-bold text-sm uppercase tracking-widest text-tx/50 mb-4 flex items-center gap-2">
          <SendDiagonal className="w-4 h-4 text-neon-purple" />
          Discord Bot
        </h3>

        {/* Status indicator */}
        <div className="flex items-center gap-2 mb-4 p-3 bg-brutal-bg border-2 border-tx/10">
          <div className={`w-2 h-2 rounded-full ${discordStatus?.connected ? 'bg-green-400 animate-pulse' : 'bg-gray-600'}`} />
          <span className="text-xs font-bold text-tx/50 uppercase tracking-wider">
            {discordStatus?.connected
              ? `Connected as ${discordStatus.username}`
              : discordStatus?.hasToken
                ? 'Disconnected — check token'
                : 'Not configured'}
          </span>
        </div>

        {/* Bot Token */}
        <div className="space-y-3">
          <div>
            <label className="text-[9px] font-bold uppercase tracking-widest text-tx/30 block mb-1">
              Bot Token {discordStatus?.hasToken && '(already set)'}
            </label>
            <input
              type={showToken ? 'text' : 'password'}
              value={botToken}
              onChange={(e) => setBotToken(e.target.value)}
              placeholder={discordStatus?.hasToken ? '••••••••••••••••' : 'Paste your Discord bot token'}
              className="w-full bg-brutal-bg border-2 border-tx/10 px-3 py-2 font-mono text-xs text-tx focus:border-neon-purple/40 focus:outline-none transition-colors"
            />
          </div>

          {/* User ID */}
          <div>
            <label className="text-[9px] font-bold uppercase tracking-widest text-tx/30 block mb-1">
              Your Discord User ID
            </label>
            <input
              type="text"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              placeholder="123456789012345678"
              className="w-full bg-brutal-bg border-2 border-tx/10 px-3 py-2 font-mono text-xs text-tx focus:border-neon-purple/40 focus:outline-none transition-colors"
            />
            <p className="text-[10px] text-tx/20 mt-1">
              Enable Developer Mode in Discord, right-click your name, Copy User ID
            </p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={saveDiscordSettings}
              disabled={saving}
              className="px-4 py-2 bg-neon-purple text-white text-xs font-bold uppercase tracking-wider hover:bg-neon-purple/90 disabled:opacity-50 transition-all"
            >
              {saving ? 'Saving...' : 'Save Bot Settings'}
            </button>
            <button
              onClick={testAlert}
              disabled={testing || !discordStatus?.connected}
              className="px-4 py-2 border-2 border-tx/20 text-tx/60 text-xs font-bold uppercase tracking-wider hover:border-neon-cyan/40 hover:text-tx disabled:opacity-30 transition-all"
            >
              {testing ? 'Sending...' : 'Send Test Alert'}
            </button>
          </div>
        </div>

        {/* Setup instructions */}
        <div className="mt-4 p-3 bg-neon-purple/5 border border-neon-purple/20 text-xs text-tx/40 font-mono space-y-1">
          <p className="font-bold text-tx/60">Setup Guide:</p>
          <p>1. Go to discord.com/developers/applications</p>
          <p>2. Create a New Application, go to Bot tab</p>
          <p>3. Click Reset Token, copy the token</p>
          <p>4. Enable MESSAGE CONTENT intent</p>
          <p>5. Invite bot to a server you're in (OAuth2 URL Generator, bot scope)</p>
          <p>6. Paste token and your User ID above</p>
        </div>
      </div>

      {/* Alert Thresholds */}
      <div className="border-[3px] border-tx/10 bg-brutal-card p-5">
        <h3 className="font-bold text-sm uppercase tracking-widest text-tx/50 mb-4 flex items-center gap-2">
          <Flash className="w-4 h-4 text-neon-pink" />
          Alert Thresholds
        </h3>

        {/* Enable toggle */}
        <div className="flex items-center justify-between mb-4 p-3 bg-brutal-bg border-2 border-tx/10">
          <span className="text-xs font-bold text-tx/50 uppercase tracking-wider">Alerts Enabled</span>
          <button
            onClick={() => setAlertsEnabled(!alertsEnabled)}
            className={`w-10 h-5 rounded-full transition-colors relative ${alertsEnabled ? 'bg-neon-cyan' : 'bg-tx/10'}`}
          >
            <div className={`w-4 h-4 rounded-full bg-white absolute top-0.5 transition-transform ${alertsEnabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
          </button>
        </div>

        {/* Threshold sliders */}
        <div className="space-y-4">
          {[
            { key: 'cpu', label: 'CPU Usage', color: 'text-neon-cyan' },
            { key: 'memory', label: 'Memory Usage', color: 'text-neon-pink' },
            { key: 'disk', label: 'Disk Usage', color: 'text-neon-purple' },
          ].map(({ key, label, color }) => (
            <div key={key}>
              <div className="flex items-center justify-between mb-1">
                <span className={`text-xs font-bold uppercase tracking-wider ${color}`}>{label}</span>
                <span className="text-xs font-mono text-tx/50">{thresholds[key]}%</span>
              </div>
              <input
                type="range"
                min="50"
                max="99"
                value={thresholds[key]}
                onChange={(e) => setThresholds(prev => ({ ...prev, [key]: parseInt(e.target.value) }))}
                className="w-full accent-neon-cyan"
              />
            </div>
          ))}
        </div>

        <button
          onClick={saveThresholds}
          disabled={saving}
          className="mt-4 px-4 py-2 bg-neon-pink text-white text-xs font-bold uppercase tracking-wider hover:bg-neon-pink/90 disabled:opacity-50 transition-all"
        >
          {saving ? 'Saving...' : 'Save Thresholds'}
        </button>
      </div>
    </div>
  );
}

export default DiscordAlertSettings;
