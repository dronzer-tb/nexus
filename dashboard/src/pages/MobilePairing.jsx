import { useState, useEffect, useRef, useCallback } from 'react';
import { SmartphoneDevice, QrCode, Trash, Clock, CheckCircle, WarningTriangle, Shield, Lock, Key } from 'iconoir-react';
import axios from 'axios';

/**
 * Secure Mobile Pairing Page
 * Multi-step auth flow: Generate QR + OTP → Mobile scans → OTP verify → Login + 2FA → Paired
 */

const STEPS = [
  { id: 1, label: 'Generate', icon: '🔑' },
  { id: 2, label: 'Scan QR', icon: '📱' },
  { id: 3, label: 'Enter OTP', icon: '🔢' },
  { id: 4, label: 'Login', icon: '🔐' },
  { id: 5, label: 'Complete', icon: '✅' },
];

function StepIndicator({ currentStep, pairingStep }) {
  // Map server step to visual step
  let activeStep = currentStep;
  if (pairingStep === 'otp_verified') activeStep = 4;
  if (pairingStep === 'completed') activeStep = 5;

  return (
    <div className="flex items-center justify-between mb-6">
      {STEPS.map((step, i) => (
        <div key={step.id} className="flex items-center flex-1">
          <div className="flex flex-col items-center flex-1">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold border-2 transition-all ${
              step.id < activeStep
                ? 'bg-green-500/20 border-green-500 text-green-400'
                : step.id === activeStep
                  ? 'bg-neon-cyan/20 border-neon-cyan text-neon-cyan animate-pulse'
                  : 'bg-gray-800 border-gray-600 text-gray-500'
            }`}>
              {step.id < activeStep ? '✓' : step.icon}
            </div>
            <span className={`text-[10px] mt-1 font-bold tracking-wider uppercase ${
              step.id <= activeStep ? 'text-gray-300' : 'text-gray-600'
            }`}>
              {step.label}
            </span>
          </div>
          {i < STEPS.length - 1 && (
            <div className={`h-0.5 flex-1 mx-1 mt-[-16px] transition-all ${
              step.id < activeStep ? 'bg-green-500/50' : 'bg-gray-700'
            }`} />
          )}
        </div>
      ))}
    </div>
  );
}

function OTPDisplay({ otp, timeRemaining, total = 60 }) {
  const progress = (timeRemaining / total) * 100;
  const isUrgent = timeRemaining <= 10;

  return (
    <div className={`p-5 rounded-lg border-2 transition-all ${
      isUrgent ? 'border-red-500/60 bg-red-500/5' : 'border-neon-cyan/30 bg-neon-cyan/5'
    }`}>
      <div className="text-center mb-3">
        <p className="text-xs font-bold tracking-[4px] uppercase text-gray-400 mb-2">One-Time Password</p>
        <div className="flex justify-center gap-2">
          {otp.split('').map((digit, i) => (
            <div key={i} className={`w-12 h-14 flex items-center justify-center rounded border-2 text-2xl font-mono font-black ${
              isUrgent
                ? 'border-red-500/50 text-red-400 bg-red-500/10'
                : 'border-neon-cyan/40 text-neon-cyan bg-neon-cyan/10'
            }`}>
              {digit}
            </div>
          ))}
        </div>
      </div>

      {/* Countdown */}
      <div className="mt-3">
        <div className="flex items-center justify-between text-xs mb-1">
          <span className="text-gray-400 flex items-center gap-1">
            <Clock className="w-3 h-3" /> Expires in
          </span>
          <span className={`font-mono font-bold ${isUrgent ? 'text-red-400' : 'text-gray-300'}`}>
            {timeRemaining}s
          </span>
        </div>
        <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-1000 rounded-full ${
              isUrgent ? 'bg-red-500' : 'bg-neon-cyan'
            }`}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <p className="text-[10px] text-gray-500 text-center mt-2">
        Tell the mobile user this OTP — they must enter it within {total}s
      </p>
    </div>
  );
}

function MobilePairing() {
  const [qrCode, setQrCode] = useState(null);
  const [challengeId, setChallengeId] = useState(null);
  const [otp, setOtp] = useState(null);
  const [expiresAt, setExpiresAt] = useState(null);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [currentStep, setCurrentStep] = useState(1);
  const [pairingStep, setPairingStep] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [pairedDevices, setPairedDevices] = useState([]);
  const [loadingDevices, setLoadingDevices] = useState(true);
  const [serverUrlOverride, setServerUrlOverride] = useState('');
  const pollRef = useRef(null);

  useEffect(() => {
    fetchPairedDevices();
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  // Countdown timer
  useEffect(() => {
    if (!expiresAt) return;

    const tick = setInterval(() => {
      const remaining = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
      setTimeRemaining(remaining);

      if (remaining === 0) {
        resetPairing();
      }
    }, 1000);

    return () => clearInterval(tick);
  }, [expiresAt]);

  // Poll pairing status
  const startPolling = useCallback((chId) => {
    if (pollRef.current) clearInterval(pollRef.current);

    pollRef.current = setInterval(async () => {
      try {
        const res = await axios.get(`/api/mobile/pairing-status/${chId}`);
        if (res.data.status === 'completed_or_expired' && res.data.pending === false) {
          // Pairing completed — refresh devices
          setCurrentStep(5);
          setPairingStep('completed');
          clearInterval(pollRef.current);
          fetchPairedDevices();
          setTimeout(() => resetPairing(), 5000);
        } else if (res.data.status === 'otp_verified') {
          setCurrentStep(4);
          setPairingStep('otp_verified');
        }
      } catch {
        // Ignore polling errors
      }
    }, 2000);
  }, []);

  const resetPairing = () => {
    setQrCode(null);
    setChallengeId(null);
    setOtp(null);
    setExpiresAt(null);
    setTimeRemaining(0);
    setCurrentStep(1);
    setPairingStep(null);
    setError('');
    if (pollRef.current) clearInterval(pollRef.current);
  };

  const fetchPairedDevices = async () => {
    setLoadingDevices(true);
    try {
      const res = await axios.get('/api/mobile/paired-devices');
      setPairedDevices(res.data.devices || []);
    } catch (err) {
      console.error('Failed to fetch paired devices:', err);
    } finally {
      setLoadingDevices(false);
    }
  };

  const initPairing = async () => {
    setError('');
    setLoading(true);
    resetPairing();

    try {
      const body = {};
      if (serverUrlOverride.trim()) body.serverUrl = serverUrlOverride.trim();

      const res = await axios.post('/api/mobile/init-pairing', body);

      setQrCode(res.data.qrCode);
      setChallengeId(res.data.challengeId);
      setOtp(res.data.otp);
      setExpiresAt(res.data.expiresAt);
      setTimeRemaining(res.data.otpExpiresIn);
      setCurrentStep(2);
      setPairingStep('waiting_otp');

      // Start polling for status updates
      startPolling(res.data.challengeId);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to initiate pairing');
    } finally {
      setLoading(false);
    }
  };

  const unpairDevice = async (deviceId, deviceName) => {
    if (!confirm(`Unpair "${deviceName}"? The device will lose access immediately.`)) return;
    try {
      await axios.delete(`/api/mobile/unpair/${deviceId}`);
      fetchPairedDevices();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to unpair device');
    }
  };

  const formatDate = (ts) => {
    if (!ts) return '—';
    return new Date(ts).toLocaleString();
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-black flex items-center gap-3 mb-2 tracking-tight">
          <SmartphoneDevice className="w-8 h-8 text-neon-pink" />
          Secure Mobile Pairing
        </h1>
        <p className="text-gray-400 text-sm">
          Multi-factor device pairing — QR scan + OTP + credentials + 2FA
        </p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* ─── Left: Pairing Flow ─── */}
        <div className="bg-background-light p-6 rounded-lg border-2 border-gray-800">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <Shield className="w-5 h-5 text-neon-cyan" />
            Pair New Device
          </h2>

          {/* Step Indicator */}
          {qrCode && <StepIndicator currentStep={currentStep} pairingStep={pairingStep} />}

          {error && (
            <div className="mb-4 p-3 bg-red-500/20 border border-red-500 rounded-lg text-red-300 text-sm flex items-start gap-2">
              <WarningTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              {error}
            </div>
          )}

          {/* Completed state */}
          {currentStep === 5 ? (
            <div className="text-center py-10">
              <div className="text-6xl mb-4">✅</div>
              <h3 className="text-xl font-bold text-green-400 mb-2">Device Paired Successfully</h3>
              <p className="text-gray-400 text-sm">The mobile device now has secure access.</p>
            </div>
          ) : !qrCode ? (
            /* ─── Generate state ─── */
            <div className="text-center py-6">
              <div className="mb-6">
                <div className="w-20 h-20 mx-auto mb-4 rounded-xl bg-neon-cyan/10 border-2 border-neon-cyan/30 flex items-center justify-center">
                  <QrCode className="w-10 h-10 text-neon-cyan" />
                </div>
                <p className="text-gray-400 mb-1">No active pairing session</p>
                <p className="text-xs text-gray-500">
                  Generate a QR code and OTP to start the secure pairing process
                </p>
              </div>

              {/* Optional server URL override */}
              <div className="mb-4 text-left">
                <label className="text-[10px] font-bold tracking-[3px] uppercase text-gray-500 mb-1 block">
                  Server URL Override (optional)
                </label>
                <input
                  type="text"
                  value={serverUrlOverride}
                  onChange={(e) => setServerUrlOverride(e.target.value)}
                  placeholder="e.g. http://192.168.1.100:8080"
                  className="w-full bg-background-dark border-2 border-gray-700 rounded px-3 py-2 text-sm font-mono text-gray-300 placeholder-gray-600 focus:border-neon-cyan/50 focus:outline-none"
                />
                <p className="text-[10px] text-gray-600 mt-1">
                  Override if the auto-detected URL is incorrect (e.g. behind NAT/proxy)
                </p>
              </div>

              <button
                onClick={initPairing}
                disabled={loading}
                className="w-full px-6 py-3 bg-neon-cyan text-gray-900 font-black text-sm tracking-wider uppercase rounded hover:bg-neon-cyan/90 disabled:opacity-50 transition-all"
              >
                {loading ? 'Generating...' : 'Start Pairing'}
              </button>
            </div>
          ) : (
            /* ─── Active pairing ─── */
            <div>
              {/* QR Code */}
              <div className="text-center mb-5">
                <p className="text-xs font-bold tracking-[3px] uppercase text-gray-400 mb-3">
                  Step 1 — Scan this QR code with the Nexus mobile app
                </p>
                <div className="bg-white p-3 rounded-lg inline-block">
                  <img src={qrCode} alt="Pairing QR Code" className="w-56 h-56" />
                </div>
              </div>

              {/* OTP Display */}
              <div className="mb-5">
                <p className="text-xs font-bold tracking-[3px] uppercase text-gray-400 mb-3">
                  Step 2 — Share this OTP with the mobile user
                </p>
                <OTPDisplay otp={otp} timeRemaining={timeRemaining} />
              </div>

              {/* Instructions */}
              <div className="bg-gray-800/50 border border-gray-700 p-4 rounded-lg mb-4">
                <p className="text-xs font-bold text-gray-300 mb-2 flex items-center gap-1">
                  <Lock className="w-3 h-3" /> Pairing Steps
                </p>
                <ol className="text-xs text-gray-400 space-y-1.5">
                  <li className="flex items-start gap-2">
                    <span className="text-neon-cyan font-bold">1.</span>
                    Mobile user scans the QR code above
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-neon-cyan font-bold">2.</span>
                    Tell them the 6-digit OTP shown above
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-neon-cyan font-bold">3.</span>
                    They log in with their Nexus credentials
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-neon-cyan font-bold">4.</span>
                    They enter their 2FA code to complete pairing
                  </li>
                </ol>
              </div>

              {/* Status badge */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full animate-pulse ${
                    pairingStep === 'otp_verified' ? 'bg-yellow-400' : 'bg-neon-cyan'
                  }`} />
                  <span className="text-xs text-gray-400 font-mono">
                    {pairingStep === 'otp_verified'
                      ? 'OTP verified — waiting for login...'
                      : 'Waiting for mobile device...'}
                  </span>
                </div>

                <button
                  onClick={resetPairing}
                  className="px-3 py-1.5 bg-gray-800 border border-gray-600 rounded text-xs text-gray-400 hover:text-gray-200 hover:border-gray-500 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ─── Right: Paired Devices ─── */}
        <div className="bg-background-light p-6 rounded-lg border-2 border-gray-800">
          <h2 className="text-xl font-bold mb-4 flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Key className="w-5 h-5 text-green-400" />
              Paired Devices
            </span>
            <span className="text-sm font-normal text-gray-500 font-mono">
              {pairedDevices.length}
            </span>
          </h2>

          {loadingDevices ? (
            <div className="text-center py-12 text-gray-500">
              <div className="animate-spin w-8 h-8 border-2 border-gray-600 border-t-neon-cyan rounded-full mx-auto mb-3" />
              Loading devices...
            </div>
          ) : pairedDevices.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <SmartphoneDevice className="w-16 h-16 mx-auto mb-4 opacity-30" />
              <p className="font-bold">No devices paired</p>
              <p className="text-xs mt-2 text-gray-600">
                Start the pairing process to connect a mobile device
              </p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
              {pairedDevices.map(device => (
                <div
                  key={device.id}
                  className="bg-background-dark p-4 rounded-lg border border-gray-700 hover:border-neon-cyan/30 transition-all group"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <SmartphoneDevice className="w-4 h-4 text-neon-cyan flex-shrink-0" />
                        <h3 className="font-bold text-sm truncate">{device.deviceName}</h3>
                      </div>
                      <div className="text-[10px] text-gray-500 space-y-0.5 font-mono">
                        <p>ID: {device.id}</p>
                        <p>Paired by: <span className="text-gray-400">{device.pairedBy}</span></p>
                        <p>Paired: <span className="text-gray-400">{formatDate(device.pairedAt)}</span></p>
                        {device.lastUsed && (
                          <p>Last used: <span className="text-gray-400">{formatDate(device.lastUsed * 1000)}</span></p>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => unpairDevice(device.id, device.deviceName)}
                      className="p-2 text-gray-600 hover:text-red-400 hover:bg-red-500/10 rounded transition-all opacity-0 group-hover:opacity-100"
                      title="Unpair device"
                    >
                      <Trash className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Security Info */}
      <div className="mt-6 bg-gray-800/40 border border-gray-700 p-5 rounded-lg">
        <h3 className="font-bold mb-3 flex items-center gap-2 text-sm">
          <Shield className="w-4 h-4 text-neon-cyan" />
          Security Layers
        </h3>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { icon: '📱', label: 'QR Challenge', desc: 'Cryptographic challenge via QR code' },
            { icon: '🔢', label: 'OTP Verification', desc: '6-digit code, 60s expiry, 3 attempts max' },
            { icon: '🔑', label: 'Credentials', desc: 'Username + password verification' },
            { icon: '🛡️', label: '2FA Required', desc: 'TOTP authenticator or recovery code' },
          ].map((layer, i) => (
            <div key={i} className="bg-background-dark/50 p-3 rounded border border-gray-700/50">
              <div className="text-lg mb-1">{layer.icon}</div>
              <p className="text-xs font-bold text-gray-300">{layer.label}</p>
              <p className="text-[10px] text-gray-500 mt-0.5">{layer.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default MobilePairing;
