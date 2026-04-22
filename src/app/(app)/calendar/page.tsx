'use client'
import { useState, useEffect, useCallback } from 'react'
import { format, startOfWeek, addDays, isSameDay, startOfDay, endOfDay } from 'date-fns'
import { ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { Item } from '@/types'
import { ItemCard } from '@/components/item/item-card'
import { CaptureBar } from '@/components/layout/capture-bar'
import { cn } from '@/lib/utils'

export default function CalendarPage() {
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [weekStart, setWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }))
  const [items, setItems] = useState<Item[]>([])
  const [syncing, setSyncing] = useState(false)

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))

  const load = useCallback(async () => {
    const from = startOfDay(weekStart).toISOString()
    const to = endOfDay(addDays(weekStart, 6)).toISOString()
    const res = await fetch(`/api/items?from=${from}&to=${to}`)
    const data = await res.json()
    setItems(data.items || [])
  }, [weekStart])

  useEffect(() => { load() }, [load])

  const dayItems = items.filter(i => i.due_at && isSameDay(new Date(i.due_at), selectedDate))

  async function handleSync() {
    setSyncing(true)
    try {
      await fetch('/api/integrations/google/sync', { method: 'POST' })
      await load()
      toast('Calendar synced')
    } catch {
      toast.error('Sync failed')
    } finally {
      setSyncing(false)
    }
  }

  async function handleCapture(rawInput: string) {
    const res = await fetch('/api/capture', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ raw_input: rawInput }),
    })
    const data = await res.json()
    if (data.item.due_at) await load()
    toast('Added')
  }

  async function handleComplete(id: string) {
    setItems(prev => prev.map(i => i.id === id ? { ...i, status: i.status === 'done' ? 'active' : 'done' } : i))
    const item = items.find(i => i.id === id)!
    await fetch(`/api/items/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: item.status === 'done' ? 'active' : 'done' }) })
  }

  async function handleUpdate(id: string, updates: Partial<Item>) {
    setItems(prev => prev.map(i => i.id === id ? { ...i, ...updates } : i))
    await fetch(`/api/items/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updates) })
  }

  async function handleDelete(id: string) {
    setItems(prev => prev.filter(i => i.id !== id))
    await fetch(`/api/items/${id}`, { method: 'DELETE' })
    toast('Deleted')
  }

  return (
    <>
      <main className="px-4 pt-12 pb-4">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-semibold">Calendar</h1>
          <button
            onClick={handleSync}
            className="text-xs text-zinc-400 hover:text-zinc-100 flex items-center gap-1 transition-colors"
          >
            <RefreshCw size={12} className={syncing ? 'animate-spin' : ''} />
            Sync now
          </button>
        </div>

        {/* Week navigation */}
        <div className="flex items-center gap-2 mb-3">
          <button onClick={() => setWeekStart(d => addDays(d, -7))} className="p-1 text-zinc-500 hover:text-zinc-100 transition-colors">
            <ChevronLeft size={16} />
          </button>
          <span className="text-xs text-zinc-500 flex-1 text-center">
            {format(weekStart, 'MMM d')} – {format(addDays(weekStart, 6), 'MMM d, yyyy')}
          </span>
          <button onClick={() => setWeekStart(d => addDays(d, 7))} className="p-1 text-zinc-500 hover:text-zinc-100 transition-colors">
            <ChevronRight size={16} />
          </button>
        </div>

        {/* Day pills */}
        <div className="grid grid-cols-7 gap-1 mb-6">
          {weekDays.map(day => {
            const hasItems = items.some(i => i.due_at && isSameDay(new Date(i.due_at), day))
            const isSelected = isSameDay(day, selectedDate)
            const isToday = isSameDay(day, new Date())
            return (
              <button
                key={day.toISOString()}
                onClick={() => setSelectedDate(day)}
                className={cn(
                  'flex flex-col items-center py-2 rounded-xl transition-all',
                  isSelected ? 'bg-zinc-100 text-zinc-900' : 'text-zinc-400 hover:text-zinc-100'
                )}
              >
                <span className="text-[9px] uppercase font-medium">{format(day, 'EEE')}</span>
                <span className={cn('text-sm font-semibold mt-0.5', isToday && !isSelected && 'text-blue-400')}>
                  {format(day, 'd')}
                </span>
                {hasItems && <span className={cn('w-1 h-1 rounded-full mt-1', isSelected ? 'bg-zinc-600' : 'bg-zinc-500')} />}
              </button>
            )
          })}
        </div>

        {/* Items for selected day */}
        <div>
          <p className="text-[11px] font-medium text-zinc-500 uppercase tracking-widest mb-3">
            {format(selectedDate, 'EEEE, MMMM d')}
          </p>
          {dayItems.length === 0 ? (
            <div className="text-center py-12 text-zinc-600">
              <p className="text-sm">Nothing scheduled.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {dayItems.map(item => (
                <ItemCard key={item.id} item={item}
                  onComplete={handleComplete} onUpdate={handleUpdate} onDelete={handleDelete} />
              ))}
            </div>
          )}
        </div>
      </main>
      <CaptureBar onCapture={handleCapture} />
    </>
  )
}
