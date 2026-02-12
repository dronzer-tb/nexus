'use client'

import { useState, useEffect } from 'react';
import { Shield, Check, X, RefreshCw, Copy, AlertTriangle } from 'lucide-react';
import axios from 'axios';

function TwoFactorSettings() {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [setupMode, setSetupMode] = useState(false);
  const [qrCode, setQrCode] = useState('');
  const [secret, setSecret] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [recoveryCodes, setRecoveryCodes] = useState([]);
  const [showRecoveryCodes, setShowRecoveryCodes] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [copiedCode, setCopiedCode] = useState(null);

  useEffect(() => {
    fetchStatus();
  }, []);

  const fetchStatus = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('/api/2fa/status', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setEnabled(response.data.enabled);
    } catch (err) {
      console.error('Failed to fetch 2FA status:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSetup = async () => {
    try {
      setError('');
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await axios.post('/api/2fa/setup', {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setQrCode(response.data.qrCode);
      setSecret(response.data.secret);
      setSetupMode(true);
      setSuccess(response.data.recommendation);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to setup 2FA');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    try {
      setError('');
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await axios.post('/api/2fa/verify', 
        { token: verificationCode },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      setRecoveryCodes(response.data.recoveryCodes);
      setShowRecoveryCodes(true);
      setEnabled(true);
      setSetupMode(false);
      setSuccess('Two-factor authentication enabled successfully!');
    } catch (err) {
      setError(err.response?.data?.error || 'Invalid verification code');
    } finally {
      setLoading(false);
    }
  };

  const handleDisable = async () => {
    if (!confirm('Are you sure you want to disable two-factor authentication? This will make your account less secure.')) {
      return;
    }

    const code = prompt('Enter your current 6-digit authentication code to disable 2FA:');
    if (!code) return;

    try {
      setError('');
      setLoading(true);
      const token = localStorage.getItem('token');
      await axios.post('/api/2fa/disable', 
        { token: code },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      setEnabled(false);
      setSuccess('Two-factor authentication disabled');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to disable 2FA');
    } finally {
      setLoading(false);
    }
  };

  const handleRegenerateCodes = async () => {
    const code = prompt('Enter your current 6-digit authentication code to regenerate recovery codes:');
    if (!code) return;

    try {
      setError('');
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await axios.post('/api/2fa/regenerate-codes',
        { token: code },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      setRecoveryCodes(response.data.recoveryCodes);
      setShowRecoveryCodes(true);
      setSuccess('Recovery codes regenerated successfully!');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to regenerate codes');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text, index) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(index);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const downloadRecoveryCodes = () => {
    const text = `Nexus Recovery Codes\nGenerated: ${new Date().toISOString()}\n\n${recoveryCodes.join('\n')}\n\nKeep these codes in a safe place. Each code can only be used once.`;
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'nexus-recovery-codes.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading && !setupMode) {
    return <div className="text-tx/50">Loading 2FA settings...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <Shield className="w-6 h-6 text-neon-cyan" />
            <h3 className="font-bold text-lg uppercase tracking-wider text-tx">Two-Factor Authentication</h3>
          </div>
          <p className="text-sm text-tx/50 mt-2">
            Add an extra layer of security to your account with TOTP-based 2FA.
          </p>
        </div>
        <div className={`px-3 py-1 text-xs font-bold uppercase tracking-wider border-2 ${
          enabled 
            ? 'border-neon-cyan/40 text-neon-cyan bg-neon-cyan/10' 
            : 'border-tx/20 text-tx/40 bg-tx/5'
        }`}>
          {enabled ? '✓ ENABLED' : '○ DISABLED'}
        </div>
      </div>

      {/* Error/Success Messages */}
      {error && (
        <div className="border-2 border-red-500/40 bg-red-500/10 p-4 text-red-400 text-sm">
          <div className="flex items-center gap-2">
            <X className="w-4 h-4" />
            <span>{error}</span>
          </div>
        </div>
      )}
      
      {success && (
        <div className="border-2 border-neon-cyan/40 bg-neon-cyan/10 p-4 text-neon-cyan text-sm">
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4" />
            <span>{success}</span>
          </div>
        </div>
      )}

      {/* Setup Mode */}
      {setupMode && (
        <div className="border-2 border-neon-cyan/20 bg-brutal-card p-6 space-y-4">
          <h4 className="font-bold uppercase text-sm text-neon-cyan">Setup Two-Factor Authentication</h4>
          
          <div className="space-y-4">
            <div className="bg-white p-4 inline-block border-2 border-neon-cyan/20">
              <img src={qrCode} alt="QR Code" className="w-48 h-48" />
            </div>
            
            <div className="space-y-2">
              <p className="text-sm text-tx/70">
                <strong className="text-neon-cyan">Recommended:</strong> Use <span className="text-neon-pink font-bold">Proton Pass Authenticator</span>
              </p>
              <p className="text-xs text-tx/50">
                Proton Pass offers encrypted cloud backup, cross-device sync, and enhanced security for your 2FA codes.
              </p>
            </div>

            <div className="space-y-2">
              <p className="text-xs text-tx/50 font-bold uppercase">Or enter this secret manually:</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 px-3 py-2 bg-brutal-bg border-2 border-tx/10 font-mono text-sm text-tx">
                  {secret}
                </code>
                <button
                  onClick={() => copyToClipboard(secret, 'secret')}
                  className="p-2 border-2 border-neon-cyan/40 bg-neon-cyan/10 text-neon-cyan hover:bg-neon-cyan/20 transition-all"
                >
                  {copiedCode === 'secret' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-2 pt-4 border-t-2 border-tx/10">
              <label className="block text-sm font-bold text-tx/70 uppercase">
                Enter verification code from your authenticator:
              </label>
              <input
                type="text"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="w-full px-4 py-3 bg-brutal-bg border-2 border-neon-cyan/20 text-tx font-mono text-center text-2xl tracking-widest focus:outline-none focus:border-neon-cyan"
                placeholder="000000"
                maxLength="6"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleVerify}
                disabled={loading || verificationCode.length !== 6}
                className="flex-1 px-4 py-2 bg-neon-cyan text-brutal-bg font-bold uppercase text-sm hover:bg-neon-cyan/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {loading ? 'Verifying...' : 'Enable 2FA'}
              </button>
              <button
                onClick={() => { setSetupMode(false); setError(''); setSuccess(''); }}
                className="px-4 py-2 border-2 border-tx/20 text-tx/70 font-bold uppercase text-sm hover:bg-tx/5 transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Recovery Codes Display */}
      {showRecoveryCodes && recoveryCodes.length > 0 && (
        <div className="border-2 border-neon-pink/40 bg-neon-pink/10 p-6 space-y-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-neon-pink flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="font-bold uppercase text-sm text-neon-pink mb-2">Save Your Recovery Codes</h4>
              <p className="text-xs text-tx/70">
                Store these codes in a safe place. You can use them to access your account if you lose your authenticator device. Each code can only be used once.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {recoveryCodes.map((code, index) => (
              <div key={index} className="flex items-center gap-2 bg-brutal-bg p-2 border-2 border-tx/10">
                <code className="flex-1 font-mono text-sm text-tx">{code}</code>
                <button
                  onClick={() => copyToClipboard(code, index)}
                  className="p-1 text-neon-cyan hover:text-neon-pink transition-colors"
                >
                  {copiedCode === index ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            ))}
          </div>

          <div className="flex gap-3">
            <button
              onClick={downloadRecoveryCodes}
              className="flex-1 px-4 py-2 bg-neon-pink text-brutal-bg font-bold uppercase text-sm hover:bg-neon-pink/90 transition-all"
            >
              Download Codes
            </button>
            <button
              onClick={() => setShowRecoveryCodes(false)}
              className="px-4 py-2 border-2 border-tx/20 text-tx/70 font-bold uppercase text-sm hover:bg-tx/5 transition-all"
            >
              I&apos;ve Saved Them
            </button>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      {!setupMode && (
        <div className="flex gap-3">
          {!enabled ? (
            <button
              onClick={handleSetup}
              disabled={loading}
              className="px-6 py-3 bg-neon-cyan text-brutal-bg font-bold uppercase text-sm hover:bg-neon-cyan/90 disabled:opacity-50 transition-all flex items-center gap-2"
            >
              <Shield className="w-4 h-4" />
              Enable Two-Factor Authentication
            </button>
          ) : (
            <>
              <button
                onClick={handleRegenerateCodes}
                disabled={loading}
                className="px-6 py-3 border-2 border-neon-cyan/40 bg-neon-cyan/10 text-neon-cyan font-bold uppercase text-sm hover:bg-neon-cyan/20 disabled:opacity-50 transition-all flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Regenerate Recovery Codes
              </button>
              <button
                onClick={handleDisable}
                disabled={loading}
                className="px-6 py-3 border-2 border-red-500/40 bg-red-500/10 text-red-400 font-bold uppercase text-sm hover:bg-red-500/20 disabled:opacity-50 transition-all flex items-center gap-2"
              >
                <X className="w-4 h-4" />
                Disable 2FA
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default TwoFactorSettings;
