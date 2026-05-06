'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { ExternalLink, CheckCircle, AlertCircle, ChevronRight, X, Plus, Share, Download, Copy, ChevronDown, RefreshCw } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { createClient } from '@/lib/supabase/client'
import type { UserSettings, Integration, User } from '@/types'

function useIOS() {
  const [isIOS, setIsIOS] = useState(false)
  const [isInstalled, setIsInstalled] = useState(false)
  useEffect(() => {
    const ua = navigator.userAgent
    setIsIOS(/iPhone|iPad|iPod/.test(ua) && !/CriOS|FxiOS/.test(ua))
    setIsInstalled(
      window.matchMedia('(display-mode: standalone)').matches ||
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (navigator as any).standalone === true
    )
  }, [])
  return { isIOS, isInstalled }
}

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - base64String.length % 4) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  return new Uint8Array(Uint8Array.from([...raw].map(c => c.charCodeAt(0))).buffer as ArrayBuffer)
}

export default function SettingsPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [settings, setSettings] = useState<UserSettings | null>(null)
  const [integration, setIntegration] = useState<Integration | null>(null)
  const [gmailIntegration, setGmailIntegration] = useState<Integration | null>(null)
  const [gmailSyncing, setGmailSyncing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [reminderTimes, setReminderTimes] = useState<string[]>([])
  const [installingShortcut, setInstallingShortcut] = useState(false)
  const [showManualGuide, setShowManualGuide] = useState(false)
  const [manualData, setManualData] = useState<{ token: string; endpoint: string } | null>(null)
  const [notifPermission, setNotifPermission] = useState<NotificationPermission | 'unsupported'>('default')
  const [enablingNotifs, setEnablingNotifs] = useState(false)
  const { isIOS, isInstalled } = useIOS()

  useEffect(() => {
    fetch('/api/settings').then(r => r.json()).then(d => {
      setUser(d.user)
      setSettings(d.settings)
      setIntegration(d.integration)
      setGmailIntegration(d.gmailIntegration)
      setReminderTimes(d.settings?.reminder_times ?? [])
    })
  }, [])

  useEffect(() => {
    if (!('Notification' in window)) { setNotifPermission('unsupported'); return }
    setNotifPermission(Notification.permission)
  }, [])

  async function enableNotifications() {
    if (isIOS && !isInstalled) return
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return
    setEnablingNotifs(true)
    try {
      const permission = await Notification.requestPermission()
      setNotifPermission(permission)
      if (permission !== 'granted') { setEnablingNotifs(false); return }
      const reg = await navigator.serviceWorker.register('/sw.js')
      const existing = await reg.pushManager.getSubscription()
      const sub = existing ?? await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!),
      })
      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sub.toJSON()),
      })
      toast('Notifications enabled')
    } catch {
      toast.error('Could not enable notifications')
    }
    setEnablingNotifs(false)
  }

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

  function addReminderTime() {
    const next = [...reminderTimes, '09:00']
    setReminderTimes(next)
    save({ reminder_times: next })
  }

  function removeReminderTime(i: number) {
    const next = reminderTimes.filter((_, idx) => idx !== i)
    setReminderTimes(next)
    save({ reminder_times: next })
  }

  function updateReminderTime(i: number, value: string) {
    const next = reminderTimes.map((t, idx) => idx === i ? value : t)
    setReminderTimes(next)
    save({ reminder_times: next })
  }

  async function installShortcut() {
    // shortcuts:// URL scheme only works from Safari, not from a standalone PWA.
    // Detect standalone mode and skip straight to the manual guide.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone
    if (isStandalone) {
      setShowManualGuide(true)
      if (!manualData) {
        fetch('/api/settings/token').then(r => r.json()).then(d => setManualData(d))
      }
      return
    }

    setInstallingShortcut(true)
    try {
      const res = await fetch('/api/settings/token')
      const { token } = await res.json()
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || window.location.origin
      const fileUrl = `${appUrl}/api/shortcut/file?t=${encodeURIComponent(token)}`
      window.location.href = `shortcuts://add-shortcut?url=${encodeURIComponent(fileUrl)}`
      // If the scheme doesn't trigger within 3s, fall back to the manual guide
      setTimeout(() => {
        setInstallingShortcut(false)
        setShowManualGuide(true)
        if (!manualData) {
          fetch('/api/settings/token').then(r => r.json()).then(d => setManualData(d))
        }
      }, 3000)
    } catch {
      toast.error('Could not generate shortcut — try again')
      setInstallingShortcut(false)
    }
  }

  async function gmailSync() {
    setGmailSyncing(true)
    try {
      const res = await fetch('/api/integrations/gmail/sync', { method: 'POST' })
      const data = await res.json()
      const count = data.created ?? 0
      toast(count > 0 ? `${count} new task${count !== 1 ? 's' : ''} added from Gmail` : 'No new action items found')
      if (count > 0) setGmailIntegration(g => g ? { ...g, last_synced_at: new Date().toISOString() } : g)
    } catch {
      toast.error('Gmail sync failed')
    } finally {
      setGmailSyncing(false)
    }
  }

  async function gmailDisconnect() {
    await fetch('/api/integrations/gmail/disconnect', { method: 'POST' })
    setGmailIntegration(null)
    toast('Gmail disconnected')
  }

  async function openManualGuide() {
    setShowManualGuide(v => {
      if (!v && !manualData) {
        fetch('/api/settings/token').then(r => r.json()).then(d => setManualData(d))
      }
      return !v
    })
  }

  async function copyText(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text)
      toast(`${label} copied`)
    } catch {
      toast(`Copy: ${text}`)
    }
  }

  async function handleInvite() {
    try {
      await navigator.clipboard.writeText(process.env.NEXT_PUBLIC_APP_URL || window.location.origin)
      toast('Link copied to clipboard')
    } catch {
      toast('Copy this link: ' + (process.env.NEXT_PUBLIC_APP_URL || window.location.origin))
    }
  }

  if (!settings || !user) {
    return <div className="px-4 pt-4"><div className="space-y-4">{[1,2,3,4].map(i => <div key={i} className="h-16 rounded-xl bg-zinc-800 border border-zinc-700 animate-pulse" />)}</div></div>
  }

  return (
    <main className="px-4 pt-4 pb-8 max-w-lg">
      <h1 className="text-2xl font-semibold mb-6">Settings</h1>

      {/* Add to Home Screen — only on iOS Safari, not already installed */}
      {isIOS && !isInstalled && (
        <section className="mb-6">
          <div className="p-4 rounded-xl border border-zinc-600 bg-zinc-800">
            <div className="flex items-start gap-3 mb-3">
              <Download size={18} className="text-zinc-300 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-zinc-100">Add to Home Screen</p>
                <p className="text-xs text-zinc-400 mt-0.5">Install Briefer as an app for quick access</p>
              </div>
            </div>
            <div className="flex items-center gap-3 text-xs text-zinc-400">
              <span className="flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-md bg-zinc-700 flex items-center justify-center flex-shrink-0">
                  <Share size={11} className="text-blue-400" />
                </span>
                Tap Share
              </span>
              <span className="text-zinc-600">→</span>
              <span>Add to Home Screen</span>
              <span className="text-zinc-600">→</span>
              <span className="font-medium text-zinc-200">Add</span>
            </div>
          </div>
        </section>
      )}

      {/* Profile */}
      <section className="mb-6">
        <p className="text-[11px] font-medium text-zinc-400 uppercase tracking-widest mb-3">Profile</p>
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 rounded-xl border border-zinc-700 bg-zinc-800">
            <span className="text-sm text-zinc-400">Name</span>
            <input
              defaultValue={user.display_name || ''}
              onBlur={e => save({ display_name: e.target.value })}
              className="text-sm text-right bg-transparent text-zinc-100 outline-none w-40"
            />
          </div>
          <div className="flex items-center justify-between p-3 rounded-xl border border-zinc-700 bg-zinc-800">
            <span className="text-sm text-zinc-400">Timezone</span>
            <span className="text-sm text-zinc-400">{user.timezone}</span>
          </div>
        </div>
      </section>

      {/* Morning Brief */}
      <section className="mb-6">
        <p className="text-[11px] font-medium text-zinc-400 uppercase tracking-widest mb-3">Morning Brief</p>
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 rounded-xl border border-zinc-700 bg-zinc-800">
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
            <div className="flex items-center justify-between p-3 rounded-xl border border-zinc-700 bg-zinc-800">
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
        <p className="text-[11px] font-medium text-zinc-400 uppercase tracking-widest mb-3">Reminders</p>
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 rounded-xl border border-zinc-700 bg-zinc-800">
            <div>
              <span className="text-sm text-zinc-100">Enable reminders</span>
              <p className="text-xs text-zinc-500 mt-0.5">Email nudges throughout the day</p>
            </div>
            <Switch
              checked={settings.reminders_enabled}
              onCheckedChange={v => {
                setSettings(s => s ? { ...s, reminders_enabled: v } : s)
                save({ reminders_enabled: v })
              }}
            />
          </div>

          {settings.reminders_enabled && (
            <div className="p-3 rounded-xl border border-zinc-700 bg-zinc-800 space-y-2">
              <p className="text-xs text-zinc-400 font-medium">Send times</p>
              {reminderTimes.map((t, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    type="time"
                    value={t.slice(0, 5)}
                    onChange={e => updateReminderTime(i, e.target.value)}
                    className="flex-1 text-sm bg-zinc-700 text-zinc-100 outline-none rounded-lg px-3 py-2 border border-zinc-600"
                  />
                  <button
                    onClick={() => removeReminderTime(i)}
                    className="p-1.5 text-zinc-500 hover:text-red-400 transition-colors"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
              {reminderTimes.length < 5 && (
                <button
                  onClick={addReminderTime}
                  className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-100 transition-colors py-1"
                >
                  <Plus size={12} /> Add time
                </button>
              )}
              {reminderTimes.length === 0 && (
                <p className="text-xs text-zinc-500">No reminder times set — add at least one.</p>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Notifications */}
      <section className="mb-6">
        <p className="text-[11px] font-medium text-zinc-400 uppercase tracking-widest mb-3">Notifications</p>
        <div className="space-y-3">
          {isIOS && !isInstalled ? (
            <div className="p-3 rounded-xl border border-zinc-700 bg-zinc-800">
              <p className="text-sm text-zinc-100 mb-1">Push notifications</p>
              <p className="text-xs text-zinc-500 mt-0.5">Add Briefer to your Home Screen first to enable push notifications on iOS.</p>
            </div>
          ) : notifPermission === 'unsupported' ? (
            <div className="p-3 rounded-xl border border-zinc-700 bg-zinc-800">
              <p className="text-sm text-zinc-400">Push notifications not supported in this browser.</p>
            </div>
          ) : notifPermission === 'denied' ? (
            <div className="p-3 rounded-xl border border-zinc-700 bg-zinc-800">
              <p className="text-sm text-zinc-100 mb-1">Push notifications blocked</p>
              <p className="text-xs text-zinc-500 mt-0.5">Allow notifications in your browser or system settings to re-enable.</p>
            </div>
          ) : (
            <div className="flex items-center justify-between p-3 rounded-xl border border-zinc-700 bg-zinc-800">
              <div>
                <span className="text-sm text-zinc-100">Push notifications</span>
                <p className="text-xs text-zinc-500 mt-0.5">Morning brief, reminders, and nudges</p>
              </div>
              {notifPermission === 'granted' ? (
                <Switch checked disabled />
              ) : (
                <button
                  onClick={enableNotifications}
                  disabled={enablingNotifs}
                  className="text-xs font-semibold text-blue-400 hover:text-blue-300 disabled:opacity-50 transition-colors"
                >
                  {enablingNotifs ? 'Enabling…' : 'Enable'}
                </button>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Google Calendar */}
      <section className="mb-6">
        <p className="text-[11px] font-medium text-zinc-400 uppercase tracking-widest mb-3">Google Calendar</p>
        <div className="p-3 rounded-xl border border-zinc-700 bg-zinc-800">
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

      {/* Gmail */}
      <section className="mb-6">
        <p className="text-[11px] font-medium text-zinc-400 uppercase tracking-widest mb-3">Gmail</p>
        <div className="p-3 rounded-xl border border-zinc-700 bg-zinc-800 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {gmailIntegration
                ? gmailIntegration.broken
                  ? <AlertCircle size={16} className="text-red-400" />
                  : <CheckCircle size={16} className="text-green-400" />
                : <div className="w-4 h-4 rounded-full border border-zinc-600" />
              }
              <span className="text-sm text-zinc-100">
                {gmailIntegration
                  ? gmailIntegration.broken ? 'Reconnect required' : 'Connected'
                  : 'Not connected'}
              </span>
            </div>
            {gmailIntegration ? (
              <button
                onClick={gmailDisconnect}
                className="text-xs text-zinc-400 hover:text-red-400 transition-colors"
              >
                Disconnect
              </button>
            ) : (
              <a href="/api/integrations/gmail" className="text-xs text-zinc-100 font-medium hover:text-white flex items-center gap-1 transition-colors">
                Connect <ExternalLink size={10} />
              </a>
            )}
          </div>

          {gmailIntegration && !gmailIntegration.broken && (
            <>
              <p className="text-xs text-zinc-500 leading-relaxed">
                Briefer scans your inbox for action items and adds them to your Inbox automatically.
              </p>
              <div className="flex items-center justify-between">
                {gmailIntegration.last_synced_at && (
                  <span className="text-[10px] text-zinc-500">
                    Last synced {new Date(gmailIntegration.last_synced_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
                <button
                  onClick={gmailSync}
                  disabled={gmailSyncing}
                  className="flex items-center gap-1 text-xs text-zinc-300 hover:text-zinc-100 transition-colors disabled:opacity-50 ml-auto"
                >
                  <RefreshCw size={11} className={gmailSyncing ? 'animate-spin' : ''} />
                  {gmailSyncing ? 'Syncing…' : 'Sync now'}
                </button>
              </div>
            </>
          )}
        </div>
      </section>

      {/* iPhone */}
      {isIOS && (
        <section className="mb-6">
          <p className="text-[11px] font-medium text-zinc-400 uppercase tracking-widest mb-3">iPhone Shortcut</p>
          <div className="rounded-xl border border-zinc-700 bg-zinc-800 overflow-hidden">
            <div className="p-4">
              <p className="text-sm text-zinc-100 mb-1">Capture anywhere on iPhone</p>
              <p className="text-xs text-zinc-500 mb-4">Say &quot;Hey Siri, Briefer&quot; or tap from anywhere — no app open needed.</p>
              <button
                onClick={installShortcut}
                disabled={installingShortcut}
                className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white text-sm font-semibold transition-colors disabled:opacity-60"
              >
                {installingShortcut ? 'Opening Shortcuts…' : 'Install Shortcut'}
              </button>
              {installingShortcut && (
                <p className="text-[11px] text-zinc-400 mt-2 text-center">
                  In Shortcuts, tap <strong className="text-zinc-200">Add Shortcut</strong> to confirm
                </p>
              )}
            </div>

            {/* Manual guide toggle */}
            <button
              onClick={openManualGuide}
              className="w-full flex items-center justify-between px-4 py-3 border-t border-zinc-700 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              Didn&apos;t work? Set up manually
              <ChevronDown size={13} className={showManualGuide ? 'rotate-180 transition-transform' : 'transition-transform'} />
            </button>

            {showManualGuide && (
              <div className="px-4 pb-4 border-t border-zinc-700/50 space-y-4 pt-4">
                <ol className="space-y-3">
                  {[
                    <>In your shortcut, select <strong className="text-zinc-200">Ask for Input</strong> — set the prompt to anything you like</>,
                    <>Select <strong className="text-zinc-200">Get Contents of URL</strong> — set method to <strong className="text-zinc-200">POST</strong>, paste the URL below</>,
                    <>Tap <strong className="text-zinc-200">Show More</strong> → set Request Body to <strong className="text-zinc-200">File</strong> — no headers needed</>,
                  ].map((step, i) => (
                    <li key={i} className="flex gap-3 text-xs text-zinc-400 leading-relaxed">
                      <span className="flex-shrink-0 w-5 h-5 rounded-full bg-zinc-700 text-zinc-400 flex items-center justify-center text-[10px] font-semibold mt-px">{i + 1}</span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ol>

                <div className="p-3 rounded-xl bg-zinc-700/50 border border-zinc-600">
                  <p className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider mb-1">Shortcut URL — paste this as the URL</p>
                  <p className="text-xs text-zinc-300 font-mono break-all leading-relaxed">
                    {manualData
                      ? `${process.env.NEXT_PUBLIC_APP_URL || window.location.origin}/api/shortcut/capture?t=${manualData.token}`
                      : 'Loading…'}
                  </p>
                  {manualData && (
                    <button
                      onClick={() => copyText(
                        `${process.env.NEXT_PUBLIC_APP_URL || window.location.origin}/api/shortcut/capture?t=${manualData.token}`,
                        'URL'
                      )}
                      className="flex items-center gap-1 mt-2 text-[11px] text-zinc-400 hover:text-zinc-200 transition-colors"
                    >
                      <Copy size={11} /> Copy URL
                    </button>
                  )}
                </div>
                <p className="text-[10px] text-zinc-500">This URL contains your auth token — treat it like a password. It expires with your session; come back here if the shortcut stops working.</p>
              </div>
            )}
          </div>
        </section>
      )}

      {/* More */}
      <section className="mb-8">
        <p className="text-[11px] font-medium text-zinc-400 uppercase tracking-widest mb-3">More</p>
        <div className="space-y-2">
          <Link
            href="/completed"
            className="w-full flex items-center justify-between p-3 rounded-xl border border-zinc-700 bg-zinc-800 text-sm text-zinc-300 hover:text-zinc-100 transition-colors"
          >
            Completed items
            <ChevronRight size={14} className="text-zinc-500" />
          </Link>
          <button
            onClick={handleInvite}
            className="w-full text-left p-3 rounded-xl border border-zinc-700 bg-zinc-800 text-sm text-zinc-300 hover:text-zinc-100 transition-colors"
          >
            Invite a friend →
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
