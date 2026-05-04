'use client'
import { useState, useEffect } from 'react'
import { addDays, nextMonday, format } from 'date-fns'
import { X, CheckCheck } from 'lucide-react'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { Item } from '@/types'
import { cn } from '@/lib/utils'

type Disposition = 'today' | 'tomorrow' | 'next_week' | 'delete'

interface OverdueTriageProps {
  items: Item[]
  open: boolean
  onClose: () => void
  onUpdate: (id: string, updates: Partial<Item>) => void
  onDelete: (id: string) => void
}

function getDates() {
  const now = new Date()
  const today = new Date(now); today.setHours(9, 0, 0, 0)
  const tomorrow = addDays(today, 1)
  const nextWeek = nextMonday(now); nextWeek.setHours(9, 0, 0, 0)
  return { today, tomorrow, nextWeek }
}

function ageLabel(due_at: string): string {
  const days = Math.round((Date.now() - new Date(due_at).getTime()) / 86400000)
  if (days === 0) return 'due today'
  if (days === 1) return '1 day overdue'
  return `${days} days overdue`
}

export function OverdueTriage({ items, open, onClose, onUpdate, onDelete }: OverdueTriageProps) {
  const [index, setIndex] = useState(0)
  const [done, setDone] = useState(false)
  const [suggestions, setSuggestions] = useState<Record<string, Disposition>>({})
  const [loadingSuggestions, setLoadingSuggestions] = useState(false)

  useEffect(() => {
    if (!open) { setIndex(0); setDone(false); setSuggestions({}) }
  }, [open])

  useEffect(() => {
    if (!open || !items.length) return
    setLoadingSuggestions(true)
    fetch('/api/triage/suggest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: items.map(i => ({ id: i.id, title: i.title, due_at: i.due_at })) }),
    })
      .then(r => r.json())
      .then(d => setSuggestions(d.suggestions || {}))
      .catch(() => {})
      .finally(() => setLoadingSuggestions(false))
  }, [open, items])

  function advance() {
    if (index + 1 >= items.length) {
      setDone(true)
      setTimeout(onClose, 1500)
    } else {
      setIndex(i => i + 1)
    }
  }

  function handleAction(disposition: Disposition) {
    const item = items[index]
    const { today, tomorrow, nextWeek } = getDates()

    if (disposition === 'delete') {
      onDelete(item.id)
    } else {
      const due = disposition === 'today' ? today : disposition === 'tomorrow' ? tomorrow : nextWeek
      onUpdate(item.id, { due_at: due.toISOString(), status: 'active' })
    }
    advance()
  }

  const item = items[index]
  const suggestion = item ? suggestions[item.id] : null

  const ACTIONS: { label: string; disposition: Disposition; className: string }[] = [
    { label: 'Do Today', disposition: 'today', className: 'bg-blue-600/20 border-blue-500/30 text-blue-300 hover:bg-blue-600/30' },
    { label: 'Tomorrow', disposition: 'tomorrow', className: 'bg-zinc-700 border-zinc-600 text-zinc-200 hover:bg-zinc-600' },
    { label: 'Next Week', disposition: 'next_week', className: 'bg-zinc-700 border-zinc-600 text-zinc-200 hover:bg-zinc-600' },
    { label: 'Delete', disposition: 'delete', className: 'bg-red-500/10 border-red-500/20 text-red-400 hover:bg-red-500/20' },
  ]

  const suggestionLabels: Record<Disposition, string> = {
    today: 'Do Today',
    tomorrow: 'Tomorrow',
    next_week: 'Next Week',
    delete: 'Delete',
  }

  return (
    <Sheet open={open} onOpenChange={v => { if (!v) onClose() }}>
      <SheetContent side="bottom" showCloseButton={false} className="bg-zinc-900 border-zinc-700 rounded-t-2xl p-0 max-h-[70vh]">
        {done ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <CheckCheck size={32} className="text-green-400 mb-3" />
            <p className="text-base font-semibold text-zinc-100">All caught up</p>
            <p className="text-sm text-zinc-400 mt-1">Overdue items cleared</p>
          </div>
        ) : item ? (
          <div className="p-5">
            {/* Header */}
            <div className="flex items-center justify-between mb-5">
              <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-widest">
                Triage · {index + 1} of {items.length}
              </p>
              <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 transition-colors">
                <X size={16} />
              </button>
            </div>

            {/* Progress bar */}
            <div className="h-1 bg-zinc-700 rounded-full mb-5">
              <div
                className="h-1 bg-blue-500 rounded-full transition-all duration-300"
                style={{ width: `${((index) / items.length) * 100}%` }}
              />
            </div>

            {/* Item */}
            <div className="mb-2">
              <p className="text-base font-semibold text-zinc-100 leading-snug">{item.title}</p>
              <div className="flex items-center gap-2 mt-1.5">
                <span className="text-xs text-red-400 font-medium">
                  {item.due_at ? ageLabel(item.due_at) : 'no date'}
                </span>
                {!loadingSuggestions && suggestion && (
                  <span className="text-[10px] text-zinc-500 bg-zinc-700 px-2 py-0.5 rounded-full">
                    Suggest: {suggestionLabels[suggestion]}
                  </span>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="grid grid-cols-2 gap-2 mt-4">
              {ACTIONS.map(({ label, disposition, className }) => (
                <button
                  key={disposition}
                  onClick={() => handleAction(disposition)}
                  className={cn(
                    'py-3 rounded-xl border text-sm font-semibold transition-colors',
                    className,
                    suggestion === disposition && 'ring-1 ring-blue-400/50'
                  )}
                >
                  {label}
                  {suggestion === disposition && (
                    <span className="ml-1 text-[9px] opacity-60">✦</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}
