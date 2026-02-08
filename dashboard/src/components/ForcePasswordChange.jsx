import { useState } from 'react';
import { motion } from 'framer-motion';
import { Shield, Eye, EyeOff, Lock } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';

export default function ForcePasswordChange() {
  const { clearForcePasswordChange, user } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (newPassword.length < 8) {
      return setError('New password must be at least 8 characters long');
    }
    if (newPassword !== confirmPassword) {
      return setError('Passwords do not match');
    }
    if (newPassword === currentPassword) {
      return setError('New password must be different from the current password');
    }

    setLoading(true);
    try {
      await axios.post('/api/auth/change-password', {
        currentPassword,
        newPassword,
      });
      clearForcePasswordChange();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to change password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-background-dark/95 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md p-8 bg-background-light/10 backdrop-blur-sm border-[3px] border-primary/30 rounded-xl shadow-2xl"
      >
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 border-[3px] border-primary/40 bg-primary/10 rounded-lg mb-4">
            <Shield className="w-8 h-8 text-primary" />
          </div>
          <h2 className="text-2xl font-black uppercase tracking-tight text-tx">
            Password Change <span className="text-primary">Required</span>
          </h2>
          <p className="text-sm text-tx/50 mt-2">
            Welcome, <strong>{user?.username}</strong>. For security, you must change the default password before continuing.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-red-500/20 border-2 border-red-500/40 text-red-300 px-4 py-3 text-sm font-mono">
              {error}
            </div>
          )}

          {/* Current Password */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-tx/40 mb-1 block">Current Password</label>
            <div className="relative">
              <input
                type={showCurrent ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                className="w-full px-4 py-3 bg-background-dark/50 border-2 border-tx/10 text-tx placeholder-tx/20 focus:border-primary/50 focus:outline-none transition-colors font-mono"
                placeholder="Enter current password"
              />
              <button type="button" onClick={() => setShowCurrent(!showCurrent)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-tx/30 hover:text-tx/60">
                {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* New Password */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-tx/40 mb-1 block">New Password</label>
            <div className="relative">
              <input
                type={showNew ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={8}
                className="w-full px-4 py-3 bg-background-dark/50 border-2 border-tx/10 text-tx placeholder-tx/20 focus:border-primary/50 focus:outline-none transition-colors font-mono"
                placeholder="Min 8 characters"
              />
              <button type="button" onClick={() => setShowNew(!showNew)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-tx/30 hover:text-tx/60">
                {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Confirm Password */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-tx/40 mb-1 block">Confirm New Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={8}
              className="w-full px-4 py-3 bg-background-dark/50 border-2 border-tx/10 text-tx placeholder-tx/20 focus:border-primary/50 focus:outline-none transition-colors font-mono"
              placeholder="Confirm new password"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 bg-primary font-bold uppercase tracking-wider text-sm border-[3px] border-primary hover:bg-primary/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            style={{ color: 'var(--on-primary)' }}
          >
            <Lock className="w-4 h-4" />
            {loading ? 'Changing...' : 'Change Password & Continue'}
          </button>
        </form>
      </motion.div>
    </div>
  );
}
