'use client'
import { useState, useEffect, useCallback } from 'react'
import { format, isToday, isYesterday, startOfWeek } from 'date-fns'
import { useRouter } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { toast } from 'sonner'
import { Item } from '@/types'
import { ItemCard } from '@/components/item/item-card'

function groupByDate(items: Item[]): Record<string, Item[]> {
  const groups: Record<string, Item[]> = {}
  for (const item of items) {
    const d = item.completed_at ? new Date(item.completed_at) : new Date(item.updated_at)
    let label: string
    if (isToday(d)) label = 'Today'
    else if (isYesterday(d)) label = 'Yesterday'
    else if (d >= startOfWeek(new Date(), { weekStartsOn: 1 })) label = 'This week'
    else label = format(d, 'MMMM yyyy')
    if (!groups[label]) groups[label] = []
    groups[label].push(item)
  }
  return groups
}

export default function CompletedPage() {
  const router = useRouter()
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const res = await fetch('/api/items?filter=completed')
    const data = await res.json()
    setItems(data.items || [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function handleComplete(id: string) {
    // Un-complete
    setItems(prev => prev.filter(i => i.id !== id))
    await fetch(`/api/items/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'active' }),
    })
    toast('Restored to Today')
  }

  async function handleUpdate(id: string, updates: Partial<Item>) {
    setItems(prev => prev.map(i => i.id === id ? { ...i, ...updates } : i))
    await fetch(`/api/items/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updates) })
  }

  async function handleDelete(id: string) {
    setItems(prev => prev.filter(i => i.id !== id))
    await fetch(`/api/items/${id}`, { method: 'DELETE' })
  }

  const groups = groupByDate(items)
  const groupOrder = ['Today', 'Yesterday', 'This week', ...Object.keys(groups).filter(k => !['Today', 'Yesterday', 'This week'].includes(k))]

  return (
    <main className="px-4 pt-12 pb-8 max-w-lg">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} className="text-zinc-500 hover:text-zinc-100 transition-colors">
          <ChevronLeft size={20} />
        </button>
        <h1 className="text-2xl font-semibold">Completed</h1>
      </div>

      {loading && <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-16 rounded-xl bg-zinc-900/60 border border-zinc-800 animate-pulse" />)}</div>}

      {!loading && items.length === 0 && (
        <div className="text-center py-16 text-zinc-600">
          <p className="text-sm">Nothing completed yet.</p>
        </div>
      )}

      <div className="space-y-8">
        {groupOrder.filter(g => groups[g]?.length).map(group => (
          <section key={group}>
            <p className="text-[11px] font-medium text-zinc-500 uppercase tracking-widest mb-3">{group}</p>
            <div className="space-y-2">
              {groups[group].map(item => (
                <ItemCard key={item.id} item={item}
                  onComplete={handleComplete} onUpdate={handleUpdate} onDelete={handleDelete} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </main>
  )
}
