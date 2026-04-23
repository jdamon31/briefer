'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function OnboardingPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [timezone, setTimezone] = useState('America/Los_Angeles')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    // Auto-detect timezone
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
    if (tz) setTimezone(tz)

    // Pre-fill name from settings
    fetch('/api/settings').then(r => r.json()).then(d => {
      if (d.user?.display_name) setName(d.user.display_name)
    })
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    await fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ display_name: name.trim(), timezone }),
    })
    router.push('/today')
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 bg-zinc-900">
      <div className="w-full max-w-sm">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-zinc-100">Welcome to Briefer</h1>
          <p className="mt-2 text-zinc-400 text-sm leading-relaxed">
            Every morning you'll get a plain-English brief of your day. Capture anything — Briefer figures out what it is.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-[11px] font-medium text-zinc-400 uppercase tracking-widest block mb-1.5">
              Your name
            </label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="First name is fine"
              required
              className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-500 outline-none focus:border-zinc-500 transition-colors"
            />
          </div>

          <div>
            <label className="text-[11px] font-medium text-zinc-400 uppercase tracking-widest block mb-1.5">
              Timezone
            </label>
            <div className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-zinc-300">
              {timezone}
            </div>
            <p className="text-[10px] text-zinc-500 mt-1">Auto-detected — change in Settings anytime</p>
          </div>

          <button
            type="submit"
            disabled={!name.trim() || saving}
            className="w-full bg-zinc-100 hover:bg-white disabled:opacity-50 text-zinc-900 font-semibold py-3 px-6 rounded-2xl transition-colors mt-2"
          >
            {saving ? 'Setting up…' : "Let's go →"}
          </button>
        </form>
      </div>
    </div>
  )
}
