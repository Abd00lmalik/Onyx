import { Shield } from 'lucide-react'

export function Footer() {
  return (
    <footer className="relative overflow-hidden border-t border-amber-border/60 bg-cream">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-transparent via-amber-primary/30 to-transparent"
      />
      <div className="relative mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center gap-5">
          <div className="flex items-center gap-2.5">
            <Shield size={22} className="text-amber-primary" strokeWidth={1.5} />
            <span className="font-[family-name:var(--font-display)] text-lg font-semibold text-foreground">Onyx</span>
          </div>
          <p className="text-sm text-foreground-light">Built on Midnight Network</p>
          <p className="max-w-md text-center font-mono text-[11px] leading-relaxed text-amber-muted">
            All data is encrypted client-side. Only commitment hashes are stored on-chain.
          </p>
        </div>
      </div>
    </footer>
  )
}