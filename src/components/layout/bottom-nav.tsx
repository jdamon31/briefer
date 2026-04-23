'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { CalendarDays, CheckSquare, Inbox, Settings } from 'lucide-react'
import { cn } from '@/lib/utils'

const tabs = [
  { href: '/today', label: 'Today', icon: CheckSquare },
  { href: '/calendar', label: 'Calendar', icon: CalendarDays },
  { href: '/inbox', label: 'Inbox', icon: Inbox },
  { href: '/settings', label: 'Settings', icon: Settings },
]

export function BottomNav() {
  const pathname = usePathname()
  return (
    <nav className="fixed bottom-0 inset-x-0 bg-zinc-850 backdrop-blur border-t border-zinc-700 pb-safe" style={{ backgroundColor: '#1f1f23' }}>
      <div className="flex">
        {tabs.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex-1 flex flex-col items-center gap-1 py-3 text-[10px] font-semibold transition-colors',
                active ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'
              )}
            >
              <Icon size={20} strokeWidth={active ? 2.5 : 1.5} />
              {label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
