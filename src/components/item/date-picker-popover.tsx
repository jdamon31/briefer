'use client'
import { useState } from 'react'
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval,
  getDay, isSameDay, isBefore, startOfDay, addMonths, subMonths,
} from 'date-fns'
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover'
import { ChevronLeft, ChevronRight, X, Repeat2 } from 'lucide-react'
import { cn, recurrenceLabel } from '@/lib/utils'

const ISO_DAYS = [
  { label: 'M', value: '1' },
  { label: 'T', value: '2' },
  { label: 'W', value: '3' },
  { label: 'T', value: '4' },
  { label: 'F', value: '5' },
  { label: 'S', value: '6' },
  { label: 'S', value: '7' },
]

function RepeatPicker({ recurrence, onChange }: { recurrence: string | null; onChange: (r: string | null) => void }) {
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<'none' | 'daily' | 'weekly' | 'monthly'>(
    recurrence === 'daily' ? 'daily'
    : recurrence?.startsWith('weekly:') ? 'weekly'
    : recurrence?.startsWith('monthly:') ? 'monthly'
    : 'none'
  )
  const [weekDay, setWeekDay] = useState(recurrence?.startsWith('weekly:') ? recurrence.split(':')[1] : '1')
  const [monthDay, setMonthDay] = useState(recurrence?.startsWith('monthly:') ? recurrence.split(':')[1] : '1')

  function commit(m: typeof mode, wd = weekDay, md = monthDay) {
    if (m === 'none') { onChange(null); setOpen(false); return }
    if (m === 'daily') { onChange('daily'); setOpen(false); return }
    if (m === 'weekly') { onChange(`weekly:${wd}`); setOpen(false); return }
    if (m === 'monthly') { onChange(`monthly:${md}`); setOpen(false); return }
  }

  const label = recurrenceLabel(recurrence)
  const hasRepeat = recurrence && recurrence !== null

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger className={cn(
        'flex items-center gap-1 text-xs transition-colors',
        hasRepeat ? 'text-blue-400 hover:text-blue-300' : 'text-zinc-500 hover:text-zinc-300'
      )}>
        <Repeat2 size={11} />
        {hasRepeat ? label : 'Repeat'}
      </PopoverTrigger>
      <PopoverContent className="w-52 bg-zinc-800 border-zinc-700 p-3 space-y-2" align="start">
        <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-widest mb-2">Repeat</p>
        {(['none', 'daily', 'weekly', 'monthly'] as const).map(m => (
          <button
            key={m}
            onClick={() => { setMode(m); if (m !== 'weekly' && m !== 'monthly') commit(m) }}
            className={cn(
              'w-full text-left px-3 py-2 rounded-lg text-sm transition-colors capitalize',
              mode === m ? 'bg-blue-600 text-white' : 'text-zinc-300 hover:bg-zinc-700'
            )}
          >
            {m === 'none' ? 'No repeat' : m.charAt(0).toUpperCase() + m.slice(1)}
          </button>
        ))}

        {mode === 'weekly' && (
          <div className="pt-1 border-t border-zinc-700">
            <p className="text-[10px] text-zinc-500 mb-2">Day of week</p>
            <div className="flex gap-1">
              {ISO_DAYS.map(d => (
                <button
                  key={d.value}
                  onClick={() => { setWeekDay(d.value); commit('weekly', d.value) }}
                  className={cn(
                    'w-7 h-7 text-[10px] font-semibold rounded-lg transition-colors',
                    weekDay === d.value ? 'bg-blue-600 text-white' : 'bg-zinc-700 text-zinc-300 hover:bg-zinc-600'
                  )}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {mode === 'monthly' && (
          <div className="pt-1 border-t border-zinc-700">
            <p className="text-[10px] text-zinc-500 mb-2">Day of month</p>
            <input
              type="number"
              min={1}
              max={28}
              value={monthDay}
              onChange={e => setMonthDay(e.target.value)}
              onBlur={() => commit('monthly')}
              className="w-full bg-zinc-700 text-zinc-100 text-sm rounded-lg px-3 py-1.5 outline-none border border-zinc-600"
            />
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}

interface DatePickerPopoverProps {
  dueAt: string | null
  isOverdue: boolean
  label: string
  onConfirm: (isoDate: string | null) => void
  triggerClassName?: string
  recurrence?: string | null
  onRecurrenceChange?: (r: string | null) => void
}

function parseTime(timeStr: string): { hour: number; minute: number; ampm: 'AM' | 'PM' } {
  const [h, m] = timeStr.split(':').map(Number)
  const ampm = h < 12 ? 'AM' : 'PM'
  const hour = h % 12 === 0 ? 12 : h % 12
  const minute = Math.round(m / 15) * 15 === 60 ? 0 : Math.round(m / 15) * 15
  return { hour, minute, ampm }
}

function toTimeString(hour: number, minute: number, ampm: 'AM' | 'PM'): string {
  const h24 = ampm === 'AM' ? (hour === 12 ? 0 : hour) : (hour === 12 ? 12 : hour + 12)
  return `${String(h24).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

export function DatePickerPopover({ dueAt, isOverdue, label, onConfirm, triggerClassName, recurrence, onRecurrenceChange }: DatePickerPopoverProps) {
  const [open, setOpen] = useState(false)
  const initial = dueAt ? new Date(dueAt) : null
  const [viewMonth, setViewMonth] = useState(initial ?? new Date())
  const [selectedDate, setSelectedDate] = useState<Date | null>(initial)

  const initTime = initial
    ? parseTime(format(initial, 'HH:mm'))
    : { hour: 9, minute: 0, ampm: 'AM' as const }
  const [hour, setHour] = useState(initTime.hour)
  const [minute, setMinute] = useState(initTime.minute)
  const [ampm, setAmpm] = useState<'AM' | 'PM'>(initTime.ampm)

  const today = startOfDay(new Date())
  const monthStart = startOfMonth(viewMonth)
  const monthEnd = endOfMonth(viewMonth)
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd })
  const leadingBlanks = getDay(monthStart)

  function handleConfirm() {
    if (!selectedDate) return
    const timeStr = toTimeString(hour, minute, ampm)
    const [h, m] = timeStr.split(':').map(Number)
    const dt = new Date(selectedDate)
    dt.setHours(h, m, 0, 0)
    onConfirm(dt.toISOString())
    setOpen(false)
  }

  function handleClear() {
    onConfirm(null)
    setOpen(false)
  }

  const hours = [1,2,3,4,5,6,7,8,9,10,11,12]
  const minutes = [0, 15, 30, 45]

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className={triggerClassName ?? cn(
          'text-[10px] font-semibold px-2 py-0.5 rounded-full border transition-colors cursor-pointer',
          isOverdue
            ? 'bg-red-500/15 text-red-300 border-red-500/30 hover:border-red-400'
            : 'bg-zinc-700 text-zinc-300 border-zinc-600 hover:border-zinc-400 hover:text-zinc-100'
        )}
      >
        {label}
      </PopoverTrigger>
      <PopoverContent className="w-72 bg-zinc-800 border-zinc-700 p-3" align="start">
        {/* Month nav */}
        <div className="flex items-center justify-between mb-3">
          <button
            onClick={() => setViewMonth(m => subMonths(m, 1))}
            className="p-1 rounded hover:bg-zinc-700 text-zinc-400 hover:text-zinc-100 transition-colors"
          >
            <ChevronLeft size={14} />
          </button>
          <span className="text-xs font-semibold text-zinc-200">
            {format(viewMonth, 'MMMM yyyy')}
          </span>
          <button
            onClick={() => setViewMonth(m => addMonths(m, 1))}
            className="p-1 rounded hover:bg-zinc-700 text-zinc-400 hover:text-zinc-100 transition-colors"
          >
            <ChevronRight size={14} />
          </button>
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7 mb-1">
          {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
            <div key={d} className="text-center text-[10px] text-zinc-500 font-medium py-0.5">{d}</div>
          ))}
        </div>

        {/* Day grid */}
        <div className="grid grid-cols-7">
          {Array.from({ length: leadingBlanks }).map((_, i) => (
            <div key={`blank-${i}`} />
          ))}
          {days.map(day => {
            const isPast = isBefore(startOfDay(day), today)
            const isSelected = selectedDate ? isSameDay(day, selectedDate) : false
            const isToday = isSameDay(day, today)
            return (
              <button
                key={day.toISOString()}
                disabled={isPast}
                onClick={() => setSelectedDate(day)}
                className={cn(
                  'text-xs rounded-lg py-1.5 transition-colors font-medium',
                  isPast && 'text-zinc-600 cursor-default',
                  !isPast && !isSelected && 'text-zinc-300 hover:bg-zinc-700',
                  isToday && !isSelected && 'text-blue-400',
                  isSelected && 'bg-blue-600 text-white',
                )}
              >
                {format(day, 'd')}
              </button>
            )
          })}
        </div>

        {/* Time picker */}
        <div className="mt-3 border-t border-zinc-700 pt-3 space-y-2">
          {/* Hours */}
          <div className="flex gap-1 flex-wrap">
            {hours.map(h => (
              <button
                key={h}
                onClick={() => setHour(h)}
                className={cn(
                  'w-8 h-7 text-xs rounded-lg font-medium transition-colors',
                  hour === h
                    ? 'bg-blue-600 text-white'
                    : 'bg-zinc-700 text-zinc-300 hover:bg-zinc-600'
                )}
              >
                {h}
              </button>
            ))}
          </div>

          {/* Minutes + AM/PM */}
          <div className="flex items-center gap-2">
            <div className="flex gap-1">
              {minutes.map(m => (
                <button
                  key={m}
                  onClick={() => setMinute(m)}
                  className={cn(
                    'w-10 h-7 text-xs rounded-lg font-medium transition-colors',
                    minute === m
                      ? 'bg-blue-600 text-white'
                      : 'bg-zinc-700 text-zinc-300 hover:bg-zinc-600'
                  )}
                >
                  :{String(m).padStart(2, '0')}
                </button>
              ))}
            </div>
            <div className="flex gap-1 ml-auto">
              {(['AM', 'PM'] as const).map(p => (
                <button
                  key={p}
                  onClick={() => setAmpm(p)}
                  className={cn(
                    'w-10 h-7 text-xs rounded-lg font-semibold transition-colors',
                    ampm === p
                      ? 'bg-zinc-100 text-zinc-900'
                      : 'bg-zinc-700 text-zinc-300 hover:bg-zinc-600'
                  )}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Time preview + confirm */}
          <div className="flex items-center justify-between pt-1">
            <span className="text-xs text-zinc-400 font-medium tabular-nums">
              {hour}:{String(minute).padStart(2, '0')} {ampm}
            </span>
            <button
              onClick={handleConfirm}
              disabled={!selectedDate}
              className="px-4 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold disabled:opacity-40 hover:bg-blue-500 transition-colors"
            >
              Set
            </button>
          </div>
        </div>

        <div className="mt-2 flex items-center gap-3">
          {dueAt && (
            <button
              onClick={handleClear}
              className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-red-400 transition-colors"
            >
              <X size={12} /> Remove date
            </button>
          )}
          {onRecurrenceChange && (
            <RepeatPicker recurrence={recurrence ?? null} onChange={onRecurrenceChange} />
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
