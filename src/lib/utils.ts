import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { addDays, addMonths, setDate, nextDay, type Day } from 'date-fns'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getNextDueAt(recurrence: string, from: Date): Date {
  const base = new Date(from)

  if (recurrence === 'daily') {
    const next = addDays(base, 1)
    // Preserve time of day if it looks intentional (not midnight), otherwise 9am
    if (base.getHours() === 0 && base.getMinutes() === 0) next.setHours(9, 0, 0, 0)
    return next
  }

  if (recurrence.startsWith('weekly:')) {
    const isoDay = parseInt(recurrence.split(':')[1], 10) // 1=Mon … 7=Sun
    // date-fns Day type: 0=Sun, 1=Mon … 6=Sat
    const dfnsDay = (isoDay % 7) as Day
    const next = nextDay(base, dfnsDay)
    next.setHours(base.getHours() || 9, base.getMinutes() || 0, 0, 0)
    return next
  }

  if (recurrence.startsWith('monthly:')) {
    const dayOfMonth = parseInt(recurrence.split(':')[1], 10)
    const next = addMonths(base, 1)
    // Clamp to last valid day of the month
    const maxDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate()
    setDate(next, Math.min(dayOfMonth, maxDay))
    next.setHours(base.getHours() || 9, base.getMinutes() || 0, 0, 0)
    return next
  }

  // Unknown recurrence — default to +1 day
  return addDays(base, 1)
}

export function recurrenceLabel(recurrence: string | null): string {
  if (!recurrence) return 'No repeat'
  if (recurrence === 'daily') return 'Daily'
  if (recurrence.startsWith('weekly:')) {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
    const isoDay = parseInt(recurrence.split(':')[1], 10)
    return `Every ${days[isoDay]}`
  }
  if (recurrence.startsWith('monthly:')) {
    const d = recurrence.split(':')[1]
    const suffix = d === '1' || d === '21' ? 'st' : d === '2' || d === '22' ? 'nd' : d === '3' || d === '23' ? 'rd' : 'th'
    return `Monthly ${d}${suffix}`
  }
  return recurrence
}
