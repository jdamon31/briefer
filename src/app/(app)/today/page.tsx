'use client'
import { useState, useEffect, useCallback } from 'react'
import { format } from 'date-fns'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { toast } from 'sonner'
import { Item } from '@/types'
import { ItemCard } from '@/components/item/item-card'
import { CaptureBar } from '@/components/layout/capture-bar'
import { DailyBriefCard } from '@/components/item/DailyBriefCard'
import { OverdueTriage } from '@/components/item/OverdueTriage'

export default function TodayPage() {
  const [items, setItems] = useState<Item[]>([])
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [showTodo, setShowTodo] = useState(true)
  const [showDone, setShowDone] = useState(false)
  const [showTriage, setShowTriage] = useState(false)

  const load = useCallback(async () => {
    const res = await fetch('/api/items?filter=today')
    const data = await res.json()
    setItems(data.items || [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function handleCapture(rawInput: string) {
    const tempId = `temp-${Date.now()}`
    const placeholder: Item = {
      id: tempId,
      user_id: '',
      type: 'task',
      title: rawInput,
      raw_input: rawInput,
      status: 'inbox',
      tags: [],
      notes: null,
      due_at: null,
      end_at: null,
      duration_minutes: null,
      location: null,
      classifier_confidence: null,
      needs_review: false,
      source: 'manual',
      google_event_id: null,
      google_etag: null,
      sync_pending: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      completed_at: null,
      recurrence: null,
    }

    setItems(prev => [placeholder, ...prev])
    setProcessingIds(prev => new Set(prev).add(tempId))

    const res = await fetch('/api/capture', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ raw_input: rawInput }),
    })
    const data = await res.json()
    const item: Item = data.item

    setItems(prev => prev.map(i => i.id === tempId ? item : i))
    setProcessingIds(prev => { const s = new Set(prev); s.delete(tempId); return s })

    const tag = item.tags[0] ? ` · ${item.tags[0].charAt(0).toUpperCase() + item.tags[0].slice(1)}` : ''
    const dest = item.due_at ? 'Today' : 'Inbox'
    toast(`Added to ${dest}${tag}`, { action: { label: 'Edit', onClick: () => {} } })
  }

  async function handleComplete(id: string) {
    const item = items.find(i => i.id === id)
    if (!item) return
    const newStatus = item.status === 'done' ? 'active' : 'done'
    setItems(prev => prev.map(i => i.id === id ? { ...i, status: newStatus } : i))
    await fetch(`/api/items/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    })
  }

  async function handleUpdate(id: string, updates: Partial<Item>) {
    setItems(prev => prev.map(i => i.id === id ? { ...i, ...updates } : i))
    await fetch(`/api/items/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    })
  }

  async function handleDelete(id: string) {
    setItems(prev => prev.filter(i => i.id !== id))
    await fetch(`/api/items/${id}`, { method: 'DELETE' })
    toast('Deleted', { action: { label: 'Undo', onClick: load } })
  }

  const overdue = items.filter(i => i.due_at && new Date(i.due_at) < new Date(new Date().setHours(0,0,0,0)) && i.status !== 'done')
  const todo = items.filter(i => !overdue.includes(i) && i.status !== 'done')
  const done = items.filter(i => i.status === 'done')

  return (
    <>
      <main className="px-4 pt-4 pb-4">
        <div className="mb-4">
          <p className="text-xs text-zinc-500 font-medium uppercase tracking-widest">
            {format(new Date(), 'EEEE, MMMM d')}
          </p>
          <h1 className="text-2xl font-semibold mt-1">Today</h1>
        </div>

        <DailyBriefCard />

        {loading && (
          <div className="space-y-2">
            {[1,2,3].map(i => <div key={i} className="h-16 rounded-xl bg-zinc-800 border border-zinc-700 animate-pulse" />)}
          </div>
        )}

        {!loading && (
          <div className="space-y-4">
            {/* To Do section */}
            <section>
              <button
                onClick={() => setShowTodo(v => !v)}
                className="flex items-center gap-1.5 mb-2 w-full text-left"
              >
                {showTodo
                  ? <ChevronDown size={13} className="text-zinc-400" />
                  : <ChevronRight size={13} className="text-zinc-400" />
                }
                <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-widest">
                  To Do{todo.length + overdue.length > 0 ? ` · ${todo.length + overdue.length}` : ''}
                </p>
              </button>
              {showTodo && (
                <div className="space-y-2">
                  {overdue.length >= 3 && (
                    <button
                      onClick={() => setShowTriage(true)}
                      className="w-full mb-1 py-2.5 px-4 rounded-xl border border-red-500/30 bg-red-500/10 text-sm font-semibold text-red-300 hover:bg-red-500/15 transition-colors"
                    >
                      Triage {overdue.length} overdue items
                    </button>
                  )}
                  {overdue.map(item => (
                    <div key={item.id}>
                      <p className="text-[10px] font-medium text-red-400 uppercase tracking-widest mb-1 ml-1">Overdue</p>
                      <ItemCard item={item} processing={processingIds.has(item.id)}
                        onComplete={handleComplete} onUpdate={handleUpdate} onDelete={handleDelete} />
                    </div>
                  ))}
                  {todo.map(item => (
                    <ItemCard key={item.id} item={item} processing={processingIds.has(item.id)}
                      onComplete={handleComplete} onUpdate={handleUpdate} onDelete={handleDelete} />
                  ))}
                  {todo.length === 0 && overdue.length === 0 && (
                    <p className="text-sm text-zinc-500 py-3 pl-1">All done for today.</p>
                  )}
                </div>
              )}
            </section>

            {/* Done section */}
            {done.length > 0 && (
              <section>
                <button
                  onClick={() => setShowDone(v => !v)}
                  className="flex items-center gap-1.5 mb-2 w-full text-left"
                >
                  {showDone
                    ? <ChevronDown size={13} className="text-zinc-500" />
                    : <ChevronRight size={13} className="text-zinc-500" />
                  }
                  <p className="text-[11px] font-semibold text-zinc-500 uppercase tracking-widest">
                    Completed · {done.length}
                  </p>
                </button>
                {showDone && (
                  <div className="space-y-2">
                    {done.map(item => (
                      <ItemCard key={item.id} item={item} processing={false}
                        onComplete={handleComplete} onUpdate={handleUpdate} onDelete={handleDelete} />
                    ))}
                  </div>
                )}
              </section>
            )}

            {items.length === 0 && (
              <div className="text-center py-16 text-zinc-400">
                <p className="text-sm">Nothing on the list.</p>
                <p className="text-xs mt-1">Capture something below.</p>
              </div>
            )}
          </div>
        )}
      </main>
      <CaptureBar onCapture={handleCapture} />
      <OverdueTriage
        items={overdue}
        open={showTriage}
        onClose={() => setShowTriage(false)}
        onUpdate={handleUpdate}
        onDelete={handleDelete}
      />
    </>
  )
}
