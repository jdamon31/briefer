'use client'
import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { Item } from '@/types'
import { ItemCard } from '@/components/item/item-card'
import { CaptureBar } from '@/components/layout/capture-bar'

export default function InboxPage() {
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const res = await fetch('/api/items?filter=inbox')
    const data = await res.json()
    setItems(data.items || [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function handleCapture(rawInput: string) {
    const res = await fetch('/api/capture', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ raw_input: rawInput }),
    })
    const data = await res.json()
    if (data.item.status === 'inbox') {
      setItems(prev => [data.item, ...prev])
    }
    toast('Added to Inbox')
  }

  async function handleComplete(id: string) {
    setItems(prev => prev.filter(i => i.id !== id))
    await fetch(`/api/items/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'done' }),
    })
  }

  async function handleUpdate(id: string, updates: Partial<Item>) {
    const item = items.find(i => i.id === id)
    if (!item) return

    // If a date is assigned, remove from inbox
    if (updates.due_at) {
      setItems(prev => prev.filter(i => i.id !== id))
      toast('Moved to Today')
    } else {
      setItems(prev => prev.map(i => i.id === id ? { ...i, ...updates } : i))
    }

    await fetch(`/api/items/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...updates, status: updates.due_at ? 'active' : undefined }),
    })
  }

  async function handleDelete(id: string) {
    setItems(prev => prev.filter(i => i.id !== id))
    await fetch(`/api/items/${id}`, { method: 'DELETE' })
    toast('Deleted', { action: { label: 'Undo', onClick: load } })
  }

  return (
    <>
      <main className="px-4 pt-12 pb-4">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold">Inbox</h1>
          <p className="text-sm text-zinc-300 mt-0.5">
            {items.length === 0 ? 'Empty' : `${items.length} item${items.length !== 1 ? 's' : ''} without a date`}
          </p>
        </div>

        {items.length >= 5 && (
          <div className="mb-4 p-3 rounded-xl border border-zinc-700 bg-zinc-900/60 flex items-center justify-between">
            <p className="text-sm text-zinc-300">Review your inbox?</p>
            <button className="text-sm text-zinc-100 font-medium hover:text-white transition-colors">
              Go through {items.length} →
            </button>
          </div>
        )}

        {loading && (
          <div className="space-y-2">
            {[1,2,3].map(i => <div key={i} className="h-16 rounded-xl bg-zinc-800 border border-zinc-700 animate-pulse" />)}
          </div>
        )}

        {!loading && items.length === 0 && (
          <div className="text-center py-16 text-zinc-400">
            <p className="text-sm">Inbox zero.</p>
            <p className="text-xs mt-1">Everything has a date.</p>
          </div>
        )}

        <div className="space-y-2">
          {items.map(item => (
            <ItemCard key={item.id} item={item}
              onComplete={handleComplete} onUpdate={handleUpdate} onDelete={handleDelete} />
          ))}
        </div>
      </main>
      <CaptureBar onCapture={handleCapture} />
    </>
  )
}
