import { BottomNav } from '@/components/layout/bottom-nav'
import { TopBar } from '@/components/layout/top-bar'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen pt-11 pb-32">
      <TopBar />
      {children}
      <BottomNav />
    </div>
  )
}
