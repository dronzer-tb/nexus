import { useState } from 'react';
import { Shield, X, AlertTriangle } from 'lucide-react';
import axios from 'axios';

/**
 * Two-Factor Challenge Modal
 * Requires 2FA verification before granting access to sensitive operations (like console)
 * For custom auth system v1.9.5
 */

function TwoFactorChallengeModal({ isOpen, onClose, onSuccess, title = 'Security Verification' }) {
  const [totpCode, setTotpCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [attempts, setAttempts] = useState(0);
  const MAX_ATTEMPTS = 3;

  const handleVerify = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const token = localStorage.getItem('session_token');

      await axios.post('/api/auth/verify-2fa', 
        { totpCode },
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      // Success - call onSuccess callback
      onSuccess();
      
      // Reset state and close
      setTotpCode('');
      setAttempts(0);
      onClose();
    } catch (err) {
      const newAttempts = attempts + 1;
      setAttempts(newAttempts);
      
      if (newAttempts >= MAX_ATTEMPTS) {
        setError(`Maximum attempts exceeded. Access denied for security reasons.`);
        setTimeout(() => {
          onClose();
          setAttempts(0);
          setTotpCode('');
        }, 3000);
      } else {
        setError(err.response?.data?.error || 'Invalid 2FA code. Please try again.');
        setTotpCode('');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setTotpCode('');
    setError('');
    setAttempts(0);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-background-light border-2 border-neon-cyan/50 rounded-lg max-w-md w-full p-6 animate-fadeIn">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-neon-cyan/20 rounded-lg">
              <Shield className="w-6 h-6 text-neon-cyan" />
            </div>
            <h2 className="text-xl font-bold">{title}</h2>
          </div>
          <button
            onClick={handleCancel}
            className="p-1 hover:bg-background-dark rounded transition-colors"
            disabled={loading}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Description */}
        <div className="mb-6">
          <p className="text-gray-300 text-sm">
            This action requires two-factor authentication for security.
          </p>
          <p className="text-gray-400 text-xs mt-2">
            Enter your 6-digit code from your authenticator app.
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-4 p-3 bg-red-500/20 border border-red-500 rounded-lg flex items-start gap-2">
            <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-red-300">
              {error}
              {attempts > 0 && attempts < MAX_ATTEMPTS && (
                <div className="text-xs text-red-400 mt-1">
                  Attempts: {attempts}/{MAX_ATTEMPTS}
                </div>
              )}
            </div>
          </div>
        )}

        {/* 2FA Code Input */}
        <form onSubmit={handleVerify} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">2FA Code</label>
            <input
              type="text"
              value={totpCode}
              onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              className="w-full px-4 py-3 bg-background-dark border border-gray-600 rounded-lg focus:outline-none focus:border-neon-cyan transition-colors text-center text-3xl tracking-widest font-mono"
              placeholder="000000"
              maxLength={6}
              autoFocus
              disabled={loading || attempts >= MAX_ATTEMPTS}
              autoComplete="one-time-code"
            />
          </div>

          {/* Buttons */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleCancel}
              className="flex-1 py-2 px-4 bg-background-dark border border-gray-600 rounded-lg hover:bg-background-dark/70 transition-colors font-medium"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || totpCode.length !== 6 || attempts >= MAX_ATTEMPTS}
              className="flex-1 py-2 px-4 bg-neon-cyan text-black font-bold rounded-lg hover:bg-neon-cyan/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {loading ? (
                <div className="flex items-center justify-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-black border-t-transparent"></div>
                  Verifying...
                </div>
              ) : (
                'Verify & Continue'
              )}
            </button>
          </div>
        </form>

        {/* Info */}
        <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
          <p className="text-xs text-gray-400">
            💡 This extra security step protects sensitive operations like remote command execution.
          </p>
        </div>
      </div>
    </div>
  );
}

export default TwoFactorChallengeModal;
