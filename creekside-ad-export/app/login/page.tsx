'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth'

export default function LoginPage() {
  const { signIn } = useAuth()
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await signIn(email, password)
    if (error) {
      setError(error)
      setLoading(false)
    } else {
      router.push('/')
    }
  }

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo / Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-navy border-2 border-red mb-4">
            <span className="font-cond font-black text-2xl text-white">CK</span>
          </div>
          <div className="font-cond font-black text-[22px] tracking-widest text-white uppercase">
            Creekside High School
          </div>
          <div className="font-cond text-[12px] text-muted tracking-widest uppercase mt-1">
            Athletic Department
          </div>
        </div>

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          className="bg-surface-card border border-border rounded-xl p-6 space-y-4"
        >
          <div>
            <label className="font-cond text-[10px] font-black tracking-widest text-muted uppercase block mb-1.5">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="w-full bg-[#040e24] border border-[#1e3060] text-white px-3 py-2.5 rounded-lg text-[13px] outline-none focus:border-blue-400/60 transition-colors"
              placeholder="you@creeksideknights.org"
            />
          </div>
          <div>
            <label className="font-cond text-[10px] font-black tracking-widest text-muted uppercase block mb-1.5">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="w-full bg-[#040e24] border border-[#1e3060] text-white px-3 py-2.5 rounded-lg text-[13px] outline-none focus:border-blue-400/60 transition-colors"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <div className="font-cond text-[11px] text-red-400 bg-red-900/20 border border-red-900/40 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-navy hover:bg-navy-light text-white font-cond font-black text-[14px] tracking-widest rounded-lg transition-colors disabled:opacity-50 mt-2"
          >
            {loading ? 'SIGNING IN...' : 'SIGN IN'}
          </button>
        </form>

        <div className="text-center mt-6">
          <p className="font-cond text-[11px] text-muted">
            Need access? Contact your athletic director.
          </p>
        </div>
      </div>
    </div>
  )
}
