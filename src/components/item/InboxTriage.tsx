'use client'
import { useState, useEffect } from 'react'
import { addDays, nextMonday, nextFriday, format, isFriday } from 'date-fns'
import { X, CheckCheck, Trash2 } from 'lucide-react'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { Item } from '@/types'
import { cn } from '@/lib/utils'

type Disposition = 'today' | 'this_week' | 'next_week' | 'keep' | 'delete'

interface InboxTriageProps {
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
  const thisWeek = isFriday(now) ? addDays(now, 7) : nextFriday(now)
  thisWeek.setHours(9, 0, 0, 0)
  const nextWeek = nextMonday(now); nextWeek.setHours(9, 0, 0, 0)
  return { today, tomorrow, thisWeek, nextWeek }
}

const ACTIONS: { label: string; sub: string; disposition: Disposition; className: string }[] = [
  {
    label: 'Do Today',
    sub: 'assign to today',
    disposition: 'today',
    className: 'bg-blue-600/20 border-blue-500/30 text-blue-300 hover:bg-blue-600/30',
  },
  {
    label: 'This Week',
    sub: 'by Friday',
    disposition: 'this_week',
    className: 'bg-zinc-700 border-zinc-600 text-zinc-200 hover:bg-zinc-600',
  },
  {
    label: 'Next Week',
    sub: 'Monday',
    disposition: 'next_week',
    className: 'bg-zinc-700 border-zinc-600 text-zinc-200 hover:bg-zinc-600',
  },
  {
    label: 'Keep',
    sub: 'decide later',
    disposition: 'keep',
    className: 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200',
  },
]

export function InboxTriage({ items, open, onClose, onUpdate, onDelete }: InboxTriageProps) {
  const [index, setIndex] = useState(0)
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (!open) { setIndex(0); setDone(false) }
  }, [open])

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
    const { today, thisWeek, nextWeek } = getDates()

    if (disposition === 'delete') {
      onDelete(item.id)
    } else if (disposition === 'keep') {
      // no-op — stays in inbox
    } else {
      const due = disposition === 'today' ? today : disposition === 'this_week' ? thisWeek : nextWeek
      onUpdate(item.id, { due_at: due.toISOString(), status: 'active' })
    }
    advance()
  }

  const item = items[index]
  const { today, thisWeek, nextWeek } = getDates()
  const dateLabelMap: Record<Disposition, string> = {
    today: format(today, 'EEE, MMM d'),
    this_week: format(thisWeek, 'EEE, MMM d'),
    next_week: format(nextWeek, 'EEE, MMM d'),
    keep: '',
    delete: '',
  }

  return (
    <Sheet open={open} onOpenChange={v => { if (!v) onClose() }}>
      <SheetContent side="bottom" showCloseButton={false} className="bg-zinc-900 border-zinc-700 rounded-t-2xl p-0 max-h-[70vh]">
        {done ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <CheckCheck size={32} className="text-green-400 mb-3" />
            <p className="text-base font-semibold text-zinc-100">Inbox cleared</p>
            <p className="text-sm text-zinc-400 mt-1">Everything has a plan</p>
          </div>
        ) : item ? (
          <div className="p-5">
            {/* Header */}
            <div className="flex items-center justify-between mb-5">
              <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-widest">
                Inbox · {index + 1} of {items.length}
              </p>
              <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 transition-colors">
                <X size={16} />
              </button>
            </div>

            {/* Progress bar */}
            <div className="h-1 bg-zinc-700 rounded-full mb-5">
              <div
                className="h-1 bg-blue-500 rounded-full transition-all duration-300"
                style={{ width: `${(index / items.length) * 100}%` }}
              />
            </div>

            {/* Item */}
            <div className="mb-5">
              <p className="text-base font-semibold text-zinc-100 leading-snug">{item.title}</p>
              {item.notes && (
                <p className="text-xs text-zinc-500 mt-1 leading-relaxed line-clamp-2">{item.notes}</p>
              )}
              {item.tags.length > 0 && (
                <span className="inline-block mt-2 text-[10px] px-2 py-0.5 rounded-full border border-zinc-600 bg-zinc-700 text-zinc-400">
                  {item.tags[0]}
                </span>
              )}
            </div>

            {/* Action grid */}
            <div className="grid grid-cols-2 gap-2">
              {ACTIONS.map(({ label, sub, disposition, className }) => (
                <button
                  key={disposition}
                  onClick={() => handleAction(disposition)}
                  className={cn(
                    'py-3 px-4 rounded-xl border text-left transition-colors',
                    className
                  )}
                >
                  <p className="text-sm font-semibold">{label}</p>
                  <p className="text-[10px] opacity-60 mt-0.5">
                    {dateLabelMap[disposition] || sub}
                  </p>
                </button>
              ))}
            </div>

            {/* Delete */}
            <button
              onClick={() => handleAction('delete')}
              className="mt-3 w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 transition-colors"
            >
              <Trash2 size={12} />
              Delete
            </button>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}
