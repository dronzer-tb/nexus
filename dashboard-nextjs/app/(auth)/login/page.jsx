'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [totpToken, setTotpToken] = useState('')
  const [recoveryCode, setRecoveryCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [requires2FA, setRequires2FA] = useState(false)
  const [showPasswordReset, setShowPasswordReset] = useState(false)
  const [resetUsername, setResetUsername] = useState('')
  const [resetCode, setResetCode] = useState('')
  const [resetPassword, setResetPassword] = useState('')
  const [resetStep, setResetStep] = useState('request') // request, verify, reset
  const [resetMessage, setResetMessage] = useState('')

  const handleLogin = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const result = await signIn('credentials', {
        username,
        password,
        totpToken: totpToken || undefined,
        recoveryCode: recoveryCode || undefined,
        redirect: false,
      })

      if (result?.error) {
        // Check if 2FA is required
        try {
          const errorData = JSON.parse(result.error)
          if (errorData.requires2FA) {
            setRequires2FA(true)
            setError(errorData.message)
          } else {
            setError(errorData.message || result.error)
          }
        } catch {
          setError(result.error)
        }
      } else if (result?.ok) {
        // Login successful
        router.push('/')
        router.refresh()
      }
    } catch (err) {
      setError('An unexpected error occurred')
      console.error('Login error:', err)
    } finally {
      setLoading(false)
    }
  }

  const handlePasswordResetRequest = async (e) => {
    e.preventDefault()
    setResetMessage('')
    setError('')

    try {
      const res = await fetch('/api/proxy/password-reset/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: resetUsername }),
      })

      const data = await res.json()

      if (res.ok) {
        setResetMessage(data.message || 'Reset code sent! Check server console.')
        setResetStep('verify')
      } else {
        setError(data.error || 'Failed to request password reset')
      }
    } catch (err) {
      setError('An error occurred while requesting password reset')
    }
  }

  const handlePasswordResetVerify = async (e) => {
    e.preventDefault()
    setResetMessage('')
    setError('')

    try {
      const res = await fetch('/api/proxy/password-reset/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: resetUsername, code: resetCode }),
      })

      const data = await res.json()

      if (res.ok) {
        setResetMessage('Code verified! Enter your new password.')
        setResetStep('reset')
      } else {
        setError(data.error || 'Invalid or expired code')
      }
    } catch (err) {
      setError('An error occurred while verifying code')
    }
  }

  const handlePasswordResetComplete = async (e) => {
    e.preventDefault()
    setResetMessage('')
    setError('')

    if (resetPassword.length < 8) {
      setError('Password must be at least 8 characters long')
      return
    }

    try {
      const res = await fetch('/api/proxy/password-reset/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: resetUsername,
          code: resetCode,
          newPassword: resetPassword,
        }),
      })

      const data = await res.json()

      if (res.ok) {
        setResetMessage('Password reset successful! You can now login.')
        setTimeout(() => {
          setShowPasswordReset(false)
          setResetStep('request')
          setResetUsername('')
          setResetCode('')
          setResetPassword('')
        }, 2000)
      } else {
        setError(data.error || 'Failed to reset password')
      }
    } catch (err) {
      setError('An error occurred while resetting password')
    }
  }

  if (showPasswordReset) {
    return (
      <div className="min-h-screen bg-brutal-bg flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="bg-brutal-card border-brutal border-neon-pink p-8 shadow-brutal">
            <h1 className="text-3xl font-bold text-neon-pink mb-2 font-mono uppercase">
              Password Reset
            </h1>
            <p className="text-tx text-sm mb-6">Reset your account password</p>

            {error && (
              <div className="mb-4 p-3 bg-red-900/20 border border-red-500 text-red-400 text-sm">
                {error}
              </div>
            )}

            {resetMessage && (
              <div className="mb-4 p-3 bg-green-900/20 border border-green-500 text-green-400 text-sm">
                {resetMessage}
              </div>
            )}

            {resetStep === 'request' && (
              <form onSubmit={handlePasswordResetRequest}>
                <div className="mb-4">
                  <label className="block text-tx text-sm font-bold mb-2 uppercase">
                    Username
                  </label>
                  <input
                    type="text"
                    value={resetUsername}
                    onChange={(e) => setResetUsername(e.target.value)}
                    className="w-full px-4 py-2 bg-brutal-bg border-2 border-brutal-border text-tx focus:border-neon-pink focus:outline-none font-mono"
                    required
                  />
                </div>
                <button
                  type="submit"
                  className="w-full bg-neon-pink text-on-primary py-3 px-4 font-bold uppercase border-2 border-neon-pink hover:bg-transparent hover:text-neon-pink transition-colors font-mono"
                >
                  Request Reset Code
                </button>
              </form>
            )}

            {resetStep === 'verify' && (
              <form onSubmit={handlePasswordResetVerify}>
                <div className="mb-4">
                  <label className="block text-tx text-sm font-bold mb-2 uppercase">
                    Reset Code (from server console)
                  </label>
                  <input
                    type="text"
                    value={resetCode}
                    onChange={(e) => setResetCode(e.target.value)}
                    className="w-full px-4 py-2 bg-brutal-bg border-2 border-brutal-border text-tx focus:border-neon-pink focus:outline-none font-mono"
                    placeholder="6-digit code"
                    required
                  />
                </div>
                <button
                  type="submit"
                  className="w-full bg-neon-pink text-on-primary py-3 px-4 font-bold uppercase border-2 border-neon-pink hover:bg-transparent hover:text-neon-pink transition-colors font-mono"
                >
                  Verify Code
                </button>
              </form>
            )}

            {resetStep === 'reset' && (
              <form onSubmit={handlePasswordResetComplete}>
                <div className="mb-4">
                  <label className="block text-tx text-sm font-bold mb-2 uppercase">
                    New Password
                  </label>
                  <input
                    type="password"
                    value={resetPassword}
                    onChange={(e) => setResetPassword(e.target.value)}
                    className="w-full px-4 py-2 bg-brutal-bg border-2 border-brutal-border text-tx focus:border-neon-pink focus:outline-none font-mono"
                    placeholder="Min 8 characters"
                    required
                  />
                </div>
                <button
                  type="submit"
                  className="w-full bg-neon-pink text-on-primary py-3 px-4 font-bold uppercase border-2 border-neon-pink hover:bg-transparent hover:text-neon-pink transition-colors font-mono"
                >
                  Reset Password
                </button>
              </form>
            )}

            <button
              onClick={() => {
                setShowPasswordReset(false)
                setResetStep('request')
                setError('')
                setResetMessage('')
              }}
              className="w-full mt-4 text-neon-cyan hover:underline text-sm uppercase font-mono"
            >
              ← Back to Login
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-brutal-bg flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-brutal-card border-brutal border-neon-pink p-8 shadow-brutal">
          <h1 className="text-3xl font-bold text-neon-pink mb-2 font-mono uppercase">
            Nexus Login
          </h1>
          <p className="text-tx text-sm mb-6">System Monitoring Dashboard</p>

          {error && (
            <div className="mb-4 p-3 bg-red-900/20 border border-red-500 text-red-400 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin}>
            <div className="mb-4">
              <label className="block text-tx text-sm font-bold mb-2 uppercase">
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-4 py-2 bg-brutal-bg border-2 border-brutal-border text-tx focus:border-neon-pink focus:outline-none font-mono"
                required
                disabled={loading}
              />
            </div>

            <div className="mb-4">
              <label className="block text-tx text-sm font-bold mb-2 uppercase">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2 bg-brutal-bg border-2 border-brutal-border text-tx focus:border-neon-pink focus:outline-none font-mono"
                required
                disabled={loading}
              />
            </div>

            {requires2FA && (
              <>
                <div className="mb-4">
                  <label className="block text-tx text-sm font-bold mb-2 uppercase">
                    2FA Code
                  </label>
                  <input
                    type="text"
                    value={totpToken}
                    onChange={(e) => setTotpToken(e.target.value)}
                    className="w-full px-4 py-2 bg-brutal-bg border-2 border-brutal-border text-tx focus:border-neon-pink focus:outline-none font-mono"
                    placeholder="6-digit code"
                    disabled={loading}
                  />
                </div>

                <div className="mb-4">
                  <label className="block text-tx text-sm font-bold mb-2 uppercase">
                    Or Recovery Code
                  </label>
                  <input
                    type="text"
                    value={recoveryCode}
                    onChange={(e) => setRecoveryCode(e.target.value)}
                    className="w-full px-4 py-2 bg-brutal-bg border-2 border-brutal-border text-tx focus:border-neon-pink focus:outline-none font-mono"
                    placeholder="Recovery code"
                    disabled={loading}
                  />
                </div>
              </>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-neon-pink text-on-primary py-3 px-4 font-bold uppercase border-2 border-neon-pink hover:bg-transparent hover:text-neon-pink transition-colors font-mono disabled:opacity-50"
            >
              {loading ? 'Authenticating...' : 'Login'}
            </button>
          </form>

          <button
            onClick={() => setShowPasswordReset(true)}
            className="w-full mt-4 text-neon-cyan hover:underline text-sm uppercase font-mono"
          >
            Forgot Password?
          </button>
        </div>
      </div>
    </div>
  )
}
