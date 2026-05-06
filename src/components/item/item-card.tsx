'use client'
import { useState } from 'react'
import { useDrag } from '@use-gesture/react'
import { format, isToday, isTomorrow, isPast, addDays, nextSaturday, nextMonday } from 'date-fns'
import { CheckCircle2, Circle, HelpCircle, Calendar, Trash2, ChevronDown, ChevronRight, Repeat2, Star } from 'lucide-react'
import { cn, recurrenceLabel } from '@/lib/utils'
import { Item, ItemTag } from '@/types'
import { DatePickerPopover } from './date-picker-popover'
import { TagPickerPopover } from './tag-picker-popover'

interface ItemCardProps {
  item: Item
  processing?: boolean
  onComplete: (id: string) => void
  onUpdate: (id: string, updates: Partial<Item>) => void
  onDelete: (id: string) => void
}

function formatDueAt(due_at: string | null): string {
  if (!due_at) return 'No date'
  const d = new Date(due_at)
  if (isToday(d)) return format(d, 'h:mm a')
  if (isTomorrow(d)) return `Tomorrow ${format(d, 'h:mm a')}`
  return format(d, 'MMM d')
}

function getBumpDates() {
  const now = new Date()
  const tomorrow = addDays(now, 1)
  tomorrow.setHours(9, 0, 0, 0)
  const weekend = nextSaturday(now)
  weekend.setHours(10, 0, 0, 0)
  const nextWeek = nextMonday(now)
  nextWeek.setHours(9, 0, 0, 0)
  return { tomorrow, weekend, nextWeek }
}

function NotesSection({ notes, onSave }: { notes: string; onSave: (n: string) => void }) {
  const [expanded, setExpanded] = useState(false)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(notes)

  function commit() {
    setEditing(false)
    if (draft.trim() !== notes) onSave(draft.trim())
  }

  return (
    <div className="mt-1.5">
      <button
        onClick={() => setExpanded(v => !v)}
        className="flex items-center gap-1 text-[10px] text-zinc-500 hover:text-zinc-400 transition-colors"
      >
        {expanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
        <span className="truncate max-w-[200px]">{expanded ? 'Notes' : notes}</span>
      </button>
      {expanded && (
        editing ? (
          <textarea
            autoFocus
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={e => { if (e.key === 'Escape') { setEditing(false); setDraft(notes) } }}
            rows={2}
            className="mt-1 w-full bg-zinc-700/50 text-xs text-zinc-300 rounded-lg px-2 py-1.5 outline-none border border-zinc-600 resize-none"
          />
        ) : (
          <p
            onClick={() => setEditing(true)}
            className="mt-1 text-xs text-zinc-400 cursor-text leading-relaxed"
          >
            {notes}
          </p>
        )
      )}
    </div>
  )
}

export function ItemCard({ item, processing, onComplete, onUpdate, onDelete }: ItemCardProps) {
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleDraft, setTitleDraft] = useState(item.title)
  const [swipeX, setSwipeX] = useState(0)
  const [showBump, setShowBump] = useState(false)
  const [flashing, setFlashing] = useState<'complete' | null>(null)
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

  function handleBump(date: Date) {
    setShowBump(false)
    onUpdate(item.id, { due_at: date.toISOString(), status: 'active' })
  }

  const bind = useDrag(({ movement: [mx], last, cancel }) => {
    if (editingTitle) { cancel(); return }
    setSwipeX(mx)
    if (last) {
      if (mx > 72) {
        setFlashing('complete')
        setTimeout(() => {
          setFlashing(null)
          onComplete(item.id)
        }, 300)
      } else if (mx < -72) {
        setShowBump(true)
      }
      setSwipeX(0)
    }
  }, { axis: 'x', filterTaps: true })

  const { tomorrow, weekend, nextWeek } = getBumpDates()

  return (
    <>
      <div className="relative overflow-hidden rounded-xl">
        {/* Swipe indicators */}
        <div className={cn(
          'absolute inset-0 rounded-xl flex items-center px-5 transition-opacity',
          swipeX > 20 ? 'opacity-100' : 'opacity-0',
          'bg-green-500/20'
        )}>
          <CheckCircle2 size={20} className="text-green-400" />
        </div>
        <div className={cn(
          'absolute inset-0 rounded-xl flex items-center justify-end px-5 transition-opacity',
          swipeX < -20 ? 'opacity-100' : 'opacity-0',
          'bg-blue-500/20'
        )}>
          <Calendar size={20} className="text-blue-400" />
        </div>

        <div
          {...bind()}
          style={{ transform: `translateX(${Math.max(-100, Math.min(100, swipeX))}px)`, touchAction: 'pan-y' }}
          className={cn(
            'group flex items-start gap-3 px-4 py-3.5 rounded-xl border transition-colors',
            flashing === 'complete' && 'bg-green-500/20 border-green-500/40',
            item.pinned && !flashing && !isDone && 'border-l-2 border-l-amber-400',
            isDone
              ? 'opacity-70 border-zinc-700 bg-zinc-800/50'
              : !flashing ? 'border-zinc-700 bg-zinc-800 hover:border-zinc-600' : ''
          )}
        >
          {/* Checkbox */}
          <button
            onClick={() => onComplete(item.id)}
            className="mt-0.5 flex-shrink-0 text-zinc-500 hover:text-zinc-200 transition-colors"
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
                className="w-full bg-transparent text-sm text-zinc-100 outline-none border-b border-zinc-500 pb-0.5"
              />
            ) : (
              <p
                onClick={() => { setEditingTitle(true); setTitleDraft(item.title) }}
                className={cn(
                  'text-sm cursor-text leading-snug',
                  isDone ? 'line-through text-zinc-400' : 'text-zinc-100',
                  processing && 'text-zinc-400'
                )}
              >
                {processing ? item.raw_input || item.title : item.title}
              </p>
            )}

            {/* Chips row */}
            {!processing && (
              <div className="flex flex-wrap items-center gap-1.5 mt-2">
                <DatePickerPopover
                  dueAt={item.due_at}
                  isOverdue={!!isOverdue}
                  label={formatDueAt(item.due_at)}
                  onConfirm={(iso) => onUpdate(item.id, {
                    due_at: iso,
                    status: iso ? 'active' : 'inbox',
                  })}
                  recurrence={item.recurrence}
                  onRecurrenceChange={(r) => onUpdate(item.id, { recurrence: r })}
                />

                <button
                  onClick={() => onUpdate(item.id, { type: item.type === 'task' ? 'event' : 'task' })}
                  className="text-[10px] font-semibold px-2 py-0.5 rounded-full border bg-zinc-700 text-zinc-300 border-zinc-600 hover:border-zinc-400 hover:text-zinc-100 transition-colors"
                >
                  {item.type === 'event' ? <Calendar size={10} className="inline mr-1" /> : null}
                  {item.type}
                  {item.needs_review && <HelpCircle size={10} className="inline ml-1 text-amber-300" />}
                </button>

                <TagPickerPopover
                  currentTag={item.tags[0] as ItemTag | undefined}
                  onSelect={(tag) => onUpdate(item.id, { tags: [tag] })}
                />

                {item.recurrence && (
                  <span className="flex items-center gap-1 text-[10px] text-blue-400 px-2 py-0.5 rounded-full border border-blue-500/20 bg-blue-500/10">
                    <Repeat2 size={9} />
                    {recurrenceLabel(item.recurrence)}
                    {(item.streak ?? 0) > 1 && (
                      <span className="text-amber-400 ml-0.5">· {item.streak}</span>
                    )}
                  </span>
                )}
              </div>
            )}

            {/* Notes */}
            {!processing && item.notes && (
              <NotesSection
                notes={item.notes}
                onSave={(n) => onUpdate(item.id, { notes: n })}
              />
            )}

            {processing && (
              <p className="text-[10px] text-zinc-500 mt-1">Processing…</p>
            )}
          </div>

          {/* Pin button */}
          {!processing && (
            <button
              onClick={e => { e.stopPropagation(); onUpdate(item.id, { pinned: !item.pinned }) }}
              className={cn(
                'flex-shrink-0 mt-0.5 transition-all',
                item.pinned
                  ? 'text-amber-400 opacity-100'
                  : 'text-zinc-600 opacity-0 group-hover:opacity-100'
              )}
            >
              <Star size={14} fill={item.pinned ? 'currentColor' : 'none'} />
            </button>
          )}
        </div>
      </div>

      {/* Bump sheet */}
      {showBump && (
        <div className="mt-1 p-3 rounded-xl border border-zinc-700 bg-zinc-800 space-y-1 animate-in slide-in-from-top-2">
          <p className="text-[10px] text-zinc-400 font-medium uppercase tracking-widest mb-2">Reschedule to…</p>
          {[
            { label: 'Tomorrow', date: tomorrow },
            { label: 'This Weekend', date: weekend },
            { label: 'Next Week', date: nextWeek },
          ].map(({ label, date }) => (
            <button
              key={label}
              onClick={() => handleBump(date)}
              className="w-full text-left px-3 py-2 rounded-lg text-sm text-zinc-200 hover:bg-zinc-700 transition-colors flex justify-between"
            >
              {label}
              <span className="text-zinc-500 text-xs">{format(date, 'EEE, MMM d')}</span>
            </button>
          ))}
          <DatePickerPopover
            dueAt={item.due_at}
            isOverdue={false}
            label="Pick date…"
            onConfirm={(iso) => { if (iso) { handleBump(new Date(iso)); setShowBump(false) } }}
            triggerClassName="w-full text-left px-3 py-2 rounded-lg text-sm text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200 transition-colors"
          />
          <div className="flex gap-2 pt-1">
            <button
              onClick={() => { setShowBump(false); onDelete(item.id) }}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs text-red-400 hover:bg-red-500/10 transition-colors"
            >
              <Trash2 size={12} /> Delete
            </button>
            <button
              onClick={() => setShowBump(false)}
              className="flex-1 text-center px-3 py-2 rounded-lg text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </>
  )
}
