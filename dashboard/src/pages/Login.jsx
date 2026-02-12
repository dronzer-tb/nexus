import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Shield, Lock, User, Key } from 'lucide-react';

/**
 * Login Page with Mandatory 2FA
 * For custom auth system v1.9.5
 */

function Login() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [useRecoveryCode, setUseRecoveryCode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e) => {
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

      // Store token in localStorage
      localStorage.setItem('session_token', response.data.token);
      
      // Set axios default header
      axios.defaults.headers.common['Authorization'] = `Bearer ${response.data.token}`;

      // Redirect to dashboard
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed. Please try again.');
      
      // Clear 2FA code on error
      setTotpCode('');
      setRecoveryCode('');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background-dark text-white flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo/Header */}
        <div className="text-center mb-8">
          <div className="text-6xl mb-4">🎯</div>
          <h1 className="text-4xl font-bold text-neon-pink mb-2">Nexus</h1>
          <p className="text-gray-400">Remote Resource Monitoring</p>
        </div>

        {/* Login Form */}
        <div className="bg-background-light p-8 rounded-lg border-2 border-gray-800">
          <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
            <Lock className="w-6 h-6 text-neon-pink" />
            Sign In
          </h2>

          {error && (
            <div className="mb-4 p-3 bg-red-500/20 border border-red-500 rounded-lg text-red-300 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            {/* Username */}
            <div>
              <label className="block text-sm font-medium mb-2 flex items-center gap-2">
                <User className="w-4 h-4" />
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-4 py-2 bg-background-dark border border-gray-600 rounded-lg focus:outline-none focus:border-primary transition-colors"
                required
                autoComplete="username"
                disabled={loading}
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium mb-2 flex items-center gap-2">
                <Lock className="w-4 h-4" />
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2 bg-background-dark border border-gray-600 rounded-lg focus:outline-none focus:border-primary transition-colors"
                required
                autoComplete="current-password"
                disabled={loading}
              />
            </div>

            {/* 2FA Code or Recovery Code */}
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
                  placeholder="000000"
                  maxLength={6}
                  required
                  autoComplete="one-time-code"
                  disabled={loading}
                />
              ) : (
                <input
                  type="text"
                  value={recoveryCode}
                  onChange={(e) => setRecoveryCode(e.target.value.toUpperCase())}
                  className="w-full px-4 py-2 bg-background-dark border border-gray-600 rounded-lg focus:outline-none focus:border-primary transition-colors text-center font-mono"
                  placeholder="XXXX-XXXX"
                  required
                  disabled={loading}
                />
              )}

              <button
                type="button"
                onClick={() => {
                  setUseRecoveryCode(!useRecoveryCode);
                  setTotpCode('');
                  setRecoveryCode('');
                }}
                className="mt-2 text-sm text-neon-cyan hover:text-neon-cyan/80 transition-colors"
                disabled={loading}
              >
                {useRecoveryCode ? '← Use 2FA Code' : 'Use Recovery Code →'}
              </button>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading || (!useRecoveryCode && totpCode.length !== 6) || (useRecoveryCode && !recoveryCode)}
              className="w-full py-3 bg-primary text-on-primary font-bold rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                  Signing In...
                </>
              ) : (
                <>
                  <Key className="w-5 h-5" />
                  Sign In
                </>
              )}
            </button>
          </form>

          {/* Info */}
          <div className="mt-6 pt-6 border-t border-gray-700">
            <div className="bg-blue-500/10 border border-blue-500/30 p-3 rounded-lg">
              <p className="text-xs text-gray-300 flex items-start gap-2">
                <Shield className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
                <span>
                  Two-factor authentication is required for all accounts. 
                  Enter your 6-digit code from your authenticator app or use a recovery code if you've lost access.
                </span>
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 text-center text-sm text-gray-500">
          <p>Nexus v1.9.5 - Dronzer Studios</p>
        </div>
      </div>
    </div>
  );
}

export default Login;
