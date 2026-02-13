import { useState } from 'react';
import { Shield, Xmark, WarningTriangle } from 'iconoir-react';
import axios from 'axios';

/**
 * Two-Factor Verification Modal
 * Used for verifying 2FA before sensitive operations (console access, etc.)
 * Phase 6: Console 2FA Protection
 */

function TwoFactorVerifyModal({ 
  isOpen, 
  onClose, 
  onVerified, 
  title = 'Security Verification',
  description = 'This action requires two-factor authentication for security.'
}) {
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
      const token = localStorage.getItem('token');

      const response = await axios.post('/api/auth/verify-2fa', 
        { totpCode },
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      if (response.data.success) {
        // Success - call onVerified callback
        onVerified({ totpCode, verified: true });
        
        // Reset state and close
        setTotpCode('');
        setAttempts(0);
        setError('');
      }
    } catch (err) {
      const newAttempts = attempts + 1;
      setAttempts(newAttempts);
      
      if (newAttempts >= MAX_ATTEMPTS) {
        setError(`Maximum attempts exceeded. Access denied for security reasons.`);
        setTimeout(() => {
          onClose();
          setAttempts(0);
          setTotpCode('');
          setError('');
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
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-brutal-card border-[3px] border-neon-cyan/50 max-w-md w-full p-6 shadow-brutal-cyan animate-fadeIn">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 border-b-2 border-neon-cyan/20 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-neon-cyan/20 border-2 border-neon-cyan/40">
              <Shield className="w-6 h-6 text-neon-cyan" strokeWidth={2.5} />
            </div>
            <h2 className="text-xl font-black uppercase tracking-tight text-tx">{title}</h2>
          </div>
          <button
            onClick={handleCancel}
            className="p-1 hover:bg-tx/5 transition-colors"
            disabled={loading}
          >
            <Xmark className="w-5 h-5 text-tx/60 hover:text-neon-pink" />
          </button>
        </div>

        {/* Description */}
        <div className="mb-6">
          <p className="text-tx/70 text-sm font-mono">
            {description}
          </p>
          <p className="text-tx/40 text-xs mt-2 font-mono uppercase tracking-wide">
            Enter your 6-digit code from your authenticator app.
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border-2 border-red-500/50 flex items-start gap-2">
            <WarningTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" strokeWidth={2.5} />
            <div className="text-sm text-red-300 font-mono">
              {error}
              {attempts > 0 && attempts < MAX_ATTEMPTS && (
                <div className="text-xs text-red-400 mt-1 uppercase tracking-wider">
                  Attempts: {attempts}/{MAX_ATTEMPTS}
                </div>
              )}
            </div>
          </div>
        )}

        {/* 2FA Code Input */}
        <form onSubmit={handleVerify} className="space-y-4">
          <div>
            <label className="block text-sm font-bold mb-2 text-tx/60 uppercase tracking-wider">
              2FA Code
            </label>
            <input
              type="text"
              value={totpCode}
              onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              className="w-full px-4 py-3 bg-brutal-card border-2 border-neon-cyan/30 focus:outline-none focus:border-neon-cyan transition-all text-center text-3xl tracking-[0.5em] font-mono text-neon-cyan font-bold shadow-brutal-sm"
              placeholder="000000"
              maxLength={6}
              autoFocus
              disabled={loading || attempts >= MAX_ATTEMPTS}
              autoComplete="one-time-code"
            />
          </div>

          {/* Buttons */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={handleCancel}
              className="flex-1 py-2 px-4 border-2 border-tx/20 text-tx/60 hover:text-tx hover:border-tx/40 transition-all font-bold uppercase text-xs tracking-widest shadow-brutal-sm hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || totpCode.length !== 6 || attempts >= MAX_ATTEMPTS}
              className="flex-1 py-2 px-4 bg-neon-cyan border-2 border-neon-cyan font-black uppercase text-xs tracking-widest hover:translate-x-[2px] hover:translate-y-[2px] shadow-brutal-sm hover:shadow-none disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              style={{ color: 'var(--on-neon-cyan)' }}
            >
              {loading ? (
                <div className="flex items-center justify-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-current border-t-transparent"></div>
                  Verifying...
                </div>
              ) : (
                'Verify & Continue'
              )}
            </button>
          </div>
        </form>

        {/* Info */}
        <div className="mt-4 p-3 bg-neon-cyan/5 border-2 border-neon-cyan/20">
          <p className="text-xs text-tx/50 font-mono">
            💡 This extra security step protects sensitive operations like remote command execution.
          </p>
        </div>
      </div>
    </div>
  );
}

export default TwoFactorVerifyModal;
