import { useState, useEffect } from 'react';
import { Shield, WarningTriangle, Copy, Check, QrCode } from 'iconoir-react';
import axios from 'axios';

/**
 * Two-Factor Authentication Settings Component
 * Allows users to enable/disable 2FA and view recovery codes
 */

function TwoFactorSettings() {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [qrCode, setQrCode] = useState(null);
  const [secret, setSecret] = useState(null);
  const [recoveryCodes, setRecoveryCodes] = useState([]);
  const [verificationCode, setVerificationCode] = useState('');
  const [setupMode, setSetupMode] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [copiedCode, setCopiedCode] = useState(null);

  useEffect(() => {
    fetchStatus();
  }, []);

  const fetchStatus = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get('/api/auth/2fa/status', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setEnabled(res.data.enabled || false);
    } catch (err) {
      console.error('Failed to fetch 2FA status:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleEnable = async () => {
    setError('');
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.post('/api/auth/2fa/enable', {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (res.data.success) {
        setQrCode(res.data.qrCode);
        setSecret(res.data.secret);
        setSetupMode(true);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to enable 2FA');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    try {
      const token = localStorage.getItem('token');
      const res = await axios.post('/api/auth/2fa/verify-setup', 
        { totpCode: verificationCode },
        { headers: { Authorization: `Bearer ${token}` }}
      );
      
      if (res.data.success) {
        setRecoveryCodes(res.data.recoveryCodes || []);
        setEnabled(true);
        setSuccess('2FA enabled successfully! Save your recovery codes.');
        setVerificationCode('');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Invalid verification code');
    } finally {
      setLoading(false);
    }
  };

  const handleDisable = async () => {
    if (!window.confirm('Are you sure you want to disable 2FA? This will reduce your account security.')) {
      return;
    }

    setError('');
    setLoading(true);
    
    try {
      const token = localStorage.getItem('token');
      const res = await axios.post('/api/auth/2fa/disable', {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (res.data.success) {
        setEnabled(false);
        setSetupMode(false);
        setQrCode(null);
        setSecret(null);
        setRecoveryCodes([]);
        setSuccess('2FA disabled successfully');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to disable 2FA');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text, index) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(index);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  if (loading && !setupMode) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-neon-cyan border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Status */}
      <div className="border-2 border-neon-cyan/20 bg-brutal-card p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield className={`w-8 h-8 ${enabled ? 'text-neon-cyan' : 'text-tx/30'}`} strokeWidth={2.5} />
            <div>
              <h3 className="text-xl font-black uppercase tracking-tight text-tx">
                Two-Factor Authentication
              </h3>
              <p className="text-sm text-tx/60 font-mono mt-1">
                Status: {enabled ? (
                  <span className="text-neon-cyan font-bold">ENABLED</span>
                ) : (
                  <span className="text-tx/40">DISABLED</span>
                )}
              </p>
            </div>
          </div>
          
          {!setupMode && (
            <button
              onClick={enabled ? handleDisable : handleEnable}
              disabled={loading}
              className={`px-4 py-2 border-2 font-bold uppercase text-xs tracking-widest transition-all ${
                enabled
                  ? 'border-red-500/50 text-red-400 hover:bg-red-500/10'
                  : 'border-neon-cyan bg-neon-cyan text-black hover:translate-x-[2px] hover:translate-y-[2px] shadow-brutal-sm hover:shadow-none'
              } disabled:opacity-50`}
            >
              {loading ? 'Processing...' : enabled ? 'Disable 2FA' : 'Enable 2FA'}
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div className="p-4 bg-red-500/10 border-2 border-red-500/50 flex items-start gap-3">
          <WarningTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-300 font-mono">{error}</p>
        </div>
      )}

      {success && (
        <div className="p-4 bg-neon-cyan/10 border-2 border-neon-cyan/50 flex items-start gap-3">
          <Check className="w-5 h-5 text-neon-cyan flex-shrink-0 mt-0.5" />
          <p className="text-sm text-neon-cyan font-mono">{success}</p>
        </div>
      )}

      {/* Setup Mode */}
      {setupMode && qrCode && (
        <div className="border-2 border-neon-cyan/30 bg-brutal-card p-6 space-y-6">
          <h4 className="text-lg font-black uppercase tracking-tight text-tx border-b-2 border-neon-cyan/20 pb-3">
            Setup Two-Factor Authentication
          </h4>

          <div className="grid md:grid-cols-2 gap-6">
            {/* QR Code */}
            <div className="space-y-4">
              <p className="text-sm text-tx/60 font-mono">
                Scan this QR code with your authenticator app:
              </p>
              <div className="bg-white p-4 inline-block border-2 border-neon-cyan/50">
                <img src={qrCode} alt="2FA QR Code" className="w-48 h-48" />
              </div>
            </div>

            {/* Manual Entry */}
            <div className="space-y-4">
              <p className="text-sm text-tx/60 font-mono">
                Or enter this secret key manually:
              </p>
              <div className="bg-brutal-card border-2 border-neon-cyan/20 p-3 font-mono text-sm text-neon-cyan break-all">
                {secret}
              </div>
              <button
                onClick={() => copyToClipboard(secret, 'secret')}
                className="flex items-center gap-2 px-3 py-2 border-2 border-tx/20 text-tx/60 hover:text-tx hover:border-tx/40 transition-all text-xs font-bold uppercase tracking-wider"
              >
                {copiedCode === 'secret' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copiedCode === 'secret' ? 'Copied!' : 'Copy Secret'}
              </button>

              <div className="pt-4 border-t-2 border-neon-cyan/10">
                <p className="text-xs text-tx/40 font-mono mb-2 uppercase tracking-wide">
                  Recommended Apps:
                </p>
                <ul className="text-xs text-tx/60 font-mono space-y-1">
                  <li>• Google Authenticator</li>
                  <li>• Authy</li>
                  <li>• Microsoft Authenticator</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Verification */}
          <form onSubmit={handleVerify} className="space-y-4 border-t-2 border-neon-cyan/20 pt-6">
            <label className="block">
              <span className="text-sm font-bold text-tx/60 uppercase tracking-wider mb-2 block">
                Enter 6-Digit Code to Verify
              </span>
              <input
                type="text"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="w-full px-4 py-3 bg-brutal-card border-2 border-neon-cyan/30 focus:outline-none focus:border-neon-cyan transition-all text-center text-2xl tracking-[0.5em] font-mono text-neon-cyan font-bold"
                placeholder="000000"
                maxLength={6}
                autoFocus
              />
            </label>
            <button
              type="submit"
              disabled={loading || verificationCode.length !== 6}
              className="w-full py-3 bg-neon-cyan border-2 border-neon-cyan font-black uppercase text-sm tracking-widest hover:translate-x-[2px] hover:translate-y-[2px] shadow-brutal-sm hover:shadow-none disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              style={{ color: 'var(--on-neon-cyan)' }}
            >
              {loading ? 'Verifying...' : 'Verify & Enable'}
            </button>
          </form>
        </div>
      )}

      {/* Recovery Codes */}
      {recoveryCodes.length > 0 && (
        <div className="border-2 border-neon-yellow/30 bg-neon-yellow/5 p-6 space-y-4">
          <div className="flex items-start gap-3">
            <WarningTriangle className="w-6 h-6 text-neon-yellow flex-shrink-0" />
            <div className="flex-1">
              <h4 className="text-lg font-black uppercase tracking-tight text-neon-yellow mb-2">
                Save Your Recovery Codes
              </h4>
              <p className="text-sm text-tx/70 font-mono mb-4">
                Store these codes in a safe place. Each can be used once if you lose access to your authenticator app.
              </p>
              
              <div className="grid grid-cols-2 gap-2 mb-4">
                {recoveryCodes.map((code, index) => (
                  <div key={index} className="bg-brutal-card border-2 border-neon-yellow/20 p-2 flex items-center justify-between">
                    <span className="font-mono text-sm text-tx">{code}</span>
                    <button
                      onClick={() => copyToClipboard(code, index)}
                      className="p-1 hover:bg-neon-yellow/10 transition-colors"
                    >
                      {copiedCode === index ? (
                        <Check className="w-4 h-4 text-neon-cyan" />
                      ) : (
                        <Copy className="w-4 h-4 text-tx/40" />
                      )}
                    </button>
                  </div>
                ))}
              </div>

              <button
                onClick={() => {
                  const text = recoveryCodes.join('\n');
                  const blob = new Blob([text], { type: 'text/plain' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = 'nexus-recovery-codes.txt';
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                className="flex items-center gap-2 px-4 py-2 bg-neon-yellow border-2 border-neon-yellow font-bold uppercase text-xs tracking-widest transition-all hover:translate-x-[2px] hover:translate-y-[2px] shadow-brutal-sm hover:shadow-none"
                style={{ color: 'var(--on-neon-yellow)' }}
              >
                <Copy className="w-4 h-4" />
                Download All Codes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Info */}
      {!setupMode && enabled && (
        <div className="p-4 bg-neon-cyan/5 border-2 border-neon-cyan/20">
          <p className="text-xs text-tx/50 font-mono">
            Two-factor authentication is enabled for your account. You'll need to enter a code from your authenticator app when logging in.
          </p>
        </div>
      )}
    </div>
  );
}

export default TwoFactorSettings;
