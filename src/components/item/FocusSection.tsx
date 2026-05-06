'use client'
import { useState } from 'react'
import { Star, Sparkles, ChevronDown, ChevronRight } from 'lucide-react'
import { toast } from 'sonner'
import { Item } from '@/types'
import { ItemCard } from './item-card'

interface FocusSectionProps {
  items: Item[]
  processingIds: Set<string>
  onComplete: (id: string) => void
  onUpdate: (id: string, updates: Partial<Item>) => void
  onDelete: (id: string) => void
}

export function FocusSection({ items, processingIds, onComplete, onUpdate, onDelete }: FocusSectionProps) {
  const [expanded, setExpanded] = useState(true)
  const [suggesting, setSuggesting] = useState(false)

  async function handleAISuggest() {
    const available = 3 - items.length
    if (available <= 0) {
      toast('Already at 3 focus items — unpin one first')
      return
    }

    setSuggesting(true)
    try {
      const res = await fetch('/api/focus/suggest', { method: 'POST' })
      const data = await res.json()
      const suggestions: string[] = data.suggestions || []

      if (!suggestions.length) {
        toast('No suggestions — all set!')
        return
      }

      suggestions.slice(0, available).forEach(id => onUpdate(id, { pinned: true }))

      if (data.reasoning) {
        toast(data.reasoning)
      }
    } catch {
      toast.error('Could not load suggestions')
    } finally {
      setSuggesting(false)
    }
  }

  return (
    <section>
      <div className="flex items-center justify-between mb-2">
        <button
          onClick={() => setExpanded(v => !v)}
          className="flex items-center gap-1.5 text-left"
        >
          {expanded
            ? <ChevronDown size={13} className="text-amber-400" />
            : <ChevronRight size={13} className="text-amber-400" />
          }
          <Star size={11} className="text-amber-400" fill="currentColor" />
          <p className="text-[11px] font-semibold text-amber-400 uppercase tracking-widest">
            Focus · {items.length}
          </p>
        </button>
        <button
          onClick={handleAISuggest}
          disabled={suggesting}
          className="flex items-center gap-1 text-[10px] text-zinc-400 hover:text-zinc-200 transition-colors disabled:opacity-50"
        >
          <Sparkles size={11} />
          {suggesting ? 'Thinking…' : 'AI suggest'}
        </button>
      </div>

      {expanded && (
        <div className="bg-amber-500/5 border border-amber-500/15 rounded-xl p-3 space-y-2">
          {items.length === 0 ? (
            <div className="py-3 flex flex-col items-center gap-3 text-center">
              <p className="text-xs text-zinc-400 leading-relaxed">
                Pin up to 3 items as your most important tasks for today.
              </p>
              <button
                onClick={handleAISuggest}
                disabled={suggesting}
                className="flex items-center gap-1.5 text-xs font-semibold text-amber-400 hover:text-amber-300 transition-colors disabled:opacity-50"
              >
                <Sparkles size={12} />
                {suggesting ? 'Thinking…' : 'AI suggest focus'}
              </button>
            </div>
          ) : (
            items.map(item => (
              <ItemCard
                key={item.id}
                item={item}
                processing={processingIds.has(item.id)}
                onComplete={onComplete}
                onUpdate={onUpdate}
                onDelete={onDelete}
              />
            ))
          )}
        </div>
      )}
    </section>
  )
}
