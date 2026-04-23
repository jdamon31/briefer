'use client'
import { useState } from 'react'
import { format } from 'date-fns'
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface DatePickerPopoverProps {
  dueAt: string | null
  isOverdue: boolean
  label: string
  onConfirm: (isoDate: string | null) => void
}

export function DatePickerPopover({ dueAt, isOverdue, label, onConfirm }: DatePickerPopoverProps) {
  const [open, setOpen] = useState(false)

  const currentValue = dueAt
    ? format(new Date(dueAt), "yyyy-MM-dd'T'HH:mm")
    : ''

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value
    if (!val) return
    onConfirm(new Date(val).toISOString())
    setOpen(false)
  }

  function handleClear() {
    onConfirm(null)
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className={cn(
          'text-[10px] font-semibold px-2 py-0.5 rounded-full border transition-colors cursor-pointer',
          isOverdue
            ? 'bg-red-500/15 text-red-300 border-red-500/30 hover:border-red-400'
            : 'bg-zinc-700 text-zinc-300 border-zinc-600 hover:border-zinc-400 hover:text-zinc-100'
        )}
      >
        {label}
      </PopoverTrigger>
      <PopoverContent className="w-64 bg-zinc-800 border-zinc-700 p-3" align="start">
        <p className="text-[10px] text-zinc-400 font-medium uppercase tracking-widest mb-2">Set date & time</p>
        <input
          type="datetime-local"
          defaultValue={currentValue}
          onChange={handleChange}
          className="w-full bg-zinc-700 border border-zinc-600 rounded-lg px-3 py-2 text-sm text-zinc-100 outline-none focus:border-zinc-400 transition-colors"
        />
        {dueAt && (
          <button
            onClick={handleClear}
            className="mt-2 flex items-center gap-1.5 text-xs text-zinc-400 hover:text-red-400 transition-colors"
          >
            <X size={12} /> Remove date (move to Inbox)
          </button>
        )}
      </PopoverContent>
    </Popover>
  )
}
