export function TopBar() {
  return (
    <header className="fixed top-0 inset-x-0 z-40 border-b border-zinc-700/60" style={{ backgroundColor: '#1f1f23' }}>
      <div className="h-11 flex items-center justify-center">
        <span className="text-base font-bold tracking-tight text-zinc-100">Briefer</span>
      </div>
    </header>
  )
}
