import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Shield, Check, AlertTriangle, Clock, Zap } from 'lucide-react';

/**
 * Onboarding Wizard - Multi-step setup for Nexus v1.9.5
 * Guides user through initial configuration
 */

function Onboarding() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Step 1: Admin account data
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [userId, setUserId] = useState(null);

  // Step 2: 2FA data
  const [totpSecret, setTotpSecret] = useState('');
  const [qrCode, setQrCode] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [recoveryCodes, setRecoveryCodes] = useState([]);

  // Step 3: Alert data
  const [alertsEnabled, setAlertsEnabled] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [cpuThreshold, setCpuThreshold] = useState(80);
  const [memoryThreshold, setMemoryThreshold] = useState(85);
  const [diskThreshold, setDiskThreshold] = useState(90);

  // Step 4: Metrics interval
  const [metricsInterval, setMetricsInterval] = useState(15);

  const totalSteps = 6;

  // ═══════════════════════════════════════════════════════════
  // Step 1: Welcome Screen
  // ═══════════════════════════════════════════════════════════

  const WelcomeStep = () => (
    <div className="text-center space-y-6">
      <div className="text-6xl mb-6">🎯</div>
      <h1 className="text-4xl font-bold text-neon-pink">Welcome to Nexus</h1>
      <p className="text-xl text-gray-300 max-w-2xl mx-auto">
        Remote resource monitoring and management platform
      </p>
      
      <div className="grid md:grid-cols-2 gap-4 max-w-3xl mx-auto mt-8">
        <div className="bg-background-light p-6 rounded-lg border-2 border-neon-cyan/30">
          <Zap className="w-8 h-8 text-neon-cyan mb-3 mx-auto" />
          <h3 className="font-bold mb-2">Real-time Monitoring</h3>
          <p className="text-sm text-gray-400">Track CPU, RAM, disk, and network metrics</p>
        </div>
        <div className="bg-background-light p-6 rounded-lg border-2 border-neon-pink/30">
          <Shield className="w-8 h-8 text-neon-pink mb-3 mx-auto" />
          <h3 className="font-bold mb-2">Secure Access</h3>
          <p className="text-sm text-gray-400">Mandatory 2FA and encrypted connections</p>
        </div>
        <div className="bg-background-light p-6 rounded-lg border-2 border-neon-purple/30">
          <AlertTriangle className="w-8 h-8 text-neon-purple mb-3 mx-auto" />
          <h3 className="font-bold mb-2">Smart Alerts</h3>
          <p className="text-sm text-gray-400">Get notified when thresholds are exceeded</p>
        </div>
        <div className="bg-background-light p-6 rounded-lg border-2 border-primary/30">
          <Clock className="w-8 h-8 text-primary mb-3 mx-auto" />
          <h3 className="font-bold mb-2">Multi-node Management</h3>
          <p className="text-sm text-gray-400">Monitor multiple servers from one dashboard</p>
        </div>
      </div>

      <button
        onClick={() => setCurrentStep(2)}
        className="mt-8 px-8 py-3 bg-primary text-on-primary font-bold rounded-lg hover:bg-primary/90 transition-all"
      >
        Continue to Setup →
      </button>
    </div>
  );

  // ═══════════════════════════════════════════════════════════
  // Step 2: Create Admin Account
  // ═══════════════════════════════════════════════════════════

  const handleCreateAccount = async (e) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);

    try {
      const response = await axios.post('/api/onboarding/step1', {
        username,
        password
      });

      setUserId(response.data.userId);
      setCurrentStep(3); // Move to 2FA setup
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create account');
      if (err.response?.data?.details) {
        setError(err.response.data.details.join(', '));
      }
    } finally {
      setLoading(false);
    }
  };

  const AdminAccountStep = () => (
    <div className="max-w-md mx-auto">
      <h2 className="text-3xl font-bold text-neon-pink mb-2">Administrator Setup</h2>
      <p className="text-gray-400 mb-6">Create your admin account to manage Nexus</p>

      {error && (
        <div className="mb-4 p-3 bg-red-500/20 border border-red-500 rounded-lg text-red-300">
          {error}
        </div>
      )}

      <form onSubmit={handleCreateAccount} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">Username</label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full px-4 py-2 bg-background-light border border-gray-600 rounded-lg focus:outline-none focus:border-primary"
            required
            minLength={3}
            maxLength={32}
            pattern="[a-zA-Z0-9_-]+"
          />
          <p className="text-xs text-gray-500 mt-1">3-32 characters, letters, numbers, - and _ only</p>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-2 bg-background-light border border-gray-600 rounded-lg focus:outline-none focus:border-primary"
            required
            minLength={8}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Confirm Password</label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full px-4 py-2 bg-background-light border border-gray-600 rounded-lg focus:outline-none focus:border-primary"
            required
          />
        </div>

        <div className="bg-background-light p-4 rounded-lg border border-gray-700">
          <p className="text-sm font-medium mb-2">Password Requirements:</p>
          <ul className="text-xs text-gray-400 space-y-1">
            <li>✓ At least 8 characters</li>
            <li>✓ Uppercase & lowercase letters</li>
            <li>✓ At least one number</li>
            <li>✓ At least one special character (@$!%*?&)</li>
          </ul>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 bg-primary text-on-primary font-bold rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-all"
        >
          {loading ? 'Creating Account...' : 'Continue to 2FA Setup →'}
        </button>
      </form>
    </div>
  );

  // ═══════════════════════════════════════════════════════════
  // Step 3: Setup 2FA (Mandatory)
  // ═══════════════════════════════════════════════════════════

  const handleGenerate2FA = async () => {
    setError('');
    setLoading(true);

    try {
      const response = await axios.post('/api/onboarding/step2', {
        action: 'generate',
        userId
      });

      setTotpSecret(response.data.secret);
      setQrCode(response.data.qrCode);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to generate 2FA secret');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify2FA = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await axios.post('/api/onboarding/step2', {
        action: 'verify',
        userId,
        totpCode
      });

      setRecoveryCodes(response.data.recoveryCodes);
      // Don't auto-advance - user needs to save recovery codes
    } catch (err) {
      setError(err.response?.data?.error || 'Invalid 2FA code');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (currentStep === 3 && userId && !totpSecret) {
      handleGenerate2FA();
    }
  }, [currentStep, userId]);

  const TwoFactorStep = () => (
    <div className="max-w-lg mx-auto">
      <h2 className="text-3xl font-bold text-neon-pink mb-2">Two-Factor Authentication</h2>
      <p className="text-gray-400 mb-6">
        <span className="text-red-400 font-bold">⚠️ Required:</span> 2FA cannot be skipped
      </p>

      {error && (
        <div className="mb-4 p-3 bg-red-500/20 border border-red-500 rounded-lg text-red-300">
          {error}
        </div>
      )}

      {!recoveryCodes.length ? (
        <div className="space-y-6">
          {qrCode && (
            <div className="text-center">
              <p className="mb-4 text-sm text-gray-300">Scan this QR code with your authenticator app:</p>
              <div className="inline-block p-4 bg-white rounded-lg">
                <img src={qrCode} alt="2FA QR Code" className="w-64 h-64" />
              </div>
            </div>
          )}

          {totpSecret && (
            <div className="bg-background-light p-4 rounded-lg border border-gray-700">
              <p className="text-sm font-medium mb-2">Or enter manually:</p>
              <code className="text-xs text-neon-cyan break-all">{totpSecret}</code>
            </div>
          )}

          <div className="bg-background-light p-4 rounded-lg border border-gray-700">
            <p className="text-sm font-medium mb-2">Recommended apps:</p>
            <ul className="text-xs text-gray-400 space-y-1">
              <li>• Google Authenticator</li>
              <li>• Microsoft Authenticator</li>
              <li>• Authy</li>
              <li>• 1Password</li>
            </ul>
          </div>

          <form onSubmit={handleVerify2FA} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Enter 6-digit code to verify:</label>
              <input
                type="text"
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="w-full px-4 py-2 bg-background-light border border-gray-600 rounded-lg focus:outline-none focus:border-primary text-center text-2xl tracking-widest"
                placeholder="000000"
                maxLength={6}
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading || totpCode.length !== 6}
              className="w-full py-3 bg-primary text-on-primary font-bold rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-all"
            >
              {loading ? 'Verifying...' : 'Verify & Continue →'}
            </button>
          </form>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="bg-green-500/20 border border-green-500 rounded-lg p-4">
            <h3 className="font-bold text-green-300 mb-2">✅ 2FA Enabled Successfully!</h3>
            <p className="text-sm text-gray-300">Save these recovery codes in a safe place.</p>
          </div>

          <div className="bg-background-light p-4 rounded-lg border border-yellow-500">
            <h3 className="font-bold text-yellow-300 mb-3">🔑 Recovery Codes</h3>
            <p className="text-xs text-gray-400 mb-3">Use these codes if you lose access to your authenticator app. Each code can only be used once.</p>
            <div className="grid grid-cols-2 gap-2 font-mono text-sm">
              {recoveryCodes.map((code, i) => (
                <div key={i} className="bg-background-dark p-2 rounded text-center">{code}</div>
              ))}
            </div>
          </div>

          <button
            onClick={() => setCurrentStep(4)}
            className="w-full py-3 bg-primary text-on-primary font-bold rounded-lg hover:bg-primary/90 transition-all"
          >
            I've Saved My Recovery Codes →
          </button>
        </div>
      )}
    </div>
  );

  // ═══════════════════════════════════════════════════════════
  // Step 4: Configure Alerts
  // ═══════════════════════════════════════════════════════════

  const handleTestWebhook = async () => {
    setError('');
    setLoading(true);

    try {
      await axios.post('/api/onboarding/test-webhook', { webhookUrl });
      alert('✅ Test alert sent successfully! Check your Telegram/Discord.');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to send test alert');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveAlerts = async () => {
    setError('');
    setLoading(true);

    try {
      await axios.post('/api/onboarding/step3', {
        enabled: alertsEnabled,
        webhookUrl,
        thresholds: {
          cpu: cpuThreshold,
          memory: memoryThreshold,
          disk: diskThreshold
        }
      });

      setCurrentStep(5);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save alert configuration');
    } finally {
      setLoading(false);
    }
  };

  const AlertsStep = () => (
    <div className="max-w-2xl mx-auto">
      <h2 className="text-3xl font-bold text-neon-pink mb-2">Alert Notifications</h2>
      <p className="text-gray-400 mb-6">Get notified when metrics exceed thresholds</p>

      {error && (
        <div className="mb-4 p-3 bg-red-500/20 border border-red-500 rounded-lg text-red-300">
          {error}
        </div>
      )}

      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id="alerts-enabled"
            checked={alertsEnabled}
            onChange={(e) => setAlertsEnabled(e.target.checked)}
            className="w-5 h-5"
          />
          <label htmlFor="alerts-enabled" className="font-medium">Enable Alerts</label>
        </div>

        {alertsEnabled && (
          <>
            <div>
              <label className="block text-sm font-medium mb-2">Alert Method</label>
              <select className="w-full px-4 py-2 bg-background-light border border-gray-600 rounded-lg focus:outline-none focus:border-primary">
                <option>Webhook (Telegram/Discord)</option>
                <option disabled>Email (Coming Soon)</option>
                <option disabled>SMS (Coming Soon)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Webhook URL</label>
              <input
                type="url"
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                className="w-full px-4 py-2 bg-background-light border border-gray-600 rounded-lg focus:outline-none focus:border-primary"
                placeholder="https://api.telegram.org/bot..."
              />
              <button
                onClick={handleTestWebhook}
                disabled={!webhookUrl || loading}
                className="mt-2 px-4 py-2 bg-neon-cyan text-black font-bold rounded-lg hover:bg-neon-cyan/90 disabled:opacity-50 text-sm"
              >
                Send Test Alert
              </button>
            </div>

            <div className="grid md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">CPU Threshold (%)</label>
                <input
                  type="number"
                  value={cpuThreshold}
                  onChange={(e) => setCpuThreshold(Number(e.target.value))}
                  className="w-full px-4 py-2 bg-background-light border border-gray-600 rounded-lg focus:outline-none focus:border-primary"
                  min={1}
                  max={100}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Memory Threshold (%)</label>
                <input
                  type="number"
                  value={memoryThreshold}
                  onChange={(e) => setMemoryThreshold(Number(e.target.value))}
                  className="w-full px-4 py-2 bg-background-light border border-gray-600 rounded-lg focus:outline-none focus:border-primary"
                  min={1}
                  max={100}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Disk Threshold (%)</label>
                <input
                  type="number"
                  value={diskThreshold}
                  onChange={(e) => setDiskThreshold(Number(e.target.value))}
                  className="w-full px-4 py-2 bg-background-light border border-gray-600 rounded-lg focus:outline-none focus:border-primary"
                  min={1}
                  max={100}
                />
              </div>
            </div>
          </>
        )}

        <div className="flex gap-4">
          <button
            onClick={handleSaveAlerts}
            disabled={loading}
            className="flex-1 py-3 bg-primary text-on-primary font-bold rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-all"
          >
            {loading ? 'Saving...' : alertsEnabled ? 'Save & Continue →' : 'Skip for Now →'}
          </button>
        </div>
      </div>
    </div>
  );

  // ═══════════════════════════════════════════════════════════
  // Step 5: Metrics Refresh Interval
  // ═══════════════════════════════════════════════════════════

  const handleSaveInterval = async () => {
    setError('');
    setLoading(true);

    try {
      await axios.post('/api/onboarding/step4', {
        interval: metricsInterval
      });

      setCurrentStep(6);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save metrics interval');
    } finally {
      setLoading(false);
    }
  };

  const MetricsIntervalStep = () => (
    <div className="max-w-lg mx-auto">
      <h2 className="text-3xl font-bold text-neon-pink mb-2">Data Collection Settings</h2>
      <p className="text-gray-400 mb-6">How often should metrics be collected?</p>

      {error && (
        <div className="mb-4 p-3 bg-red-500/20 border border-red-500 rounded-lg text-red-300">
          {error}
        </div>
      )}

      <div className="space-y-4">
        {[
          { value: 5, label: '5 seconds', desc: 'High CPU usage, real-time data' },
          { value: 15, label: '15 seconds', desc: 'Recommended balance' },
          { value: 30, label: '30 seconds', desc: 'Balanced performance' },
          { value: 60, label: '60 seconds', desc: 'Low overhead' }
        ].map(option => (
          <label
            key={option.value}
            className={`block p-4 rounded-lg border-2 cursor-pointer transition-all ${
              metricsInterval === option.value
                ? 'border-primary bg-primary/10'
                : 'border-gray-700 hover:border-gray-600'
            }`}
          >
            <div className="flex items-center gap-3">
              <input
                type="radio"
                name="interval"
                value={option.value}
                checked={metricsInterval === option.value}
                onChange={() => setMetricsInterval(option.value)}
                className="w-5 h-5"
              />
              <div className="flex-1">
                <div className="font-bold">{option.label}</div>
                <div className="text-sm text-gray-400">{option.desc}</div>
              </div>
            </div>
          </label>
        ))}
      </div>

      <div className="mt-6 bg-background-light p-4 rounded-lg border border-blue-500/30">
        <p className="text-sm text-gray-300">
          ℹ️ Lower intervals provide real-time data but increase CPU usage on monitored nodes.
        </p>
      </div>

      <button
        onClick={handleSaveInterval}
        disabled={loading}
        className="w-full mt-6 py-3 bg-primary text-on-primary font-bold rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-all"
      >
        {loading ? 'Saving...' : 'Complete Setup →'}
      </button>
    </div>
  );

  // ═══════════════════════════════════════════════════════════
  // Step 6: Completion
  // ═══════════════════════════════════════════════════════════

  const handleComplete = async () => {
    setLoading(true);

    try {
      await axios.post('/api/onboarding/complete');
      // Redirect to dashboard
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to complete onboarding');
      setLoading(false);
    }
  };

  const CompletionStep = () => (
    <div className="text-center max-w-2xl mx-auto">
      <div className="text-6xl mb-6">✅</div>
      <h1 className="text-4xl font-bold text-neon-pink mb-4">Nexus is Ready!</h1>
      <p className="text-xl text-gray-300 mb-8">
        Your dashboard is now fully configured and ready to use.
      </p>

      <div className="bg-background-light p-6 rounded-lg border border-gray-700 mb-8">
        <h3 className="font-bold mb-4 text-left">Configuration Summary:</h3>
        <div className="text-left space-y-2">
          <div className="flex items-center gap-2">
            <Check className="w-5 h-5 text-green-400" />
            <span>Admin account created: <span className="text-neon-cyan">{username}</span></span>
          </div>
          <div className="flex items-center gap-2">
            <Check className="w-5 h-5 text-green-400" />
            <span>2FA enabled with {recoveryCodes.length} recovery codes</span>
          </div>
          <div className="flex items-center gap-2">
            <Check className="w-5 h-5 text-green-400" />
            <span>Alerts {alertsEnabled ? 'enabled' : 'disabled'}</span>
          </div>
          <div className="flex items-center gap-2">
            <Check className="w-5 h-5 text-green-400" />
            <span>Metrics refresh: every {metricsInterval} seconds</span>
          </div>
        </div>
      </div>

      <div className="bg-blue-500/20 border border-blue-500 p-6 rounded-lg mb-8 text-left">
        <h3 className="font-bold text-blue-300 mb-3">Next Steps:</h3>
        <ol className="space-y-2 text-sm text-gray-300">
          <li>1. Add your first node to start monitoring</li>
          <li>2. Download the mobile app (optional)</li>
          <li>3. Scan QR code to pair mobile app</li>
        </ol>
      </div>

      <button
        onClick={handleComplete}
        disabled={loading}
        className="px-8 py-4 bg-primary text-on-primary font-bold text-lg rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-all"
      >
        {loading ? 'Opening Dashboard...' : 'Open Dashboard →'}
      </button>
    </div>
  );

  // ═══════════════════════════════════════════════════════════
  // Render Current Step
  // ═══════════════════════════════════════════════════════════

  return (
    <div className="min-h-screen bg-background-dark text-white flex flex-col">
      {/* Progress Bar */}
      <div className="bg-background-light border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Setup Progress</span>
            <span className="text-sm text-gray-400">Step {currentStep} of {totalSteps}</span>
          </div>
          <div className="w-full bg-background-dark rounded-full h-2">
            <div
              className="bg-primary h-2 rounded-full transition-all duration-300"
              style={{ width: `${(currentStep / totalSteps) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full">
          {currentStep === 1 && <WelcomeStep />}
          {currentStep === 2 && <AdminAccountStep />}
          {currentStep === 3 && <TwoFactorStep />}
          {currentStep === 4 && <AlertsStep />}
          {currentStep === 5 && <MetricsIntervalStep />}
          {currentStep === 6 && <CompletionStep />}
        </div>
      </div>
    </div>
  );
}

export default Onboarding;
