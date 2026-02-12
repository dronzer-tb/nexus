import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Shield, Check, X } from 'lucide-react';
import axios from 'axios';

function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [totpToken, setTotpToken] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [requires2FA, setRequires2FA] = useState(false);
  const [useRecoveryCode, setUseRecoveryCode] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetUsername, setResetUsername] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetStep, setResetStep] = useState(1); // 1: request code, 2: enter code & password
  const [resetSuccess, setResetSuccess] = useState('');
  const navigate = useNavigate();
  const { login, loginWithAuthentik, handleAuthentikCallback, isAuthentik, isAuthenticated, authentikConfig } = useAuth();

  // Redirect if already authenticated
  useEffect(() => {
    console.log('Login useEffect: isAuthenticated =', isAuthenticated);
    if (isAuthenticated) {
      console.log('Login useEffect: Navigating to /');
      navigate('/', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  // Handle OAuth callback
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const state = params.get('state');
    
    if (code && state && handleAuthentikCallback) {
      setLoading(true);
      handleAuthentikCallback(code, state).then(result => {
        if (result.success) {
          navigate('/');
        } else {
          setError('OAuth authentication failed: ' + result.error);
          setLoading(false);
          // Clean up URL
          window.history.replaceState({}, document.title, '/login');
        }
      });
    }
  }, [handleAuthentikCallback, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    console.log('=== FORM SUBMIT CLICKED ===');
    setError('');
    setLoading(true);

    console.log('Login: Calling login function with username:', username);
    const result = await login(username, password, totpToken, recoveryCode);
    console.log('Login: Result received =', result);
    
    if (!result.success) {
      console.error('Login: Failed with error:', result.error);
      setError(result.error);
      setLoading(false);
      
      // Check if 2FA is required
      if (result.requires2FA) {
        setRequires2FA(true);
      }
    } else {
      console.log('Login: Success! Waiting for redirect...');
    }
    // Don't navigate here - let the useEffect handle it when isAuthenticated changes
  };

  const handleRequestCode = async (e) => {
    e.preventDefault();
    setError('');
    setResetSuccess('');
    setLoading(true);

    try {
      await axios.post('/api/password-reset/request', { username: resetUsername });
      setResetSuccess('If an account with that username exists, a reset code has been generated. Ask your administrator to check the server console for the code.');
      setResetStep(2);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to generate reset code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError('');
    setResetSuccess('');

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);

    try {
      await axios.post('/api/password-reset/reset', {
        username: resetUsername,
        code: resetCode,
        newPassword
      });
      setResetSuccess('Password reset successful! You can now login with your new password.');
      setTimeout(() => {
        setShowForgotPassword(false);
        setResetStep(1);
        setResetUsername('');
        setResetCode('');
        setNewPassword('');
        setConfirmPassword('');
        setError('');
        setResetSuccess('');
      }, 2000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to reset password. Please check your code and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center overflow-hidden p-4 bg-background-dark">
      <div className="absolute inset-0 bg-background-dark opacity-50 z-0"></div>
      <div className="absolute -top-1/2 -left-1/2 w-full h-full bg-primary/10 rounded-full animate-pulse blur-3xl"></div>
      <div className="absolute -bottom-1/2 -right-1/2 w-3/4 h-3/4 bg-primary/20 rounded-full animate-pulse blur-3xl" style={{ animationDelay: '500ms' }}></div>
      
      <main className="relative z-10 w-full max-w-md p-8 space-y-8 bg-background-light/10 backdrop-blur-sm border border-primary/20 rounded-xl shadow-2xl">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-tx drop-shadow-lg">
            <span className="text-primary">NEXUS</span>
          </h1>
          <p className="mt-2 text-gray-300">System Monitoring &amp; Management</p>
        </div>
        
        {!showForgotPassword ? (
          <form className="space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="bg-red-500/20 border border-red-500/50 text-red-300 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}
          
          <div>
            <label htmlFor="username" className="sr-only">Username</label>
            <input
              id="username"
              name="username"
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-3 bg-background-light/20 border border-primary/30 rounded-lg text-tx placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-300"
              placeholder="Username"
              disabled={loading}
            />
          </div>
          
          <div>
            <label htmlFor="password" className="sr-only">Password</label>
            <input
              id="password"
              name="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 bg-background-light/20 border border-primary/30 rounded-lg text-tx placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-300"
              placeholder="Password"
              disabled={loading}
            />
          </div>
          
          {requires2FA && (
            <div className="border-t border-primary/20 pt-4 space-y-4">
              <div className="flex items-center gap-2 text-primary">
                <Shield className="w-5 h-5" />
                <span className="font-bold text-sm">Two-Factor Authentication Required</span>
              </div>
              
              {!useRecoveryCode ? (
                <>
                  <div>
                    <label htmlFor="totpToken" className="sr-only">Authentication Code</label>
                    <input
                      id="totpToken"
                      name="totpToken"
                      type="text"
                      required={requires2FA}
                      value={totpToken}
                      onChange={(e) => setTotpToken(e.target.value)}
                      className="w-full px-4 py-3 bg-background-light/20 border border-primary/30 rounded-lg text-tx placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-300 font-mono text-center text-xl tracking-widest"
                      placeholder="000000"
                      maxLength="6"
                      autoComplete="off"
                      disabled={loading}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setUseRecoveryCode(true)}
                    className="text-sm text-primary/70 hover:text-primary transition-colors"
                  >
                    Use recovery code instead
                  </button>
                </>
              ) : (
                <>
                  <div>
                    <label htmlFor="recoveryCode" className="sr-only">Recovery Code</label>
                    <input
                      id="recoveryCode"
                      name="recoveryCode"
                      type="text"
                      required={requires2FA}
                      value={recoveryCode}
                      onChange={(e) => setRecoveryCode(e.target.value.toUpperCase())}
                      className="w-full px-4 py-3 bg-background-light/20 border border-primary/30 rounded-lg text-tx placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-300 font-mono text-center"
                      placeholder="XXXXXXXX"
                      maxLength="8"
                      autoComplete="off"
                      disabled={loading}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setUseRecoveryCode(false)}
                    className="text-sm text-primary/70 hover:text-primary transition-colors"
                  >
                    Use authenticator code instead
                  </button>
                </>
              )}
            </div>
          )}
          
          <div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 bg-primary font-bold rounded-lg hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-background-dark focus:ring-primary transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed glow"
              style={{ color: 'var(--on-primary)' }}
            >
              {loading ? 'Logging in...' : 'Login'}
            </button>

            {/* Authentik OAuth2 Login */}
            {authentikConfig && (
              <>
                <div className="relative my-4">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-600"></div>
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-2 bg-background-dark text-gray-400">OR</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={loginWithAuthentik}
                  disabled={loading}
                  className="w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-purple-600 font-bold rounded-lg hover:from-blue-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-background-dark focus:ring-blue-500 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <Shield className="w-5 h-5" />
                  Login with Authentik
                </button>
              </>
            )}
          </div>

          <div className="text-center">
            <button
              type="button"
              onClick={() => setShowForgotPassword(true)}
              className="text-sm text-primary/70 hover:text-primary transition-colors"
            >
              Forgot password?
            </button>
          </div>
        </form>
        ) : (
          resetStep === 1 ? (
            <form className="space-y-6" onSubmit={handleRequestCode}>
              <div className="text-center mb-4">
                <Shield className="w-12 h-12 text-primary mx-auto mb-2" />
                <h2 className="text-xl font-bold text-tx">Reset Password</h2>
                <p className="text-sm text-gray-400 mt-1">Enter your username to generate a reset code</p>
              </div>

              {error && (
                <div className="bg-red-500/20 border border-red-500/50 text-red-300 px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              )}

              {resetSuccess && (
                <div className="bg-green-500/20 border border-green-500/50 text-green-300 px-4 py-3 rounded-lg text-sm">
                  {resetSuccess}
                </div>
              )}

              <div>
                <label htmlFor="reset-username" className="sr-only">Username</label>
                <input
                  id="reset-username"
                  name="username"
                  type="text"
                  required
                  value={resetUsername}
                  onChange={(e) => setResetUsername(e.target.value)}
                  className="w-full px-4 py-3 bg-background-light/20 border border-primary/30 rounded-lg text-tx placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-300"
                  placeholder="Enter your username"
                  disabled={loading}
                />
              </div>

              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={loading || !resetUsername}
                  className="flex-1 py-3 px-4 bg-primary font-bold rounded-lg hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-background-dark focus:ring-primary transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed glow"
                  style={{ color: 'var(--on-primary)' }}
                >
                  {loading ? 'Generating...' : 'Generate Reset Code'}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowForgotPassword(false); setError(''); setResetSuccess(''); setResetUsername(''); setResetStep(1); }}
                  disabled={loading}
                  className="px-4 py-3 border border-primary/30 text-tx font-bold rounded-lg hover:bg-background-light/10 transition-all duration-300 disabled:opacity-50"
                >
                  Back
                </button>
              </div>
            </form>
          ) : (
            <form className="space-y-6" onSubmit={handleResetPassword}>
              <div className="text-center mb-4">
                <Shield className="w-12 h-12 text-primary mx-auto mb-2" />
                <h2 className="text-xl font-bold text-tx">Enter Reset Code</h2>
                <p className="text-sm text-gray-400 mt-1">Enter the 6-digit code from the server console</p>
              </div>

              {error && (
                <div className="bg-red-500/20 border border-red-500/50 text-red-300 px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              )}

              {resetSuccess && (
                <div className="bg-green-500/20 border border-green-500/50 text-green-300 px-4 py-3 rounded-lg text-sm">
                  {resetSuccess}
                </div>
              )}

              <div>
                <label htmlFor="reset-code" className="block text-sm font-medium text-gray-300 mb-2">Reset Code</label>
                <input
                  id="reset-code"
                  name="code"
                  type="text"
                  required
                  value={resetCode}
                  onChange={(e) => setResetCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="w-full px-4 py-3 bg-background-light/20 border border-primary/30 rounded-lg text-tx placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-300 font-mono text-center text-2xl tracking-widest"
                  placeholder="000000"
                  maxLength="6"
                  disabled={loading}
                />
              </div>

              <div>
                <label htmlFor="new-password" className="block text-sm font-medium text-gray-300 mb-2">New Password</label>
                <input
                  id="new-password"
                  name="newPassword"
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-background-light/20 border border-primary/30 rounded-lg text-tx placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-300"
                  placeholder="Enter new password (min. 8 characters)"
                  disabled={loading}
                />
              </div>

              <div>
                <label htmlFor="confirm-password" className="block text-sm font-medium text-gray-300 mb-2">Confirm Password</label>
                <input
                  id="confirm-password"
                  name="confirmPassword"
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-background-light/20 border border-primary/30 rounded-lg text-tx placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-300"
                  placeholder="Confirm new password"
                  disabled={loading}
                />
              </div>

              {newPassword && confirmPassword && (
                <div className="text-sm">
                  {newPassword === confirmPassword ? (
                    <p className="text-green-400 flex items-center gap-2">
                      <Check className="w-4 h-4" />
                      Passwords match
                    </p>
                  ) : (
                    <p className="text-red-400 flex items-center gap-2">
                      <X className="w-4 h-4" />
                      Passwords do not match
                    </p>
                  )}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={loading || !resetCode || !newPassword || !confirmPassword || newPassword !== confirmPassword}
                  className="flex-1 py-3 px-4 bg-primary font-bold rounded-lg hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-background-dark focus:ring-primary transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed glow"
                  style={{ color: 'var(--on-primary)' }}
                >
                  {loading ? 'Resetting...' : 'Reset Password'}
                </button>
                <button
                  type="button"
                  onClick={() => { setResetStep(1); setResetCode(''); setNewPassword(''); setConfirmPassword(''); setError(''); }}
                  disabled={loading}
                  className="px-4 py-3 border border-primary/30 text-tx font-bold rounded-lg hover:bg-background-light/10 transition-all duration-300 disabled:opacity-50"
                >
                  Back
                </button>
              </div>
            </form>
          )
        )}
      </main>
      
      <footer className="absolute bottom-4 text-center w-full text-gray-400 text-sm z-10">
        <p>Powered by Dronzer Studios</p>
      </footer>
    </div>
  );
}

export default Login;
