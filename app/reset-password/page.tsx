'use client'

import { useState } from 'react'
import { createClient } from '@/supabase/client'

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match')
      return
    }
    setError('')
    setLoading(true)
    const sb = createClient()
    const { error } = await sb.auth.updateUser({ password })
    if (error) {
      setError(error.message)
    } else {
      setDone(true)
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center">
      <div className="w-full max-w-sm">
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
          <div className="font-cond text-sm text-muted tracking-widest">SET NEW PASSWORD</div>
        </div>

        <div className="bg-surface-card border border-border rounded-xl p-8">
          {done ? (
            <div className="text-center py-2">
              <div className="font-cond text-[13px] text-green-400 font-bold mb-2">
                Password updated!
              </div>
              <div className="text-[12px] text-muted mb-4">
                You can now sign in with your new password.
              </div>
              <a
                href="/"
                className="inline-block bg-navy hover:bg-navy-light text-white font-cond font-black text-[13px] tracking-widest px-6 py-2.5 rounded-lg transition-colors"
              >
                SIGN IN
              </a>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="font-cond text-[10px] font-bold tracking-widest text-muted uppercase block mb-1.5">
                  New Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                  className="w-full bg-surface border border-border text-white px-3 py-2.5 rounded-lg text-[14px] outline-none focus:border-blue-400 transition-colors"
                  placeholder="Min 6 characters"
                />
              </div>
              <div>
                <label className="font-cond text-[10px] font-bold tracking-widest text-muted uppercase block mb-1.5">
                  Confirm Password
                </label>
                <input
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                  autoComplete="new-password"
                  className="w-full bg-surface border border-border text-white px-3 py-2.5 rounded-lg text-[14px] outline-none focus:border-blue-400 transition-colors"
                  placeholder="Re-enter password"
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
                {loading ? 'UPDATING...' : 'SET NEW PASSWORD'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
