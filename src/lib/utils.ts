import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { addDays, addMonths, setDate, nextDay, type Day } from 'date-fns'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getNextDueAt(recurrence: string, from: Date): Date {
  const base = new Date(from)
  const h = base.getHours() || 9
  const m = base.getMinutes() || 0

  if (recurrence === 'daily') {
    const next = addDays(base, 1)
    next.setHours(h, m, 0, 0)
    return next
  }

  if (recurrence.startsWith('weekly:')) {
    // Supports 'weekly:1' and 'weekly:1,3,5' (ISO days: 1=Mon…7=Sun)
    const isoDays = recurrence.split(':')[1].split(',').map(Number)
    const dfnsDays = isoDays.map(d => (d % 7) as Day)
    const candidates = dfnsDays.map(d => {
      const next = nextDay(base, d)
      next.setHours(h, m, 0, 0)
      return next
    })
    return candidates.reduce((a, b) => (b < a ? b : a))
  }

  if (recurrence.startsWith('monthly:')) {
    const dayOfMonth = parseInt(recurrence.split(':')[1], 10)
    const next = addMonths(base, 1)
    const maxDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate()
    setDate(next, Math.min(dayOfMonth, maxDay))
    next.setHours(h, m, 0, 0)
    return next
  }

  return addDays(base, 1)
}

export function recurrenceLabel(recurrence: string | null): string {
  if (!recurrence) return 'No repeat'
  if (recurrence === 'daily') return 'Daily'
  if (recurrence.startsWith('weekly:')) {
    const NAMES = ['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
    const isoDays = recurrence.split(':')[1].split(',').map(Number)
    if (isoDays.length === 1) return `Every ${NAMES[isoDays[0]]}`
    return isoDays.map(d => NAMES[d]).join(', ')
  }
  if (recurrence.startsWith('monthly:')) {
    const d = recurrence.split(':')[1]
    const suffix = ['11','12','13'].includes(d) ? 'th' :
      d.endsWith('1') ? 'st' : d.endsWith('2') ? 'nd' : d.endsWith('3') ? 'rd' : 'th'
    return `Monthly ${d}${suffix}`
  }
  return recurrence
}

export function streakBroken(recurrence: string, lastCompletedAt: Date, now: Date): boolean {
  const daysSince = (now.getTime() - lastCompletedAt.getTime()) / 86400000
  if (recurrence === 'daily') return daysSince > 2
  if (recurrence.startsWith('weekly:')) return daysSince > 8
  if (recurrence.startsWith('monthly:')) return daysSince > 32
  return false
}
