'use client'
import { useState, useRef } from 'react'
import { Plus, ArrowUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

const PLACEHOLDERS = [
  'Meet Rivera Thursday 2pm…',
  'Pick up dry cleaning Friday…',
  'Call the dentist…',
  'Dentist appt next Tuesday at 3…',
  'Finish the Q2 report by EOD…',
]

interface CaptureBarProps {
  onCapture: (rawInput: string, manual?: boolean) => void
}

export function CaptureBar({ onCapture }: CaptureBarProps) {
  const [value, setValue] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const placeholder = PLACEHOLDERS[Math.floor(Date.now() / 8000) % PLACEHOLDERS.length]

  async function submit(manual = false) {
    const text = value.trim()
    if (!text) return
    setSubmitting(true)
    setValue('')
    try {
      await onCapture(text, manual)
    } catch {
      toast.error('Failed to save item')
      setValue(text)
    } finally {
      setSubmitting(false)
      inputRef.current?.focus()
    }
  }

  return (
    <div className="fixed bottom-[57px] inset-x-0 px-3 pb-2 bg-gradient-to-t from-zinc-950 via-zinc-950/95 to-transparent pt-6">
      <div className="flex gap-2 items-center bg-zinc-900 border border-zinc-800 rounded-2xl px-4 py-2.5 shadow-xl">
        <button
          onClick={() => submit(true)}
          className="text-zinc-500 hover:text-zinc-300 transition-colors flex-shrink-0"
          title="Add manually (no AI)"
        >
          <Plus size={18} />
        </button>
        <input
          ref={inputRef}
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && submit()}
          placeholder={placeholder}
          className="flex-1 bg-transparent text-sm text-zinc-100 placeholder:text-zinc-600 outline-none"
          disabled={submitting}
        />
        <button
          onClick={() => submit()}
          disabled={!value.trim() || submitting}
          className={cn(
            'flex-shrink-0 rounded-full p-1.5 transition-all',
            value.trim() && !submitting
              ? 'bg-zinc-100 text-zinc-900 hover:bg-white'
              : 'bg-zinc-800 text-zinc-600 cursor-not-allowed'
          )}
        >
          <ArrowUp size={16} strokeWidth={2.5} />
        </button>
      </div>
    </div>
  )
}
