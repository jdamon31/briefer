'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ExternalLink, CheckCircle, AlertCircle } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { createClient } from '@/lib/supabase/client'
import type { UserSettings, Integration, User } from '@/types'

export default function SettingsPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [settings, setSettings] = useState<UserSettings | null>(null)
  const [integration, setIntegration] = useState<Integration | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch('/api/settings').then(r => r.json()).then(d => {
      setUser(d.user)
      setSettings(d.settings)
      setIntegration(d.integration)
    })
  }, [])

  async function save(updates: Record<string, unknown>) {
    setSaving(true)
    await fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    })
    setSaving(false)
    toast('Saved')
  }

  async function signOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/auth')
  }

  if (!settings || !user) {
    return <div className="px-4 pt-12"><div className="space-y-4">{[1,2,3,4].map(i => <div key={i} className="h-16 rounded-xl bg-zinc-900/60 border border-zinc-800 animate-pulse" />)}</div></div>
  }

  return (
    <main className="px-4 pt-12 pb-8 max-w-lg">
      <h1 className="text-2xl font-semibold mb-6">Settings</h1>

      {/* Profile */}
      <section className="mb-6">
        <p className="text-[11px] font-medium text-zinc-500 uppercase tracking-widest mb-3">Profile</p>
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 rounded-xl border border-zinc-800 bg-zinc-900/60">
            <span className="text-sm text-zinc-400">Name</span>
            <input
              defaultValue={user.display_name || ''}
              onBlur={e => save({ display_name: e.target.value })}
              className="text-sm text-right bg-transparent text-zinc-100 outline-none w-40"
            />
          </div>
          <div className="flex items-center justify-between p-3 rounded-xl border border-zinc-800 bg-zinc-900/60">
            <span className="text-sm text-zinc-400">Timezone</span>
            <span className="text-sm text-zinc-400">{user.timezone}</span>
          </div>
        </div>
      </section>

      {/* Morning Brief */}
      <section className="mb-6">
        <p className="text-[11px] font-medium text-zinc-500 uppercase tracking-widest mb-3">Morning Brief</p>
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 rounded-xl border border-zinc-800 bg-zinc-900/60">
            <span className="text-sm text-zinc-100">Enable morning brief</span>
            <Switch
              checked={settings.morning_brief_enabled}
              onCheckedChange={v => {
                setSettings(s => s ? { ...s, morning_brief_enabled: v } : s)
                save({ morning_brief_enabled: v })
              }}
            />
          </div>
          {settings.morning_brief_enabled && (
            <div className="flex items-center justify-between p-3 rounded-xl border border-zinc-800 bg-zinc-900/60">
              <span className="text-sm text-zinc-400">Send time</span>
              <input
                type="time"
                defaultValue={settings.morning_brief_time?.slice(0, 5)}
                onBlur={e => save({ morning_brief_time: e.target.value })}
                className="text-sm bg-transparent text-zinc-100 outline-none"
              />
            </div>
          )}
        </div>
      </section>

      {/* Reminders */}
      <section className="mb-6">
        <p className="text-[11px] font-medium text-zinc-500 uppercase tracking-widest mb-3">Reminders</p>
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 rounded-xl border border-zinc-800 bg-zinc-900/60">
            <span className="text-sm text-zinc-100">Enable reminders</span>
            <Switch
              checked={settings.reminders_enabled}
              onCheckedChange={v => {
                setSettings(s => s ? { ...s, reminders_enabled: v } : s)
                save({ reminders_enabled: v })
              }}
            />
          </div>
        </div>
      </section>

      {/* Google Calendar */}
      <section className="mb-6">
        <p className="text-[11px] font-medium text-zinc-500 uppercase tracking-widest mb-3">Google Calendar</p>
        <div className="p-3 rounded-xl border border-zinc-800 bg-zinc-900/60">
          {integration ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {integration.broken
                  ? <AlertCircle size={16} className="text-red-400" />
                  : <CheckCircle size={16} className="text-green-400" />
                }
                <span className="text-sm text-zinc-100">
                  {integration.broken ? 'Reconnect required' : 'Connected'}
                </span>
              </div>
              <a href="/api/integrations/google" className="text-xs text-zinc-400 hover:text-zinc-100 flex items-center gap-1 transition-colors">
                {integration.broken ? 'Reconnect' : 'Reauth'} <ExternalLink size={10} />
              </a>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <span className="text-sm text-zinc-400">Not connected</span>
              <a href="/api/integrations/google" className="text-xs text-zinc-100 font-medium hover:text-white flex items-center gap-1 transition-colors">
                Connect <ExternalLink size={10} />
              </a>
            </div>
          )}
        </div>
      </section>

      {/* More */}
      <section className="mb-8">
        <p className="text-[11px] font-medium text-zinc-500 uppercase tracking-widest mb-3">More</p>
        <div className="space-y-2">
          <button onClick={() => router.push('/completed')} className="w-full text-left p-3 rounded-xl border border-zinc-800 bg-zinc-900/60 text-sm text-zinc-300 hover:text-zinc-100 transition-colors">
            Completed items →
          </button>
          <button className="w-full text-left p-3 rounded-xl border border-zinc-800 bg-zinc-900/60 text-sm text-zinc-300 hover:text-zinc-100 transition-colors">
            Install iOS Shortcut →
          </button>
        </div>
      </section>

      <button
        onClick={signOut}
        className="w-full p-3 rounded-xl border border-zinc-800 text-sm text-zinc-500 hover:text-red-400 hover:border-red-900 transition-colors"
      >
        Sign out
      </button>
    </main>
  )
}
