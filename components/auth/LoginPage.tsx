'use client'

import { useState } from 'react'
import { useAuth } from '@/lib/auth'

export function LoginPage() {
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error } = await signIn(email, password)
    if (error) setError(error)
    setLoading(false)
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
            SIGN IN
          </div>

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

          {/* Role hints */}
          <div className="mt-6 pt-5 border-t border-border">
            <div className="font-cond text-[10px] font-bold tracking-widest text-muted uppercase mb-3 text-center">
              ACCESS LEVELS
            </div>
            <div className="space-y-1.5">
              {[
                { role: 'Admin', desc: 'Full system access', color: 'text-red-400' },
                {
                  role: 'League Admin',
                  desc: 'Schedule, rosters, reports',
                  color: 'text-blue-300',
                },
                {
                  role: 'Referee',
                  desc: 'Self check-in + game assignments',
                  color: 'text-yellow-400',
                },
                { role: 'Volunteer', desc: 'Self check-in + assignments', color: 'text-green-400' },
              ].map((item) => (
                <div key={item.role} className="flex items-center justify-between text-[11px]">
                  <span className={`font-cond font-bold ${item.color}`}>{item.role}</span>
                  <span className="text-muted">{item.desc}</span>
                </div>
              ))}
            </div>
          </div>
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
