'use client'

import { useState } from 'react'
import { useAuth } from '@/lib/auth'
import { createClient } from '@/supabase/client'

export function LoginPage() {
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [resetMode, setResetMode] = useState(false)
  const [resetSent, setResetSent] = useState(false)
  const [resetLoading, setResetLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error } = await signIn(email, password)
    if (error) setError(error)
    setLoading(false)
  }

  async function handleReset(e: React.FormEvent) {
    e.preventDefault()
    if (!email) {
      setError('Enter your email address above')
      return
    }
    setError('')
    setResetLoading(true)
    const sb = createClient()
    const { error } = await sb.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    if (error) {
      setError(error.message)
    } else {
      setResetSent(true)
    }
    setResetLoading(false)
  }

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-red rounded-lg flex items-center justify-center">
              <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                <rect x="1" y="1" width="9" height="9" rx="1.5" fill="white" fillOpacity="0.9" />
                <rect x="12" y="1" width="9" height="9" rx="1.5" fill="white" fillOpacity="0.9" />
                <rect x="1" y="12" width="9" height="9" rx="1.5" fill="white" fillOpacity="0.9" />
                <rect x="12" y="12" width="9" height="9" rx="1.5" fill="white" fillOpacity="0.4" />
              </svg>
            </div>
            <span className="font-cond text-3xl font-black tracking-widest text-white">
              LEAGUEOPS
            </span>
          </div>
          <div className="font-cond text-sm text-muted tracking-widest">
            TOURNAMENT COMMAND CENTER
          </div>
        </div>

        {/* Login card */}
        <div className="bg-surface-card border border-border rounded-xl p-8">
          <div className="font-cond font-black text-[16px] tracking-wide text-white mb-6 text-center">
            {resetMode ? 'RESET PASSWORD' : 'SIGN IN'}
          </div>

          {resetSent ? (
            <div className="text-center py-2">
              <div className="font-cond text-[13px] text-green-400 font-bold mb-2">
                Password reset email sent!
              </div>
              <div className="text-[12px] text-muted mb-4">
                Check your inbox for a link to reset your password.
              </div>
              <button
                onClick={() => {
                  setResetMode(false)
                  setResetSent(false)
                  setError('')
                }}
                className="font-cond text-[11px] font-bold text-blue-300 hover:text-white transition-colors tracking-wide"
              >
                Back to Sign In
              </button>
            </div>
          ) : resetMode ? (
            <form onSubmit={handleReset} className="space-y-4">
              <div className="text-[12px] text-muted mb-2">
                Enter your email address and we&apos;ll send you a link to reset your password.
              </div>
              <div>
                <label className="font-cond text-[10px] font-bold tracking-widest text-muted uppercase block mb-1.5">
                  Email Address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  className="w-full bg-surface border border-border text-white px-3 py-2.5 rounded-lg text-[14px] outline-none focus:border-blue-400 transition-colors"
                  placeholder="you@example.com"
                />
              </div>

              {error && (
                <div className="bg-red-900/20 border border-red-800/50 rounded-lg px-3 py-2 text-[12px] text-red-300 font-cond font-bold">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={resetLoading}
                className="w-full bg-navy hover:bg-navy-light text-white font-cond font-black text-[14px] tracking-widest py-3 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-2"
              >
                {resetLoading ? 'SENDING...' : 'SEND RESET LINK'}
              </button>

              <div className="text-center">
                <button
                  type="button"
                  onClick={() => {
                    setResetMode(false)
                    setError('')
                  }}
                  className="font-cond text-[11px] font-bold text-blue-300 hover:text-white transition-colors tracking-wide"
                >
                  Back to Sign In
                </button>
              </div>
            </form>
          ) : (
            <>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="font-cond text-[10px] font-bold tracking-widest text-muted uppercase block mb-1.5">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    className="w-full bg-surface border border-border text-white px-3 py-2.5 rounded-lg text-[14px] outline-none focus:border-blue-400 transition-colors"
                    placeholder="you@example.com"
                  />
                </div>

                <div>
                  <label className="font-cond text-[10px] font-bold tracking-widest text-muted uppercase block mb-1.5">
                    Password
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                    className="w-full bg-surface border border-border text-white px-3 py-2.5 rounded-lg text-[14px] outline-none focus:border-blue-400 transition-colors"
                    placeholder="••••••••"
                  />
                </div>

                {error && (
                  <div className="bg-red-900/20 border border-red-800/50 rounded-lg px-3 py-2 text-[12px] text-red-300 font-cond font-bold">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-navy hover:bg-navy-light text-white font-cond font-black text-[14px] tracking-widest py-3 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-2"
                >
                  {loading ? 'SIGNING IN...' : 'SIGN IN'}
                </button>
              </form>

              <div className="text-center mt-4">
                <button
                  type="button"
                  onClick={() => {
                    setResetMode(true)
                    setError('')
                  }}
                  className="font-cond text-[11px] font-bold text-muted hover:text-blue-300 transition-colors tracking-wide"
                >
                  Forgot your password?
                </button>
              </div>
            </>
          )}
        </div>

        <div className="text-center mt-4 space-y-2">
          <div className="font-cond text-[10px] text-muted tracking-wide">
            Contact your administrator to create an account
          </div>
          <div>
            <a
              href="/register"
              className="font-cond text-[11px] font-bold text-blue-300 hover:text-white transition-colors tracking-wide"
            >
              Register a Program →
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
