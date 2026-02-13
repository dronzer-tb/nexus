import { useState } from 'react';
import { Trash, WarningTriangle, Download, Shield } from 'iconoir-react';
import axios from 'axios';
import TwoFactorVerifyModal from './TwoFactorVerifyModal';

function UninstallSettings() {
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [show2FAModal, setShow2FAModal] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleUninstallRequest = () => {
    setShowConfirm(true);
  };

  const handleConfirmUninstall = () => {
    if (confirmText !== 'DELETE ALL DATA') {
      setError('Please type "DELETE ALL DATA" exactly as shown');
      return;
    }
    
    // Show 2FA modal
    setShow2FAModal(true);
    setShowConfirm(false);
  };

  const handle2FAVerified = async (credentials) => {
    setLoading(true);
    setError('');

    try {
      const token = localStorage.getItem('token');
      
      // Call uninstall endpoint with 2FA credentials
      const response = await axios.post('/api/system/uninstall', credentials, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data.success) {
        // Show success message and instructions
        alert('Uninstallation initiated successfully!\n\nNext steps:\n1. The server will shut down in 10 seconds\n2. Run the uninstall script on the server:\n   bash uninstall.sh\n\nAll data will be permanently deleted.');
        
        // Log out and redirect
        localStorage.removeItem('token');
        window.location.href = '/login';
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to initiate uninstallation');
      throw new Error(err.response?.data?.error || 'Failed to initiate uninstallation');
    } finally {
      setLoading(false);
    }
  };

  const downloadUninstallScript = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('/api/system/uninstall-script', {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'uninstall.sh');
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      setError('Failed to download uninstall script');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <Trash className="w-6 h-6 text-red-400" />
            <h3 className="font-bold text-lg uppercase tracking-wider text-tx">Uninstall Nexus</h3>
          </div>
          <p className="text-sm text-tx/50 mt-2">
            Permanently remove Nexus from your system. This action cannot be undone.
          </p>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="border-4 border-red-500/40 bg-red-500/5 p-6 space-y-4">
        <div className="flex items-start gap-3">
          <WarningTriangle className="w-6 h-6 text-red-400 flex-shrink-0" />
          <div className="flex-1">
            <h4 className="font-bold uppercase text-sm text-red-400 mb-2">⚠️ Danger Zone</h4>
            <p className="text-sm text-tx/70 mb-4">
              Uninstalling Nexus will permanently delete:
            </p>
            <ul className="text-sm text-tx/60 space-y-1 list-disc list-inside mb-4">
              <li>All node configurations and metrics</li>
              <li>User accounts and authentication data</li>
              <li>API keys and access tokens</li>
              <li>Historical monitoring data</li>
              <li>System configuration and themes</li>
              <li>Database files (nexus.db)</li>
            </ul>
            <div className="bg-brutal-bg border-2 border-red-500/20 p-4 space-y-2">
              <p className="text-xs font-bold text-neon-cyan uppercase">Before uninstalling:</p>
              <ol className="text-xs text-tx/60 space-y-1 list-decimal list-inside">
                <li>Download the uninstall script using the button below</li>
                <li>Backup any important data manually</li>
                <li>Ensure you have 2FA access (required for uninstallation)</li>
                <li>Run the script on your server to complete the removal</li>
              </ol>
            </div>
          </div>
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="border-2 border-red-500/40 bg-red-500/10 p-4 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Confirmation */}
      {showConfirm && (
        <div className="border-4 border-neon-pink/40 bg-brutal-card p-6 space-y-4">
          <div className="flex items-center gap-3">
            <Shield className="w-6 h-6 text-neon-pink" />
            <h4 className="font-bold uppercase text-sm text-neon-pink">Final Confirmation Required</h4>
          </div>
          
          <p className="text-sm text-tx/70">
            Type <code className="px-2 py-1 bg-brutal-bg border border-tx/20 font-mono text-red-400">DELETE ALL DATA</code> to confirm:
          </p>
          
          <input
            type="text"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            className="w-full px-4 py-3 bg-brutal-bg border-2 border-red-500/40 text-tx font-mono focus:outline-none focus:border-red-500"
            placeholder="Type here..."
            autoFocus
          />

          <div className="flex gap-3">
            <button
              onClick={handleConfirmUninstall}
              disabled={confirmText !== 'DELETE ALL DATA'}
              className="flex-1 px-4 py-3 bg-red-500 text-white font-bold uppercase text-sm hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              Confirm Uninstallation
            </button>
            <button
              onClick={() => { setShowConfirm(false); setConfirmText(''); setError(''); }}
              className="px-4 py-3 border-2 border-tx/20 text-tx/70 font-bold uppercase text-sm hover:bg-tx/5 transition-all"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={downloadUninstallScript}
          className="px-6 py-3 border-2 border-neon-cyan/40 bg-neon-cyan/10 text-neon-cyan font-bold uppercase text-sm hover:bg-neon-cyan/20 transition-all flex items-center gap-2"
        >
          <Download className="w-4 h-4" />
          Download Uninstall Script
        </button>
        
        {!showConfirm && (
          <button
            onClick={handleUninstallRequest}
            disabled={loading}
            className="px-6 py-3 border-2 border-red-500/40 bg-red-500/10 text-red-400 font-bold uppercase text-sm hover:bg-red-500/20 disabled:opacity-50 transition-all flex items-center gap-2"
          >
            <Trash className="w-4 h-4" />
            Uninstall Nexus
          </button>
        )}
      </div>

      {/* 2FA Verification Modal */}
      <TwoFactorVerifyModal
        isOpen={show2FAModal}
        onClose={() => setShow2FAModal(false)}
        onVerified={handle2FAVerified}
        title="Verify Uninstallation"
        description="Enter your 2FA code to authorize the uninstallation of Nexus. This is a critical security measure."
      />
    </div>
  );
}

export default UninstallSettings;
