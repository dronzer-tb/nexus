import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Shield, Lock, User, Key, Check, Copy } from 'iconoir-react';
import { useAuth } from '../context/AuthContext';

/**
 * Login Page with 2FA support
 * For custom auth system v2.2.8
 *
 * Flow:
 *  1. User enters username + password
 *  2. If user has 2FA → show 2FA code input
 *  3. If user doesn't have 2FA → show 2FA setup flow
 */

function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();

  // Step: 'credentials' | 'totp' | 'setup2fa'
  const [step, setStep] = useState('credentials');

  // Credentials
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  // 2FA verification
  const [totpCode, setTotpCode] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [useRecoveryCode, setUseRecoveryCode] = useState(false);

  // 2FA setup
  const [setupSecret, setSetupSecret] = useState('');
  const [setupQR, setSetupQR] = useState('');
  const [setupTotpCode, setSetupTotpCode] = useState('');
  const [recoveryCodes, setRecoveryCodes] = useState([]);
  const [showRecoveryCodes, setShowRecoveryCodes] = useState(false);
  const [setupToken, setSetupToken] = useState(null);
  const [setupUser, setSetupUser] = useState(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copiedSecret, setCopiedSecret] = useState(false);

  // Step 1: Submit credentials
  const handleCredentials = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await axios.post('/api/auth/login', { username, password });

      if (response.data.requires2FASetup) {
        // User has no 2FA — save temp token + go to setup
        setSetupToken(response.data.token);
        setSetupUser(response.data.user);
        const setupRes = await axios.post('/api/auth/2fa/enable', {}, {
          headers: { Authorization: `Bearer ${response.data.token}` }
        });
        setSetupSecret(setupRes.data.secret);
        setSetupQR(setupRes.data.qrCode);
        setStep('setup2fa');
      } else if (response.data.requires2FA) {
        setStep('totp');
      } else if (response.data.token) {
        login(response.data.user, response.data.token);
        window.location.href = '/';
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Step 2a: Submit 2FA code (existing users)
  const handleTotpVerify = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await axios.post('/api/auth/login', {
        username,
        password,
        totpCode: useRecoveryCode ? undefined : totpCode,
        recoveryCode: useRecoveryCode ? recoveryCode : undefined
      });

      login(response.data.user, response.data.token);
      window.location.href = '/';
    } catch (err) {
      setError(err.response?.data?.error || 'Verification failed.');
      setTotpCode('');
      setRecoveryCode('');
    } finally {
      setLoading(false);
    }
  };

  // Step 2b: Verify 2FA setup code (new users)
  const handleSetupVerify = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await axios.post('/api/auth/2fa/verify-setup',
        { totpCode: setupTotpCode },
        { headers: { Authorization: `Bearer ${setupToken}` } }
      );

      if (response.data.recoveryCodes) {
        setRecoveryCodes(response.data.recoveryCodes);
        setShowRecoveryCodes(true);
      } else {
        login(setupUser, setupToken);
        window.location.href = '/';
      }
    } catch (err) {
      setError(err.response?.data?.error || '2FA setup failed.');
      setSetupTotpCode('');
    } finally {
      setLoading(false);
    }
  };

  // Complete after showing recovery codes
  const handleSetupDone = () => {
    login(setupUser, setupToken);
    window.location.href = '/';
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopiedSecret(true);
    setTimeout(() => setCopiedSecret(false), 2000);
  };

  return (
    <div className="min-h-screen bg-background-dark text-white flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo/Header */}
        <div className="text-center mb-8">
          <img src="/favicon.png" alt="Nexus" className="w-16 h-16 mx-auto mb-4" />
          <h1 className="text-4xl font-bold text-neon-pink mb-2">Nexus</h1>
          <p className="text-gray-400">Remote Resource Monitoring</p>
        </div>

        {/* Login Form */}
        <div className="bg-background-light p-8 rounded-lg border-2 border-gray-800">

          {/* ═══ STEP: CREDENTIALS ═══ */}
          {step === 'credentials' && (
            <>
              <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
                <Lock className="w-6 h-6 text-neon-pink" />
                Sign In
              </h2>

              {error && (
                <div className="mb-4 p-3 bg-red-500/20 border border-red-500 rounded-lg text-red-300 text-sm">
                  {error}
                </div>
              )}

              <form onSubmit={handleCredentials} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2 flex items-center gap-2">
                    <User className="w-4 h-4" /> Username
                  </label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full px-4 py-2 bg-background-dark border border-gray-600 rounded-lg focus:outline-none focus:border-primary transition-colors"
                    required autoComplete="username" disabled={loading}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2 flex items-center gap-2">
                    <Lock className="w-4 h-4" /> Password
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-2 bg-background-dark border border-gray-600 rounded-lg focus:outline-none focus:border-primary transition-colors"
                    required autoComplete="current-password" disabled={loading}
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading || !username || !password}
                  className="w-full py-3 bg-primary text-on-primary font-bold rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <><div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div> Signing In...</>
                  ) : (
                    <><Key className="w-5 h-5" /> Continue</>
                  )}
                </button>
              </form>
            </>
          )}

          {/* ═══ STEP: 2FA CODE (existing users) ═══ */}
          {step === 'totp' && (
            <>
              <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
                <Shield className="w-6 h-6 text-neon-cyan" />
                Two-Factor Authentication
              </h2>

              {error && (
                <div className="mb-4 p-3 bg-red-500/20 border border-red-500 rounded-lg text-red-300 text-sm">
                  {error}
                </div>
              )}

              <form onSubmit={handleTotpVerify} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2 flex items-center gap-2">
                    <Shield className="w-4 h-4 text-neon-cyan" />
                    {useRecoveryCode ? 'Recovery Code' : '2FA Code'}
                  </label>

                  {!useRecoveryCode ? (
                    <input
                      type="text"
                      value={totpCode}
                      onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      className="w-full px-4 py-2 bg-background-dark border border-gray-600 rounded-lg focus:outline-none focus:border-primary transition-colors text-center text-2xl tracking-widest font-mono"
                      placeholder="000000" maxLength={6} required autoComplete="one-time-code" disabled={loading} autoFocus
                    />
                  ) : (
                    <input
                      type="text"
                      value={recoveryCode}
                      onChange={(e) => setRecoveryCode(e.target.value.toUpperCase())}
                      className="w-full px-4 py-2 bg-background-dark border border-gray-600 rounded-lg focus:outline-none focus:border-primary transition-colors text-center font-mono"
                      placeholder="XXXX-XXXX" required disabled={loading} autoFocus
                    />
                  )}

                  <button
                    type="button"
                    onClick={() => { setUseRecoveryCode(!useRecoveryCode); setTotpCode(''); setRecoveryCode(''); }}
                    className="mt-2 text-sm text-neon-cyan hover:text-neon-cyan/80 transition-colors"
                    disabled={loading}
                  >
                    {useRecoveryCode ? '← Use 2FA Code' : 'Use Recovery Code →'}
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-primary text-on-primary font-bold rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <><div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div> Verifying...</>
                  ) : (
                    <><Shield className="w-5 h-5" /> Verify & Sign In</>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => { setStep('credentials'); setError(''); setTotpCode(''); setRecoveryCode(''); }}
                  className="w-full text-center text-sm text-gray-400 hover:text-white transition-colors"
                >
                  ← Back to login
                </button>
              </form>

              <div className="mt-6 pt-6 border-t border-gray-700">
                <div className="bg-blue-500/10 border border-blue-500/30 p-3 rounded-lg">
                  <p className="text-xs text-gray-300 flex items-start gap-2">
                    <Shield className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
                    <span>Enter the 6-digit code from your authenticator app, or use a recovery code if you've lost access.</span>
                  </p>
                </div>
              </div>
            </>
          )}

          {/* ═══ STEP: 2FA SETUP (new users) ═══ */}
          {step === 'setup2fa' && !showRecoveryCodes && (
            <>
              <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                <Shield className="w-6 h-6 text-neon-cyan" />
                Set Up Two-Factor Auth
              </h2>

              <p className="text-sm text-gray-400 mb-4">
                Scan the QR code with your authenticator app (e.g. Google Authenticator, Authy), then enter the 6-digit code below.
              </p>

              {error && (
                <div className="mb-4 p-3 bg-red-500/20 border border-red-500 rounded-lg text-red-300 text-sm">
                  {error}
                </div>
              )}

              {setupQR && (
                <div className="flex justify-center mb-4">
                  <img src={setupQR} alt="2FA QR Code" className="w-48 h-48 rounded-lg border border-gray-700" />
                </div>
              )}

              <div className="mb-4 p-3 bg-gray-800/50 border border-gray-700 rounded-lg">
                <div className="text-xs text-gray-400 mb-1">Manual entry key:</div>
                <div className="flex items-center gap-2">
                  <code className="text-sm font-mono text-neon-cyan flex-1 break-all">{setupSecret}</code>
                  <button
                    onClick={() => copyToClipboard(setupSecret)}
                    className="text-gray-400 hover:text-white transition-colors p-1"
                    title="Copy secret"
                  >
                    {copiedSecret ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <form onSubmit={handleSetupVerify} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Verification Code</label>
                  <input
                    type="text"
                    value={setupTotpCode}
                    onChange={(e) => setSetupTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    className="w-full px-4 py-2 bg-background-dark border border-gray-600 rounded-lg focus:outline-none focus:border-primary transition-colors text-center text-2xl tracking-widest font-mono"
                    placeholder="000000" maxLength={6} required disabled={loading} autoFocus
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading || setupTotpCode.length !== 6}
                  className="w-full py-3 bg-primary text-on-primary font-bold rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <><div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div> Verifying...</>
                  ) : (
                    <><Check className="w-5 h-5" /> Verify & Enable 2FA</>
                  )}
                </button>
              </form>
            </>
          )}

          {/* ═══ STEP: RECOVERY CODES ═══ */}
          {showRecoveryCodes && (
            <>
              <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                <Key className="w-6 h-6 text-neon-yellow" />
                Recovery Codes
              </h2>

              <div className="mb-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                <p className="text-xs text-yellow-300">
                  <strong>Save these codes!</strong> If you lose access to your authenticator app, you can use these one-time codes to sign in. Each code can only be used once.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2 mb-6">
                {recoveryCodes.map((code, i) => (
                  <div key={i} className="px-3 py-2 bg-gray-800 border border-gray-700 rounded text-center font-mono text-sm text-white">
                    {code}
                  </div>
                ))}
              </div>

              <button
                onClick={() => copyToClipboard(recoveryCodes.join('\n'))}
                className="w-full mb-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-sm text-gray-300 hover:text-white transition-colors flex items-center justify-center gap-2"
              >
                <Copy className="w-4 h-4" />
                {copiedSecret ? 'Copied!' : 'Copy All Codes'}
              </button>

              <button
                onClick={handleSetupDone}
                className="w-full py-3 bg-primary text-on-primary font-bold rounded-lg hover:bg-primary/90 transition-all flex items-center justify-center gap-2"
              >
                <Check className="w-5 h-5" /> I've Saved My Codes — Continue
              </button>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="mt-6 text-center text-sm text-gray-500">
          <p>Nexus v2.2.8 - Dronzer Studios</p>
        </div>
      </div>
    </div>
  );
}

export default Login;
