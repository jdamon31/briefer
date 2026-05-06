'use client'
import { useState, useRef, useEffect } from 'react'
import { X, ArrowUp } from 'lucide-react'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import type { ChatMessage } from '@/types'

interface BrieferChatProps {
  open: boolean
  onClose: () => void
}

const QUICK_PROMPTS = [
  'What should I focus on?',
  'Is my day too packed?',
  'Help me decide what to move',
  "What's most important?",
]

function ThinkingDots() {
  return (
    <div className="flex items-center gap-1 px-4 py-3">
      {[0, 1, 2].map(i => (
        <span
          key={i}
          className="w-1.5 h-1.5 rounded-full bg-zinc-500 animate-bounce"
          style={{ animationDelay: `${i * 150}ms` }}
        />
      ))}
    </div>
  )
}

export function BrieferChat({ open, onClose }: BrieferChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) {
      setMessages([])
      setInput('')
      setLoading(false)
    } else {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [open])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  async function sendMessage(text: string) {
    const trimmed = text.trim()
    if (!trimmed || loading) return

    const userMsg: ChatMessage = { role: 'user', content: trimmed }
    const next = [...messages, userMsg]
    setMessages(next)
    setInput('')
    setLoading(true)

    try {
      const res = await fetch('/api/chat/brief', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: next }),
      })
      const data = await res.json()
      setMessages(prev => [...prev, { role: 'assistant', content: data.reply }])
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Something went wrong. Try again.' }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={v => { if (!v) onClose() }}>
      <SheetContent side="bottom" showCloseButton={false} className="bg-zinc-900 border-zinc-700 rounded-t-2xl p-0 max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-zinc-800 flex-shrink-0">
          <p className="text-sm font-semibold text-zinc-100">Ask Briefer</p>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-5 py-3 space-y-3 min-h-0">
          {messages.length === 0 && !loading && (
            <div className="pt-2">
              <p className="text-xs text-zinc-500 mb-3">Quick questions:</p>
              <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                {QUICK_PROMPTS.map(prompt => (
                  <button
                    key={prompt}
                    onClick={() => sendMessage(prompt)}
                    className="flex-shrink-0 text-xs px-3 py-2 rounded-xl border border-zinc-700 bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-zinc-100 transition-colors"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div
              key={i}
              className={cn(
                'flex',
                msg.role === 'user' ? 'justify-end' : 'justify-start'
              )}
            >
              <div className={cn(
                'max-w-[85%] px-4 py-3 text-sm leading-relaxed',
                msg.role === 'user'
                  ? 'bg-zinc-700 text-zinc-100 rounded-2xl rounded-br-sm'
                  : 'bg-zinc-800 border border-zinc-700 text-zinc-200 rounded-2xl rounded-bl-sm'
              )}>
                {msg.content}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="bg-zinc-800 border border-zinc-700 rounded-2xl rounded-bl-sm">
                <ThinkingDots />
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="border-t border-zinc-800 p-3 flex gap-2 flex-shrink-0 pb-[max(12px,env(safe-area-inset-bottom))]">
          <input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && sendMessage(input)}
            placeholder="Ask anything about your day…"
            disabled={loading}
            className="flex-1 bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500 outline-none focus:border-zinc-500 transition-colors"
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || loading}
            className={cn(
              'flex-shrink-0 rounded-xl p-2.5 transition-all',
              input.trim() && !loading
                ? 'bg-white text-zinc-900 hover:bg-zinc-100'
                : 'bg-zinc-700 text-zinc-500 cursor-not-allowed'
            )}
          >
            <ArrowUp size={16} strokeWidth={2.5} />
          </button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
