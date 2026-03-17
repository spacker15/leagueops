'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/supabase/client'
import { useAuth } from '@/lib/auth'
import { cn } from '@/lib/utils'
import {
  CheckCircle, ArrowLeft, ArrowRight, Upload, X,
  Copy, Plus, Trash2, LogIn, UserPlus, Eye, EyeOff,
} from 'lucide-react'

type Mode = 'choose' | 'login' | 'register'
type Step = 'account' | 'program' | 'teams' | 'confirm' | 'done'

const STATES = ['AL','AR','FL','GA','MS','NC','SC','TN','TX','VA']

interface TeamEntry {
  name: string; division: string
  coachName: string; coachEmail: string; coachPhone: string
  playerCount: string; customAnswers: Record<string, string>
  fromPrevious?: boolean  // flagged if copied from a previous registration
}

interface Division { id: number; name: string; is_active: boolean; max_teams: number | null }
interface Question {
  id: number; section: string; question_key: string; question_text: string
  question_type: string; placeholder: string | null; options: string[] | null
  is_required: boolean; sort_order: number
}
interface PreviousTeam {
  id: number; team_name: string; division: string
  head_coach_name: string | null; head_coach_email: string | null
  head_coach_phone: string | null; player_count: number | null; status: string
}

const defaultTeam = (division = ''): TeamEntry => ({
  name: '', division, coachName: '', coachEmail: '',
  coachPhone: '', playerCount: '', customAnswers: {},
})

export function RegisterPage() {
  const { signIn, user } = useAuth()
  const fileRef = useRef<HTMLInputElement>(null)

  const [mode, setMode]     = useState<Mode>('choose')
  const [step, setStep]     = useState<Step>('account')
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  // Login form
  const [loginEmail, setLoginEmail]       = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [loginLoading, setLoginLoading]   = useState(false)
  const [showPw, setShowPw]               = useState(false)

  // Dynamic config
  const [divisions, setDivisions] = useState<Division[]>([])
  const [questions, setQuestions] = useState<Question[]>([])

  // Previous program data (when logged in and re-registering)
  const [previousProgram, setPreviousProgram]   = useState<any>(null)
  const [previousTeams, setPreviousTeams]       = useState<PreviousTeam[]>([])
  const [previousTeamOffers, setPreviousTeamOffers] = useState<Record<number, boolean>>({})
  const [prefillLoaded, setPrefillLoaded]       = useState(false)

  // Account
  const [email, setEmail]         = useState('')
  const [password, setPassword]   = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [emailChecked, setEmailChecked] = useState(false)
  const [emailConflict, setEmailConflict] = useState<string | null>(null)

  // Program
  const [progName, setProgName]         = useState('')
  const [shortName, setShortName]       = useState('')
  const [association, setAssociation]   = useState('')
  const [city, setCity]                 = useState('')
  const [state, setState]               = useState('FL')
  const [contactName, setContactName]   = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [website, setWebsite]           = useState('')
  const [notes, setNotes]               = useState('')
  const [logoFile, setLogoFile]         = useState<File | null>(null)
  const [logoPreview, setLogoPreview]   = useState<string | null>(null)
  const [existingLogoUrl, setExistingLogoUrl] = useState<string | null>(null)
  const [progAnswers, setProgAnswers]   = useState<Record<string, string>>({})

  // Teams
  const [teams, setTeams] = useState<TeamEntry[]>([defaultTeam()])

  // Load config
  useEffect(() => {
    const sb = createClient()
    Promise.all([
      sb.from('registration_divisions').select('*').eq('event_id', 1).eq('is_active', true).order('sort_order'),
      sb.from('registration_questions').select('*').eq('event_id', 1).eq('is_active', true).order('section').order('sort_order'),
    ]).then(([{ data: divs }, { data: qs }]) => {
      setDivisions((divs as Division[]) ?? [])
      setQuestions((qs as Question[]) ?? [])
      if (divs && divs.length > 0) setTeams([defaultTeam(divs[0].name)])
    })
  }, [])

  // If user is already logged in, load their existing data for prefill
  useEffect(() => {
    if (user && !prefillLoaded) loadPrefill()
  }, [user])

  async function loadPrefill() {
    try {
      const res = await fetch('/api/auth/program-prefill')
      if (!res.ok) return
      const { program, teams: prevTeams } = await res.json()
      if (program) {
        setPreviousProgram(program)
        setPreviousTeams(prevTeams ?? [])
        // Prefill program fields
        setProgName(program.name ?? '')
        setShortName(program.short_name ?? '')
        setAssociation(program.association ?? '')
        setCity(program.city ?? '')
        setState(program.state ?? 'FL')
        setContactName(program.contact_name ?? '')
        setContactPhone(program.contact_phone ?? '')
        setWebsite(program.website ?? '')
        setNotes(program.notes ?? '')
        setEmail(program.contact_email ?? '')
        if (program.logo_url) {
          setExistingLogoUrl(program.logo_url)
          setLogoPreview(program.logo_url)
        }
        // Default all previous team offers to false
        const offers: Record<number, boolean> = {}
        prevTeams?.forEach((t: PreviousTeam) => { offers[t.id] = false })
        setPreviousTeamOffers(offers)
        // If logged in, skip account step
        setStep('program')
        setMode('register')
      }
      setPrefillLoaded(true)
    } catch {}
  }

  // Check email for existing account / conflicts
  async function checkEmail(emailVal: string) {
    if (!emailVal.includes('@')) return
    setEmailChecked(false)
    setEmailConflict(null)
    try {
      const res = await fetch('/api/auth/check-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailVal }),
      })
      const data = await res.json()
      if (data.has_program) {
        setEmailConflict(`This email already has a program registered (${data.program_name}, ${data.program_status}). Please log in instead.`)
      }
      setEmailChecked(true)
    } catch {}
  }

  async function handleLogin() {
    if (!loginEmail || !loginPassword) { setError('Email and password required'); return }
    setLoginLoading(true)
    setError('')
    const { error } = await signIn(loginEmail, loginPassword)
    if (error) {
      setError(error)
      setLoginLoading(false)
      return
    }
    // Auth state change will trigger loadPrefill via useEffect
    setLoginLoading(false)
  }

  function handleLogo(file: File) {
    if (!file.type.startsWith('image/')) { setError('Please upload an image file'); return }
    if (file.size > 2 * 1024 * 1024) { setError('Logo must be under 2MB'); return }
    setLogoFile(file)
    const reader = new FileReader()
    reader.onload = e => setLogoPreview(e.target?.result as string)
    reader.readAsDataURL(file)
    setError('')
  }

  function updateTeam(i: number, field: keyof TeamEntry, value: string) {
    setTeams(prev => prev.map((t, idx) => idx === i ? { ...t, [field]: value } : t))
  }

  function updateTeamAnswer(i: number, key: string, value: string) {
    setTeams(prev => prev.map((t, idx) =>
      idx === i ? { ...t, customAnswers: { ...t.customAnswers, [key]: value } } : t
    ))
  }

  function addTeam() {
    setTeams(prev => [...prev, defaultTeam(divisions[0]?.name ?? '')])
  }

  function removeTeam(i: number) {
    setTeams(prev => prev.filter((_, idx) => idx !== i))
  }

  function copyCoachToAll(fromIdx: number) {
    const src = teams[fromIdx]
    setTeams(prev => prev.map((t, i) =>
      i === fromIdx ? t : { ...t, coachName: src.coachName, coachEmail: src.coachEmail, coachPhone: src.coachPhone }
    ))
  }

  function copyCoachTo(fromIdx: number, toIdx: number) {
    const src = teams[fromIdx]
    setTeams(prev => prev.map((t, i) =>
      i === toIdx ? { ...t, coachName: src.coachName, coachEmail: src.coachEmail, coachPhone: src.coachPhone } : t
    ))
  }

  // Accept/decline a previous team offer
  function togglePreviousTeam(teamId: number, accept: boolean) {
    setPreviousTeamOffers(prev => ({ ...prev, [teamId]: accept }))
    const pt = previousTeams.find(t => t.id === teamId)
    if (!pt) return
    if (accept) {
      setTeams(prev => {
        // Don't add if already there
        if (prev.some(t => t.name === pt.team_name && t.division === pt.division)) return prev
        return [...prev, {
          name:      pt.team_name,
          division:  pt.division,
          coachName: pt.head_coach_name ?? '',
          coachEmail: pt.head_coach_email ?? '',
          coachPhone: pt.head_coach_phone ?? '',
          playerCount: pt.player_count ? String(pt.player_count) : '',
          customAnswers: {},
          fromPrevious: true,
        }]
      })
    } else {
      setTeams(prev => prev.filter(t => !(t.name === pt.team_name && t.division === pt.division && t.fromPrevious)))
    }
  }

  function validateAccount() {
    if (emailConflict) { setError(emailConflict); return false }
    if (!email || !password || !confirmPw) { setError('All fields required'); return false }
    if (!email.includes('@')) { setError('Enter a valid email'); return false }
    if (password.length < 8) { setError('Password must be at least 8 characters'); return false }
    if (password !== confirmPw) { setError('Passwords do not match'); return false }
    setError(''); return true
  }

  function validateProgram() {
    if (!progName || !contactName) { setError('Program name and contact name required'); return false }
    setError(''); return true
  }

  function validateTeams() {
    for (let i = 0; i < teams.length; i++) {
      if (!teams[i].name) { setError(`Team ${i + 1} needs a name`); return false }
      if (!teams[i].division) { setError(`Team ${i + 1} needs a division`); return false }
    }
    setError(''); return true
  }

  async function submit() {
    setSaving(true)
    setError('')
    const sb = createClient()

    try {
      let userId = user?.id ?? null

      // Only create new auth user if not already logged in
      if (!userId) {
        const { data: authData, error: authErr } = await sb.auth.signUp({ email, password })
        if (authErr) throw new Error(authErr.message)
        if (!authData.user) throw new Error('Failed to create account')
        userId = authData.user.id
      }

      // Upload logo
      let logoUrl = existingLogoUrl
      if (logoFile && userId) {
        const ext  = logoFile.name.split('.').pop()
        const path = `programs/${userId}/logo.${ext}`
        const { error: upErr } = await sb.storage.from('program-assets')
          .upload(path, logoFile, { upsert: true, contentType: logoFile.type })
        if (!upErr) {
          const { data: urlData } = sb.storage.from('program-assets').getPublicUrl(path)
          logoUrl = urlData.publicUrl
        }
      }

      let programId = previousProgram?.id ?? null

      if (programId) {
        // Update existing program
        await sb.from('programs').update({
          name: progName, short_name: shortName || null, association: association || null,
          city: city || null, state, contact_name: contactName,
          contact_phone: contactPhone || null, website: website || null,
          notes: notes || null, logo_url: logoUrl ?? null, updated_at: new Date().toISOString(),
        }).eq('id', programId)
      } else {
        // Create new program
        const { data: prog, error: progErr } = await sb.from('programs').insert({
          name: progName, short_name: shortName || null, association: association || null,
          city: city || null, state, contact_name: contactName,
          contact_email: email, contact_phone: contactPhone || null,
          website: website || null, notes: notes || null,
          logo_url: logoUrl ?? null, status: 'pending',
        }).select().single()
        if (progErr) throw new Error(progErr.message)
        programId = (prog as any).id

        await sb.from('program_leaders').insert({ user_id: userId, program_id: programId, is_primary: true })
        await sb.from('user_roles').insert({
          user_id: userId, role: 'program_leader', display_name: contactName,
          program_id: programId, event_id: 1, is_active: false,
        })
      }

      // Submit team registrations
      for (const team of teams) {
        if (!team.name) continue
        const { data: reg } = await sb.from('team_registrations').insert({
          program_id: programId, event_id: 1,
          team_name: team.name, division: team.division,
          head_coach_name:  team.coachName  || null,
          head_coach_email: team.coachEmail || null,
          head_coach_phone: team.coachPhone || null,
          player_count: team.playerCount ? Number(team.playerCount) : null,
          status: 'pending',
        }).select().single()

        if (reg && Object.keys(team.customAnswers).length > 0) {
          for (const [key, answer] of Object.entries(team.customAnswers)) {
            if (!answer) continue
            const q = questions.find(q => q.question_key === key)
            if (!q) continue
            await sb.from('registration_answers').insert({
              team_reg_id: (reg as any).id, question_id: q.id, answer,
            })
          }
        }
      }

      await sb.from('ops_log').insert({
        event_id: 1,
        message: `Program registration ${previousProgram ? 'updated' : 'submitted'}: ${progName} — ${teams.length} team(s)`,
        log_type: 'info', occurred_at: new Date().toISOString(),
      })

      setStep('done')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const inp = 'w-full bg-white/5 border border-border text-white px-3 py-2.5 rounded-lg text-[13px] outline-none focus:border-blue-400 transition-colors placeholder-white/20'
  const lbl = 'font-cond text-[10px] font-bold tracking-widest text-muted uppercase block mb-1.5'
  const progQs  = questions.filter(q => q.section === 'program')
  const teamQs  = questions.filter(q => q.section === 'team')
  const coachQs = questions.filter(q => q.section === 'coach')

  return (
    <div className="min-h-screen bg-surface">
      {/* Header */}
      <div className="bg-navy-dark border-b-2 border-red px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-red rounded flex items-center justify-center">
            <svg width="16" height="16" viewBox="0 0 22 22" fill="none">
              <rect x="1" y="1" width="9" height="9" rx="1.5" fill="white" fillOpacity="0.9"/>
              <rect x="12" y="1" width="9" height="9" rx="1.5" fill="white" fillOpacity="0.9"/>
              <rect x="1" y="12" width="9" height="9" rx="1.5" fill="white" fillOpacity="0.9"/>
              <rect x="12" y="12" width="9" height="9" rx="1.5" fill="white" fillOpacity="0.4"/>
            </svg>
          </div>
          <span className="font-cond text-xl font-black tracking-widest text-white">LEAGUEOPS</span>
        </div>
        <a href="/" className="font-cond text-[11px] text-muted hover:text-white transition-colors">← Back to Login</a>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-10">
        <div className="text-center mb-8">
          <div className="font-cond font-black text-[28px] text-white tracking-wide mb-2">PROGRAM REGISTRATION</div>
          <div className="font-cond text-[13px] text-muted">Register your program to manage teams and rosters</div>
        </div>

        {/* ── CHOOSE MODE ── */}
        {mode === 'choose' && (
          <div className="grid grid-cols-2 gap-4">
            <button onClick={() => setMode('login')}
              className="bg-surface-card border-2 border-border hover:border-blue-400 rounded-xl p-8 text-center transition-all group">
              <LogIn size={32} className="mx-auto mb-4 text-blue-300 group-hover:scale-110 transition-transform" />
              <div className="font-cond font-black text-[18px] text-white mb-2 tracking-wide">I HAVE AN ACCOUNT</div>
              <div className="font-cond text-[12px] text-muted leading-relaxed">
                Sign in to update your program info or register additional teams
              </div>
            </button>
            <button onClick={() => setMode('register')}
              className="bg-surface-card border-2 border-border hover:border-green-500 rounded-xl p-8 text-center transition-all group">
              <UserPlus size={32} className="mx-auto mb-4 text-green-400 group-hover:scale-110 transition-transform" />
              <div className="font-cond font-black text-[18px] text-white mb-2 tracking-wide">NEW PROGRAM</div>
              <div className="font-cond text-[12px] text-muted leading-relaxed">
                Create an account and register your program for the first time
              </div>
            </button>
          </div>
        )}

        {/* ── LOGIN MODE ── */}
        {mode === 'login' && (
          <div className="bg-surface-card border border-border rounded-xl p-6 max-w-md mx-auto">
            <div className="font-cond font-black text-[15px] tracking-wide mb-5">SIGN IN TO YOUR PROGRAM ACCOUNT</div>
            <div className="space-y-4">
              <div>
                <label className={lbl}>Email</label>
                <input type="email" className={inp} value={loginEmail}
                  onChange={e => setLoginEmail(e.target.value)} placeholder="you@yourprogram.com" />
              </div>
              <div>
                <label className={lbl}>Password</label>
                <div className="relative">
                  <input type={showPw ? 'text' : 'password'} className={inp} value={loginPassword}
                    onChange={e => setLoginPassword(e.target.value)} placeholder="Your password" />
                  <button type="button" onClick={() => setShowPw(s => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-white">
                    {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>
            </div>
            {error && <Err msg={error} />}
            <div className="flex gap-3 mt-5">
              <button onClick={() => { setMode('choose'); setError('') }}
                className="font-cond text-[12px] text-muted hover:text-white px-4 py-2.5 transition-colors">
                ← BACK
              </button>
              <button onClick={handleLogin} disabled={loginLoading}
                className="flex-1 font-cond font-black text-[13px] tracking-wider bg-navy hover:bg-navy-light text-white py-2.5 rounded-lg transition-colors disabled:opacity-50">
                {loginLoading ? 'SIGNING IN...' : 'SIGN IN'}
              </button>
            </div>
            <div className="text-center mt-4">
              <span className="font-cond text-[11px] text-muted">Don't have an account? </span>
              <button onClick={() => setMode('register')} className="font-cond text-[11px] text-blue-300 hover:text-white">
                Register here
              </button>
            </div>
          </div>
        )}

        {/* ── REGISTER FLOW ── */}
        {mode === 'register' && step !== 'done' && (
          <>
            {/* Step indicator */}
            <div className="flex items-center mb-8">
              {(user
                ? [{ id: 'program', label: 'Program' }, { id: 'teams', label: 'Teams' }, { id: 'confirm', label: 'Review' }]
                : [{ id: 'account', label: 'Account' }, { id: 'program', label: 'Program' }, { id: 'teams', label: 'Teams' }, { id: 'confirm', label: 'Review' }]
              ).map((s, i, arr) => {
                const allSteps = user ? ['program','teams','confirm'] : ['account','program','teams','confirm']
                const cur  = allSteps.indexOf(step)
                const mine = allSteps.indexOf(s.id)
                return (
                  <div key={s.id} className="flex items-center flex-1">
                    <div className={cn('w-7 h-7 rounded-full flex items-center justify-center font-cond font-black text-[11px] flex-shrink-0',
                      mine < cur  ? 'bg-green-600 text-white' :
                      mine === cur ? 'bg-navy-light border-2 border-blue-400 text-white' :
                      'bg-surface-card border border-border text-muted'
                    )}>{mine < cur ? '✓' : i + 1}</div>
                    <span className={cn('font-cond text-[11px] font-bold ml-2 flex-shrink-0',
                      mine === cur ? 'text-white' : mine < cur ? 'text-green-400' : 'text-muted'
                    )}>{s.label}</span>
                    {i < arr.length - 1 && <div className="flex-1 h-px bg-border mx-3" />}
                  </div>
                )
              })}
            </div>

            {/* Returning user banner */}
            {previousProgram && (
              <div className="bg-blue-900/20 border border-blue-800/40 rounded-xl p-4 mb-5 flex items-center gap-3">
                {logoPreview && <img src={logoPreview} alt="" className="w-10 h-10 object-contain rounded flex-shrink-0" />}
                <div>
                  <div className="font-cond font-bold text-[13px] text-blue-300">
                    Welcome back — {previousProgram.name}
                  </div>
                  <div className="font-cond text-[11px] text-muted">
                    Your program info is pre-filled. Update anything that's changed and add new teams below.
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* ── STEP 1: ACCOUNT ── */}
        {mode === 'register' && step === 'account' && (
          <div className="bg-surface-card border border-border rounded-xl p-6">
            <div className="font-cond font-black text-[15px] tracking-wide mb-5">CREATE YOUR ACCOUNT</div>
            <div className="space-y-4">
              <div>
                <label className={lbl}>Email Address *</label>
                <input type="email" className={cn(inp, emailConflict ? 'border-red-500' : '')}
                  value={email}
                  onChange={e => { setEmail(e.target.value); setEmailChecked(false); setEmailConflict(null) }}
                  onBlur={e => checkEmail(e.target.value)}
                  placeholder="director@yourprogram.com" />
                {emailConflict && (
                  <div className="text-[11px] text-red-400 font-cond mt-1.5 leading-snug">
                    {emailConflict}
                  </div>
                )}
              </div>
              <div>
                <label className={lbl}>Password *</label>
                <div className="relative">
                  <input type={showPw ? 'text' : 'password'} className={inp} value={password}
                    onChange={e => setPassword(e.target.value)} placeholder="Minimum 8 characters" />
                  <button type="button" onClick={() => setShowPw(s => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-white">
                    {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>
              <div>
                <label className={lbl}>Confirm Password *</label>
                <input type="password" className={inp} value={confirmPw}
                  onChange={e => setConfirmPw(e.target.value)} placeholder="Repeat password" />
              </div>
            </div>
            {error && <Err msg={error} />}
            <div className="flex justify-between mt-5">
              <button onClick={() => setMode('choose')}
                className="flex items-center gap-2 font-cond text-[12px] text-muted hover:text-white transition-colors">
                <ArrowLeft size={13} /> BACK
              </button>
              <NavBtn dir="next" onClick={() => { if (validateAccount()) setStep('program') }} />
            </div>
          </div>
        )}

        {/* ── STEP 2: PROGRAM ── */}
        {mode === 'register' && step === 'program' && (
          <div className="space-y-4">
            <div className="bg-surface-card border border-border rounded-xl p-6">
              <div className="font-cond font-black text-[15px] tracking-wide mb-5">PROGRAM INFORMATION</div>

              {/* Logo */}
              <div className="mb-5">
                <label className={lbl}>Program Logo</label>
                <div className="flex items-start gap-4">
                  {logoPreview ? (
                    <div className="relative w-24 h-24 flex-shrink-0">
                      <img src={logoPreview} alt="Logo" className="w-24 h-24 object-contain rounded-lg border border-border bg-white/5" />
                      {!existingLogoUrl && (
                        <button onClick={() => { setLogoFile(null); setLogoPreview(null) }}
                          className="absolute -top-2 -right-2 w-5 h-5 bg-red rounded-full flex items-center justify-center">
                          <X size={10} className="text-white" />
                        </button>
                      )}
                    </div>
                  ) : (
                    <button onClick={() => fileRef.current?.click()}
                      className="w-24 h-24 rounded-lg border-2 border-dashed border-border hover:border-blue-400 flex flex-col items-center justify-center gap-1 transition-colors flex-shrink-0">
                      <Upload size={18} className="text-muted" />
                      <span className="font-cond text-[9px] text-muted">UPLOAD</span>
                    </button>
                  )}
                  <div className="text-[11px] text-muted font-cond leading-relaxed pt-1">
                    Your logo will display on all team pages.<br />
                    PNG or JPG, max 2MB. Square logos work best.
                    {existingLogoUrl && (
                      <div className="mt-2">
                        <button onClick={() => fileRef.current?.click()} className="text-blue-300 hover:text-white text-[11px]">
                          Replace logo
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                <input ref={fileRef} type="file" accept="image/*" className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleLogo(f) }} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className={lbl}>Program Name *</label>
                  <input className={inp} value={progName} onChange={e => setProgName(e.target.value)}
                    placeholder="e.g. Riverbend Youth Lacrosse" />
                </div>
                <div>
                  <label className={lbl}>Short Name</label>
                  <input className={inp} value={shortName} onChange={e => setShortName(e.target.value)} placeholder="e.g. RYL" />
                </div>
                <div>
                  <label className={lbl}>Association</label>
                  <input className={inp} value={association} onChange={e => setAssociation(e.target.value)} placeholder="e.g. NFYLL" />
                </div>
                <div>
                  <label className={lbl}>City</label>
                  <input className={inp} value={city} onChange={e => setCity(e.target.value)} placeholder="City" />
                </div>
                <div>
                  <label className={lbl}>State</label>
                  <select className={inp} value={state} onChange={e => setState(e.target.value)}>
                    {STATES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className={lbl}>Contact Name *</label>
                  <input className={inp} value={contactName} onChange={e => setContactName(e.target.value)} placeholder="Your full name" />
                </div>
                <div>
                  <label className={lbl}>Contact Phone</label>
                  <input className={inp} value={contactPhone} onChange={e => setContactPhone(e.target.value)} placeholder="(555) 000-0000" />
                </div>
                <div className="col-span-2">
                  <label className={lbl}>Website</label>
                  <input className={inp} value={website} onChange={e => setWebsite(e.target.value)} placeholder="https://..." />
                </div>
                <div className="col-span-2">
                  <label className={lbl}>Notes for Admin</label>
                  <textarea className={cn(inp, 'resize-y min-h-[60px]')} value={notes} onChange={e => setNotes(e.target.value)} />
                </div>
              </div>

              {progQs.length > 0 && (
                <div className="mt-5 pt-5 border-t border-border">
                  <div className="font-cond text-[11px] font-bold tracking-widest text-muted uppercase mb-4">ADDITIONAL INFORMATION</div>
                  <div className="grid grid-cols-2 gap-4">
                    {progQs.map(q => (
                      <div key={q.id} className={q.question_type === 'textarea' ? 'col-span-2' : ''}>
                        <label className={lbl}>{q.question_text}{q.is_required && ' *'}</label>
                        <QInput q={q} value={progAnswers[q.question_key] ?? ''}
                          onChange={v => setProgAnswers(prev => ({ ...prev, [q.question_key]: v }))} cls={inp} />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {error && <Err msg={error} />}
            <div className="flex justify-between">
              {!user
                ? <NavBtn dir="back" onClick={() => setStep('account')} />
                : <button onClick={() => setMode('choose')} className="flex items-center gap-2 font-cond text-[12px] text-muted hover:text-white"><ArrowLeft size={13} /> BACK</button>
              }
              <NavBtn dir="next" onClick={() => { if (validateProgram()) setStep('teams') }} />
            </div>
          </div>
        )}

        {/* ── STEP 3: TEAMS ── */}
        {mode === 'register' && step === 'teams' && (
          <div className="space-y-4">
            {/* Previous team offers */}
            {previousTeams.length > 0 && (
              <div className="bg-surface-card border border-border rounded-xl p-5">
                <div className="font-cond font-black text-[13px] tracking-wide mb-1">PREVIOUSLY REGISTERED TEAMS</div>
                <div className="font-cond text-[11px] text-muted mb-4">
                  Would you like to re-register any of these teams?
                </div>
                <div className="space-y-2">
                  {previousTeams.map(pt => {
                    const accepted = previousTeamOffers[pt.id] === true
                    return (
                      <div key={pt.id} className={cn(
                        'flex items-center justify-between rounded-lg border px-4 py-3 transition-all',
                        accepted ? 'border-green-700/60 bg-green-900/10' : 'border-border bg-black/20'
                      )}>
                        <div>
                          <div className="font-cond font-bold text-[13px] text-white">{pt.team_name}</div>
                          <div className="font-cond text-[11px] text-blue-300">{pt.division}</div>
                          {pt.head_coach_name && (
                            <div className="font-cond text-[10px] text-muted">Coach: {pt.head_coach_name}</div>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => togglePreviousTeam(pt.id, false)}
                            className={cn('font-cond text-[11px] font-bold px-3 py-1.5 rounded border transition-colors',
                              !accepted ? 'bg-navy border-blue-400 text-white' : 'border-border text-muted hover:text-white'
                            )}>NO</button>
                          <button onClick={() => togglePreviousTeam(pt.id, true)}
                            className={cn('font-cond text-[11px] font-bold px-3 py-1.5 rounded border transition-colors',
                              accepted ? 'bg-green-700 border-green-600 text-white' : 'border-border text-muted hover:text-white'
                            )}>YES</button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* New / selected teams */}
            {teams.map((team, i) => (
              <div key={i} className={cn(
                'bg-surface-card border rounded-xl overflow-hidden',
                team.fromPrevious ? 'border-green-700/50' : 'border-border'
              )}>
                <div className="bg-navy/60 px-5 py-3 flex justify-between items-center border-b border-border">
                  <div className="flex items-center gap-3">
                    {logoPreview && <img src={logoPreview} alt="" className="w-6 h-6 object-contain rounded" />}
                    <span className="font-cond font-black text-[13px] tracking-wide text-blue-300">
                      TEAM {i + 1} {team.fromPrevious && <span className="text-green-400 text-[10px] ml-1">↩ RETURNING</span>}
                    </span>
                    {team.name && <span className="font-cond text-[11px] text-white">— {team.name}</span>}
                  </div>
                  {teams.length > 1 && (
                    <button onClick={() => removeTeam(i)} className="flex items-center gap-1 font-cond text-[10px] text-red-400 hover:text-red-300">
                      <Trash2 size={11} /> REMOVE
                    </button>
                  )}
                </div>
                <div className="p-5 space-y-5">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={lbl}>Team Name *</label>
                      <input className={inp} value={team.name} onChange={e => updateTeam(i, 'name', e.target.value)}
                        placeholder={`${shortName || progName.split(' ')[0]} 14U`} />
                    </div>
                    <div>
                      <label className={lbl}>Division *</label>
                      <select className={inp} value={team.division} onChange={e => updateTeam(i, 'division', e.target.value)}>
                        <option value="">Select...</option>
                        {divisions.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className={lbl}>Expected Player Count</label>
                      <input type="number" className={inp} value={team.playerCount}
                        onChange={e => updateTeam(i, 'playerCount', e.target.value)} placeholder="e.g. 18" />
                    </div>
                  </div>

                  {teamQs.length > 0 && (
                    <div className="grid grid-cols-2 gap-3">
                      {teamQs.map(q => (
                        <div key={q.id} className={q.question_type === 'textarea' ? 'col-span-2' : ''}>
                          <label className={lbl}>{q.question_text}{q.is_required && ' *'}</label>
                          <QInput q={q} value={team.customAnswers[q.question_key] ?? ''}
                            onChange={v => updateTeamAnswer(i, q.question_key, v)} cls={inp} />
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Head Coach */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className="font-cond text-[10px] font-bold tracking-widest text-muted uppercase">HEAD COACH</div>
                      {teams.length > 1 && (team.coachName || team.coachEmail || team.coachPhone) && (
                        <div className="flex items-center gap-2">
                          <span className="font-cond text-[10px] text-muted">Copy to:</span>
                          <button onClick={() => copyCoachToAll(i)}
                            className="flex items-center gap-1 font-cond text-[10px] font-bold text-blue-300 bg-navy/40 border border-border rounded px-2 py-0.5 hover:bg-navy transition-colors">
                            <Copy size={9} /> ALL TEAMS
                          </button>
                          {teams.map((_, j) => j !== i && (
                            <button key={j} onClick={() => copyCoachTo(i, j)}
                              className="font-cond text-[10px] font-bold text-muted bg-navy/40 border border-border rounded px-2 py-0.5 hover:text-white hover:bg-navy transition-colors">
                              Team {j + 1}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className={lbl}>Coach Name</label>
                        <input className={inp} value={team.coachName} onChange={e => updateTeam(i, 'coachName', e.target.value)} placeholder="Full name" />
                      </div>
                      <div>
                        <label className={lbl}>Coach Email</label>
                        <input type="email" className={inp} value={team.coachEmail} onChange={e => updateTeam(i, 'coachEmail', e.target.value)} placeholder="coach@email.com" />
                      </div>
                      <div>
                        <label className={lbl}>Coach Phone</label>
                        <input type="tel" className={inp} value={team.coachPhone} onChange={e => updateTeam(i, 'coachPhone', e.target.value)} placeholder="(555) 000-0000" />
                      </div>
                    </div>
                    {coachQs.length > 0 && (
                      <div className="grid grid-cols-2 gap-3 mt-3">
                        {coachQs.map(q => (
                          <div key={q.id}>
                            <label className={lbl}>{q.question_text}{q.is_required && ' *'}</label>
                            <QInput q={q} value={team.customAnswers[q.question_key] ?? ''}
                              onChange={v => updateTeamAnswer(i, q.question_key, v)} cls={inp} />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}

            <button onClick={addTeam}
              className="w-full flex items-center justify-center gap-2 font-cond font-bold text-[13px] tracking-wide text-blue-300 border-2 border-dashed border-border hover:border-blue-400 hover:bg-white/5 rounded-xl py-4 transition-all">
              <Plus size={16} /> ADD ANOTHER TEAM
            </button>

            {error && <Err msg={error} />}
            <div className="flex justify-between">
              <NavBtn dir="back" onClick={() => setStep('program')} />
              <NavBtn dir="next" label="REVIEW" onClick={() => { if (validateTeams()) setStep('confirm') }} />
            </div>
          </div>
        )}

        {/* ── STEP 4: CONFIRM ── */}
        {mode === 'register' && step === 'confirm' && (
          <div className="space-y-4">
            <div className="bg-surface-card border border-border rounded-xl p-6">
              <div className="font-cond font-black text-[15px] tracking-wide mb-5">REVIEW YOUR REGISTRATION</div>
              <div className="flex items-start gap-4 mb-5 pb-5 border-b border-border">
                {logoPreview ? (
                  <img src={logoPreview} alt="" className="w-16 h-16 object-contain rounded-lg border border-border bg-white/5 flex-shrink-0" />
                ) : (
                  <div className="w-16 h-16 rounded-lg border border-border bg-navy flex items-center justify-center flex-shrink-0">
                    <span className="font-cond font-black text-xl text-blue-300">{progName.split(' ').map(w => w[0]).join('').slice(0,2)}</span>
                  </div>
                )}
                <div>
                  <div className="font-cond font-black text-[18px] text-white">{progName}</div>
                  {shortName && <div className="font-cond text-[12px] text-blue-300">{shortName}</div>}
                  <div className="font-cond text-[11px] text-muted mt-1">{[city, state, association].filter(Boolean).join(' · ')}</div>
                  <div className="font-cond text-[11px] text-muted">{contactName} · {user?.email ?? email}</div>
                </div>
              </div>
              <div className="space-y-3">
                {teams.map((t, i) => (
                  <div key={i} className="bg-black/20 rounded-lg p-3 border border-border/50">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-cond font-bold text-[14px] text-white">{t.name}</div>
                        <div className="font-cond text-[11px] text-blue-300">{t.division}</div>
                        {t.coachName && <div className="font-cond text-[11px] text-muted mt-1">
                          Coach: {t.coachName}{t.coachPhone ? ` · ${t.coachPhone}` : ''}
                        </div>}
                      </div>
                      {t.playerCount && <span className="font-cond text-[11px] text-muted">{t.playerCount} players</span>}
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-5 bg-yellow-900/20 border border-yellow-800/40 rounded-lg p-3">
                <div className="font-cond font-bold text-[11px] text-yellow-400 mb-1">WHAT HAPPENS NEXT</div>
                <div className="font-cond text-[11px] text-muted leading-relaxed">
                  {previousProgram
                    ? 'Your additional teams will be reviewed by the administrator before being added to the schedule.'
                    : 'Your registration will be reviewed. Once approved you\'ll have full access to manage your teams. This typically takes 1–2 business days.'}
                </div>
              </div>
            </div>
            {error && <Err msg={error} />}
            <div className="flex justify-between">
              <NavBtn dir="back" onClick={() => setStep('teams')} />
              <button onClick={submit} disabled={saving}
                className="flex items-center gap-2 font-cond font-black text-[14px] tracking-wider bg-navy hover:bg-navy-light text-white px-8 py-3 rounded-lg transition-colors disabled:opacity-50">
                {saving ? 'SUBMITTING...' : 'SUBMIT REGISTRATION'}
              </button>
            </div>
          </div>
        )}

        {/* ── DONE ── */}
        {step === 'done' && (
          <div className="text-center py-8">
            <div className="w-20 h-20 rounded-full bg-green-900/30 border-2 border-green-600/50 flex items-center justify-center mx-auto mb-6">
              {logoPreview
                ? <img src={logoPreview} alt="" className="w-16 h-16 object-contain rounded-full" />
                : <CheckCircle size={36} className="text-green-400" />
              }
            </div>
            <div className="font-cond font-black text-[24px] text-white mb-3 tracking-wide">REGISTRATION SUBMITTED!</div>
            <div className="font-cond text-[13px] text-muted mb-6 max-w-md mx-auto leading-relaxed">
              <span className="text-white font-bold">{progName}</span> — {teams.length} team{teams.length > 1 ? 's' : ''} submitted for review.
            </div>
            <a href="/" className="font-cond font-black text-[13px] tracking-wider text-blue-300 hover:text-white transition-colors">← Return to Login</a>
          </div>
        )}
      </div>
    </div>
  )
}

function QInput({ q, value, onChange, cls }: { q: Question; value: string; onChange: (v: string) => void; cls: string }) {
  if (q.question_type === 'select') return (
    <select className={cls} value={value} onChange={e => onChange(e.target.value)}>
      <option value="">Select...</option>
      {(q.options ?? []).map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  )
  if (q.question_type === 'textarea') return (
    <textarea className={cn(cls, 'resize-y min-h-[70px]')} value={value}
      onChange={e => onChange(e.target.value)} placeholder={q.placeholder ?? ''} />
  )
  if (q.question_type === 'checkbox') return (
    <div className="flex items-center gap-2 pt-1">
      <input type="checkbox" checked={value === 'true'} onChange={e => onChange(e.target.checked ? 'true' : 'false')} className="w-4 h-4 rounded accent-blue-500" />
      <span className="font-cond text-[12px] text-muted">Yes</span>
    </div>
  )
  return (
    <input type={q.question_type === 'email' ? 'email' : q.question_type === 'phone' ? 'tel' : q.question_type === 'number' ? 'number' : 'text'}
      className={cls} value={value} onChange={e => onChange(e.target.value)} placeholder={q.placeholder ?? ''} />
  )
}

function Err({ msg }: { msg: string }) {
  return <div className="bg-red-900/20 border border-red-800/50 rounded-lg px-3 py-2 text-[12px] text-red-300 font-cond font-bold mt-3">{msg}</div>
}

function NavBtn({ dir, onClick, label }: { dir: 'next' | 'back'; onClick: () => void; label?: string }) {
  if (dir === 'back') return (
    <button onClick={onClick} className="flex items-center gap-2 font-cond font-black text-[13px] text-muted hover:text-white px-4 py-2.5 transition-colors">
      <ArrowLeft size={14} /> BACK
    </button>
  )
  return (
    <button onClick={onClick} className="flex items-center gap-2 font-cond font-black text-[13px] tracking-wider bg-navy hover:bg-navy-light text-white px-6 py-2.5 rounded-lg transition-colors">
      {label ?? 'NEXT'} <ArrowRight size={14} />
    </button>
  )
}
