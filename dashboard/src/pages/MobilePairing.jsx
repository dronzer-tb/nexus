import { useState, useEffect } from 'react';
import { Smartphone, QrCode, Trash2, Clock, CheckCircle, AlertTriangle } from 'lucide-react';
import axios from 'axios';

/**
 * Mobile App Pairing Page
 * Allows users to pair mobile devices via QR code
 * For v1.9.5 custom auth system
 */

function MobilePairing() {
  const [qrCode, setQrCode] = useState(null);
  const [pairingId, setPairingId] = useState(null);
  const [expiresAt, setExpiresAt] = useState(null);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [pairedDevices, setPairedDevices] = useState([]);
  const [loadingDevices, setLoadingDevices] = useState(true);

  useEffect(() => {
    fetchPairedDevices();
  }, []);

  useEffect(() => {
    if (expiresAt) {
      const interval = setInterval(() => {
        const remaining = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
        setTimeRemaining(remaining);
        
        if (remaining === 0) {
          setQrCode(null);
          setPairingId(null);
          setExpiresAt(null);
        }
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [expiresAt]);

  const fetchPairedDevices = async () => {
    setLoadingDevices(true);
    try {
      const token = localStorage.getItem('session_token');
      const response = await axios.get('/api/mobile/paired-devices', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setPairedDevices(response.data.devices || []);
    } catch (err) {
      console.error('Failed to fetch paired devices:', err);
    } finally {
      setLoadingDevices(false);
    }
  };

  const generatePairingCode = async () => {
    setError('');
    setLoading(true);

    try {
      const token = localStorage.getItem('session_token');
      const response = await axios.post('/api/mobile/generate-pairing', {}, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      setQrCode(response.data.qrCode);
      setPairingId(response.data.pairingId);
      setExpiresAt(response.data.expiresAt);
      setTimeRemaining(response.data.expiresIn);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to generate pairing code');
    } finally {
      setLoading(false);
    }
  };

  const unpairDevice = async (deviceId, deviceName) => {
    if (!confirm(`Are you sure you want to unpair "${deviceName}"?`)) {
      return;
    }

    try {
      const token = localStorage.getItem('session_token');
      await axios.delete(`/api/mobile/unpair/${deviceId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      // Refresh device list
      fetchPairedDevices();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to unpair device');
    }
  };

  const formatTimeRemaining = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDate = (timestamp) => {
    return new Date(timestamp).toLocaleString();
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold flex items-center gap-3 mb-2">
          <Smartphone className="w-8 h-8 text-neon-pink" />
          Mobile App Pairing
        </h1>
        <p className="text-gray-400">
          Securely connect the Nexus mobile app by scanning a QR code
        </p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* QR Code Section */}
        <div className="bg-background-light p-6 rounded-lg border-2 border-gray-800">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <QrCode className="w-5 h-5 text-neon-cyan" />
            Pair New Device
          </h2>

          {error && (
            <div className="mb-4 p-3 bg-red-500/20 border border-red-500 rounded-lg text-red-300 text-sm flex items-start gap-2">
              <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              {error}
            </div>
          )}

          {!qrCode ? (
            <div className="text-center py-8">
              <div className="mb-4 text-gray-400">
                <p className="mb-2">No active pairing code</p>
                <p className="text-sm">Click below to generate a new QR code for pairing</p>
              </div>
              <button
                onClick={generatePairingCode}
                disabled={loading}
                className="px-6 py-3 bg-primary text-on-primary font-bold rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-all"
              >
                {loading ? 'Generating...' : 'Generate QR Code'}
              </button>
            </div>
          ) : (
            <div className="text-center">
              <div className="bg-white p-4 rounded-lg inline-block mb-4">
                <img src={qrCode} alt="Pairing QR Code" className="w-64 h-64" />
              </div>

              <div className="bg-background-dark p-4 rounded-lg mb-4">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <Clock className="w-5 h-5 text-yellow-400" />
                  <span className="text-lg font-mono font-bold">
                    {formatTimeRemaining(timeRemaining)}
                  </span>
                </div>
                <p className="text-xs text-gray-400">Time remaining</p>
              </div>

              <div className="bg-blue-500/10 border border-blue-500/30 p-3 rounded-lg text-sm text-gray-300">
                <p className="mb-2 font-medium">Instructions:</p>
                <ol className="text-left text-xs space-y-1">
                  <li>1. Open the Nexus mobile app</li>
                  <li>2. Tap "Scan QR Code" or "Pair Device"</li>
                  <li>3. Point your camera at this QR code</li>
                  <li>4. Wait for confirmation</li>
                </ol>
              </div>

              <button
                onClick={() => {
                  setQrCode(null);
                  setPairingId(null);
                  setExpiresAt(null);
                }}
                className="mt-4 px-4 py-2 bg-background-dark border border-gray-600 rounded-lg hover:bg-background-dark/70 transition-colors text-sm"
              >
                Cancel
              </button>
            </div>
          )}
        </div>

        {/* Paired Devices Section */}
        <div className="bg-background-light p-6 rounded-lg border-2 border-gray-800">
          <h2 className="text-xl font-bold mb-4 flex items-center justify-between">
            <span className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-400" />
              Paired Devices
            </span>
            <span className="text-sm font-normal text-gray-400">
              {pairedDevices.length} device{pairedDevices.length !== 1 ? 's' : ''}
            </span>
          </h2>

          {loadingDevices ? (
            <div className="text-center py-8 text-gray-400">
              Loading devices...
            </div>
          ) : pairedDevices.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <Smartphone className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No devices paired yet</p>
              <p className="text-sm mt-2">Scan a QR code to pair your first device</p>
            </div>
          ) : (
            <div className="space-y-3">
              {pairedDevices.map(device => (
                <div
                  key={device.id}
                  className="bg-background-dark p-4 rounded-lg border border-gray-700 hover:border-gray-600 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Smartphone className="w-4 h-4 text-neon-cyan" />
                        <h3 className="font-bold">{device.deviceName}</h3>
                      </div>
                      <div className="text-xs text-gray-400 space-y-1">
                        <p>Paired by: {device.pairedBy}</p>
                        <p>Paired: {formatDate(device.pairedAt)}</p>
                        {device.lastUsed && (
                          <p>Last used: {formatDate(device.lastUsed)}</p>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => unpairDevice(device.id, device.deviceName)}
                      className="p-2 text-red-400 hover:bg-red-500/20 rounded transition-colors"
                      title="Unpair device"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Info Section */}
      <div className="mt-6 bg-blue-500/10 border border-blue-500/30 p-4 rounded-lg">
        <h3 className="font-bold mb-2 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-blue-400" />
          Security Information
        </h3>
        <ul className="text-sm text-gray-300 space-y-1">
          <li>• QR codes expire after 5 minutes for security</li>
          <li>• Each paired device gets a unique API key</li>
          <li>• You can unpair devices at any time</li>
          <li>• Pairing requires you to be logged in to the dashboard</li>
        </ul>
      </div>
    </div>
  );
}

export default MobilePairing;
