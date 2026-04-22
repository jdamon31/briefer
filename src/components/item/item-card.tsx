'use client'
import { useState } from 'react'
import { format, isToday, isTomorrow, isPast } from 'date-fns'
import { CheckCircle2, Circle, HelpCircle, Calendar, Tag } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Item, ItemTag, ALL_TAGS, TAG_COLORS } from '@/types'
import { Badge } from '@/components/ui/badge'

interface ItemCardProps {
  item: Item
  processing?: boolean
  onComplete: (id: string) => void
  onUpdate: (id: string, updates: Partial<Item>) => void
  onDelete: (id: string) => void
}

function formatDueAt(due_at: string | null): string {
  if (!due_at) return ''
  const d = new Date(due_at)
  if (isToday(d)) return format(d, 'h:mm a')
  if (isTomorrow(d)) return `Tomorrow ${format(d, 'h:mm a')}`
  return format(d, 'MMM d')
}

export function ItemCard({ item, processing, onComplete, onUpdate, onDelete }: ItemCardProps) {
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleDraft, setTitleDraft] = useState(item.title)
  const isDone = item.status === 'done'
  const isOverdue = item.due_at && isPast(new Date(item.due_at)) && !isDone

  function commitTitle() {
    setEditingTitle(false)
    if (titleDraft.trim() && titleDraft !== item.title) {
      onUpdate(item.id, { title: titleDraft.trim() })
    } else {
      setTitleDraft(item.title)
    }
  }

  return (
    <div className={cn(
      'group flex items-start gap-3 px-4 py-3 rounded-xl border transition-all',
      isDone ? 'opacity-50 border-zinc-800/50 bg-zinc-900/30' : 'border-zinc-800 bg-zinc-900/60',
      processing && 'animate-pulse'
    )}>
      {/* Checkbox */}
      <button
        onClick={() => onComplete(item.id)}
        className="mt-0.5 flex-shrink-0 text-zinc-500 hover:text-zinc-100 transition-colors"
      >
        {isDone
          ? <CheckCircle2 size={18} className="text-zinc-400" />
          : <Circle size={18} />
        }
      </button>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {editingTitle ? (
          <input
            autoFocus
            value={titleDraft}
            onChange={e => setTitleDraft(e.target.value)}
            onBlur={commitTitle}
            onKeyDown={e => e.key === 'Enter' && commitTitle()}
            className="w-full bg-transparent text-sm text-zinc-100 outline-none border-b border-zinc-600 pb-0.5"
          />
        ) : (
          <p
            onClick={() => { setEditingTitle(true); setTitleDraft(item.title) }}
            className={cn(
              'text-sm cursor-text leading-snug',
              isDone ? 'line-through text-zinc-500' : 'text-zinc-100',
              processing && 'text-zinc-400'
            )}
          >
            {processing ? item.raw_input || item.title : item.title}
          </p>
        )}

        {/* Chips row */}
        {!processing && (
          <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
            {item.due_at && (
              <button
                className={cn(
                  'text-[10px] font-medium px-2 py-0.5 rounded-full border transition-colors',
                  isOverdue
                    ? 'bg-red-500/10 text-red-400 border-red-500/20'
                    : 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:border-zinc-500'
                )}
              >
                {formatDueAt(item.due_at)}
              </button>
            )}

            <button
              onClick={() => onUpdate(item.id, { type: item.type === 'task' ? 'event' : 'task' })}
              className="text-[10px] font-medium px-2 py-0.5 rounded-full border bg-zinc-800 text-zinc-400 border-zinc-700 hover:border-zinc-500 transition-colors"
            >
              {item.type === 'event' ? <Calendar size={10} className="inline mr-1" /> : null}
              {item.type}
              {item.needs_review && <HelpCircle size={10} className="inline ml-1 text-amber-400" />}
            </button>

            {item.tags[0] && (
              <span className={cn(
                'text-[10px] font-medium px-2 py-0.5 rounded-full border',
                TAG_COLORS[item.tags[0]]
              )}>
                {item.tags[0]}
              </span>
            )}
          </div>
        )}

        {processing && (
          <p className="text-[10px] text-zinc-600 mt-1">Processing…</p>
        )}
      </div>
    </div>
  )
}
