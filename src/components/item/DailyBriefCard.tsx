'use client'
import { useState, useEffect, useCallback } from 'react'
import { RefreshCw, ChevronDown, ChevronUp } from 'lucide-react'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'

const CACHE_KEY = 'briefer:daily-brief'
const COLLAPSED_KEY = 'briefer:brief-collapsed'
const STALE_MS = 30 * 60 * 1000

interface CachedBrief {
  brief: string
  generatedAt: string
  date: string
}

function isStale(cached: CachedBrief): boolean {
  const today = format(new Date(), 'yyyy-MM-dd')
  if (cached.date !== today) return true
  return Date.now() - new Date(cached.generatedAt).getTime() > STALE_MS
}

export function DailyBriefCard() {
  const [brief, setBrief] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [collapsed, setCollapsed] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  const fetchBrief = useCallback(async (force = false) => {
    if (!force) {
      try {
        const raw = localStorage.getItem(CACHE_KEY)
        if (raw) {
          const cached: CachedBrief = JSON.parse(raw)
          if (!isStale(cached)) {
            setBrief(cached.brief)
            setLoading(false)
            return
          }
        }
      } catch {}
    }

    try {
      const res = await fetch('/api/brief/today')
      if (res.ok) {
        const data = await res.json()
        setBrief(data.brief)
        localStorage.setItem(CACHE_KEY, JSON.stringify({
          brief: data.brief,
          generatedAt: data.generatedAt,
          date: format(new Date(), 'yyyy-MM-dd'),
        }))
      }
    } catch {}
    setLoading(false)
    setRefreshing(false)
  }, [])

  useEffect(() => {
    try {
      const saved = localStorage.getItem(COLLAPSED_KEY)
      if (saved === 'true') setCollapsed(true)
    } catch {}
    fetchBrief()
  }, [fetchBrief])

  function toggleCollapsed() {
    const next = !collapsed
    setCollapsed(next)
    try { localStorage.setItem(COLLAPSED_KEY, String(next)) } catch {}
  }

  async function handleRefresh() {
    setRefreshing(true)
    setLoading(true)
    await fetchBrief(true)
  }

  return (
    <div className="mb-5 p-4 rounded-xl border border-zinc-700 bg-zinc-800/60">
      <div className="flex items-center justify-between mb-1">
        <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-widest">Your brief</p>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="text-zinc-500 hover:text-zinc-300 transition-colors disabled:opacity-40"
          >
            <RefreshCw size={11} className={refreshing ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={toggleCollapsed}
            className="text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            {collapsed ? <ChevronDown size={13} /> : <ChevronUp size={13} />}
          </button>
        </div>
      </div>

      {!collapsed && (
        loading ? (
          <div className="space-y-2 mt-2">
            <div className="h-3 rounded bg-zinc-700 animate-pulse w-full" />
            <div className="h-3 rounded bg-zinc-700 animate-pulse w-5/6" />
            <div className="h-3 rounded bg-zinc-700 animate-pulse w-4/6" />
          </div>
        ) : brief ? (
          <p className="text-sm text-zinc-300 leading-relaxed mt-2">{brief}</p>
        ) : null
      )}
    </div>
  )
}
