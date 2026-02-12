'use client'

import { useState } from 'react';
import { Shield, X, AlertTriangle } from 'lucide-react';
import axios from 'axios';

/**
 * Reusable 2FA verification modal
 * Used to protect sensitive actions like console access, uninstallation, etc.
 */
function TwoFactorVerifyModal({ isOpen, onClose, onVerified, title = "Two-Factor Authentication Required", description = "Enter your 6-digit authentication code to continue." }) {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [useRecoveryCode, setUseRecoveryCode] = useState(false);

  const handleVerify = async () => {
    if (!code || (code.length !== 6 && !useRecoveryCode) || (code.length !== 8 && useRecoveryCode)) {
      setError(useRecoveryCode ? 'Recovery code must be 8 characters' : 'Code must be 6 digits');
      return;
    }

    setError('');
    setLoading(true);

    try {
      // Call the onVerified callback with the code
      // The parent component will handle the actual verification
      await onVerified(useRecoveryCode ? { recoveryCode: code } : { totpToken: code });
      
      // Close modal on success
      handleClose();
    } catch (err) {
      setError(err.message || 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setCode('');
    setError('');
    setUseRecoveryCode(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="relative w-full max-w-md border-4 border-neon-cyan/40 bg-brutal-bg p-8 shadow-brutal">
        {/* Close button */}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 p-2 text-tx/50 hover:text-neon-pink transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-3">
            <Shield className="w-8 h-8 text-neon-cyan" />
            <h2 className="text-2xl font-black uppercase tracking-tight text-tx">{title}</h2>
          </div>
          <p className="text-sm text-tx/60">{description}</p>
        </div>

        {/* Error message */}
        {error && (
          <div className="mb-4 border-2 border-red-500/40 bg-red-500/10 p-3 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
            <span className="text-sm text-red-400">{error}</span>
          </div>
        )}

        {/* Input */}
        {!useRecoveryCode ? (
          <>
            <div className="mb-4">
              <label className="block text-xs font-bold uppercase text-tx/70 mb-2">
                Authentication Code
              </label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="w-full px-4 py-3 bg-brutal-card border-2 border-neon-cyan/20 text-tx font-mono text-center text-2xl tracking-widest focus:outline-none focus:border-neon-cyan"
                placeholder="000000"
                maxLength="6"
                autoFocus
                onKeyPress={(e) => e.key === 'Enter' && handleVerify()}
              />
            </div>
            <button
              type="button"
              onClick={() => { setUseRecoveryCode(true); setCode(''); setError(''); }}
              className="text-sm text-neon-cyan/70 hover:text-neon-cyan transition-colors mb-4"
            >
              Use recovery code instead
            </button>
          </>
        ) : (
          <>
            <div className="mb-4">
              <label className="block text-xs font-bold uppercase text-tx/70 mb-2">
                Recovery Code
              </label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8))}
                className="w-full px-4 py-3 bg-brutal-card border-2 border-neon-cyan/20 text-tx font-mono text-center text-xl tracking-wider focus:outline-none focus:border-neon-cyan"
                placeholder="XXXXXXXX"
                maxLength="8"
                autoFocus
                onKeyPress={(e) => e.key === 'Enter' && handleVerify()}
              />
            </div>
            <button
              type="button"
              onClick={() => { setUseRecoveryCode(false); setCode(''); setError(''); }}
              className="text-sm text-neon-cyan/70 hover:text-neon-cyan transition-colors mb-4"
            >
              Use authenticator code instead
            </button>
          </>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={handleVerify}
            disabled={loading || !code || (code.length !== 6 && !useRecoveryCode) || (code.length !== 8 && useRecoveryCode)}
            className="flex-1 px-4 py-3 bg-neon-cyan text-brutal-bg font-bold uppercase text-sm hover:bg-neon-cyan/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {loading ? 'Verifying...' : 'Verify'}
          </button>
          <button
            onClick={handleClose}
            disabled={loading}
            className="px-4 py-3 border-2 border-tx/20 text-tx/70 font-bold uppercase text-sm hover:bg-tx/5 disabled:opacity-50 transition-all"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

export default TwoFactorVerifyModal;
