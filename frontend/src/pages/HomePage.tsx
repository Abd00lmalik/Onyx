import { Link } from 'react-router-dom'
import {
  Shield,
  Search,
  Lock,
  CheckCircle,
  ArrowRight,
  Database,
  BadgeCheck,
  TrendingUp,
  Fingerprint,
} from 'lucide-react'
import { WaveBackground } from '../components/layout/WaveBackground'
import { Button } from '../components/ui/Button'
import { Reveal } from '../components/ui/Reveal'
import { MOCK_STATS } from '../lib/mockData'

const steps = [
  {
    icon: Lock,
    number: '1',
    title: 'List Your Data',
    description: 'Upload your dataset details. The data is encrypted and a commitment hash is stored on-chain.',
  },
  {
    icon: Search,
    number: '2',
    title: 'Verify Quality',
    description: 'Buyers use zero-knowledge proofs to verify data quality without revealing the actual data.',
  },
  {
    icon: CheckCircle,
    number: '3',
    title: 'Complete Trade',
    description: 'Once verified, the transaction is completed and the data remains encrypted on your device.',
  },
]

function HeroIllustration() {
  return (
    <div className="relative mx-auto h-[300px] w-full max-w-[440px] sm:h-[360px] lg:h-[460px]">
      {/* Ambient glow */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="h-[280px] w-[280px] rounded-full bg-amber-primary/[0.08] blur-[70px]" />
      </div>

      {/* Orbital rings */}
      <svg
        className="pointer-events-none absolute inset-0 h-full w-full"
        viewBox="0 0 400 400"
        fill="none"
      >
        <ellipse cx="200" cy="210" rx="150" ry="40" stroke="#FDE68A" strokeWidth="1" strokeDasharray="4 6" opacity="0.45">
          <animateTransform attributeName="transform" type="rotate" from="0 200 210" to="360 200 210" dur="45s" repeatCount="indefinite" />
        </ellipse>
        <ellipse cx="200" cy="200" rx="118" ry="54" stroke="#FDE68A" strokeWidth="0.8" strokeDasharray="3 5" opacity="0.3">
          <animateTransform attributeName="transform" type="rotate" from="360 200 200" to="0 200 200" dur="55s" repeatCount="indefinite" />
        </ellipse>
        <circle r="3.5" fill="#D97706" opacity="0.6">
          <animateMotion dur="14s" repeatCount="indefinite" path="M50,210 A150,40 0 1 1 350,210 A150,40 0 1 1 50,210" />
        </circle>
      </svg>

      {/* Central shield + folder composition */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="relative">
          {/* Platform glow */}
          <div className="absolute -bottom-3 left-1/2 h-6 w-[210px] -translate-x-1/2 rounded-full bg-gradient-to-b from-amber-border/45 to-transparent blur-sm" />

          {/* Folder */}
          <div className="relative mx-auto w-[175px] h-[135px]">
            <div className="absolute bottom-0 left-0 right-0 h-[108px] rounded-xl border border-amber-border/50 bg-gradient-to-b from-amber-primary/[0.12] to-amber-primary/[0.06] shadow-[0_8px_32px_-4px_rgba(217,119,6,0.14)]" />
            <div className="absolute top-0 left-4 h-[28px] w-[68px] rounded-t-lg border border-b-0 border-amber-border/40 bg-amber-primary/[0.1]" />
            <div className="absolute bottom-0 left-0 right-0 h-[88px] rounded-xl border border-amber-border/40 bg-gradient-to-b from-cream to-cream-dark shadow-[0_4px_16px_-2px_rgba(217,119,6,0.1)]" />
            <div className="absolute bottom-3 left-4 right-4 space-y-1.5">
              <div className="h-[6px] w-[70%] rounded-full bg-amber-primary/20" />
              <div className="h-[6px] w-[45%] rounded-full bg-amber-primary/15" />
              <div className="h-[6px] w-[55%] rounded-full bg-amber-primary/10" />
            </div>
          </div>

          {/* Shield */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[42%]">
            <div className="relative">
              <div className="absolute inset-0 scale-[1.6] rounded-full bg-amber-primary/[0.08] blur-xl" />
              <div className="relative flex h-[84px] w-[74px] items-center justify-center">
                <svg viewBox="0 0 60 70" fill="none" className="h-full w-full drop-shadow-[0_4px_12px_rgba(217,119,6,0.25)]">
                  <path d="M30 4L6 16V34C6 50 16 62 30 66C44 62 54 50 54 34V16L30 4Z" fill="url(#shieldGrad)" stroke="#D97706" strokeWidth="1.5" />
                  <path d="M22 35L28 41L39 28" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.9" />
                  <defs>
                    <linearGradient id="shieldGrad" x1="30" y1="4" x2="30" y2="66" gradientUnits="userSpaceOnUse">
                      <stop stopColor="#D97706" />
                      <stop offset="1" stopColor="#B45309" />
                    </linearGradient>
                  </defs>
                </svg>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Floating cards — kept inside the container to avoid horizontal overflow */}
      {/* Chart card */}
      <div
        className="absolute left-[1%] top-[7%] w-[68px] rounded-lg border border-amber-border/50 bg-cream p-2 shadow-[0_4px_16px_-2px_rgba(217,119,6,0.12)] float-animation"
        style={{ animationDelay: '0s' }}
      >
        <div className="flex h-[44px] items-end gap-[3px] pt-1">
          <div className="w-[5px] rounded-t bg-amber-primary/30" style={{ height: '35%' }} />
          <div className="w-[5px] rounded-t bg-amber-primary/50" style={{ height: '60%' }} />
          <div className="w-[5px] rounded-t bg-amber-primary/70" style={{ height: '45%' }} />
          <div className="w-[5px] rounded-t bg-amber-primary/40" style={{ height: '75%' }} />
        </div>
      </div>

      {/* DNA card */}
      <div
        className="absolute right-[1%] top-[16%] w-[60px] rounded-lg border border-amber-border/50 bg-cream p-2 shadow-[0_4px_16px_-2px_rgba(217,119,6,0.12)] float-animation"
        style={{ animationDelay: '1.2s' }}
      >
        <svg viewBox="0 0 40 32" fill="none" className="h-full w-full">
          <path d="M10 4C15 10 25 10 30 4" stroke="#D97706" strokeWidth="1.2" opacity="0.45" />
          <path d="M10 12C15 18 25 18 30 12" stroke="#D97706" strokeWidth="1.2" opacity="0.35" />
          <path d="M10 20C15 26 25 26 30 20" stroke="#D97706" strokeWidth="1.2" opacity="0.25" />
          <circle cx="10" cy="4" r="1.5" fill="#D97706" opacity="0.5" />
          <circle cx="30" cy="4" r="1.5" fill="#D97706" opacity="0.5" />
          <circle cx="20" cy="12" r="1.5" fill="#D97706" opacity="0.4" />
        </svg>
      </div>

      {/* Document card */}
      <div
        className="absolute bottom-[22%] left-0 w-[64px] rounded-lg border border-amber-border/50 bg-cream p-2 shadow-[0_4px_16px_-2px_rgba(217,119,6,0.12)] float-animation"
        style={{ animationDelay: '2.2s' }}
      >
        <div className="space-y-[3px] pt-0.5">
          <div className="h-[5px] w-full rounded-full bg-amber-primary/20" />
          <div className="h-[5px] w-[75%] rounded-full bg-amber-primary/15" />
          <div className="h-[5px] w-[55%] rounded-full bg-amber-primary/10" />
          <div className="h-[5px] w-[65%] rounded-full bg-amber-primary/[0.07]" />
        </div>
      </div>

      {/* Lock card */}
      <div
        className="absolute bottom-[28%] right-0 w-[54px] rounded-lg border border-amber-border/50 bg-cream p-2 shadow-[0_4px_16px_-2px_rgba(217,119,6,0.12)] float-animation"
        style={{ animationDelay: '0.6s' }}
      >
        <svg viewBox="0 0 24 24" fill="none" className="h-[18px] w-full">
          <rect x="5" y="11" width="14" height="10" rx="2" stroke="#D97706" strokeWidth="1.5" opacity="0.5" />
          <path d="M8 11V7C8 4.8 9.8 3 12 3C14.2 3 16 4.8 16 7V11" stroke="#D97706" strokeWidth="1.5" strokeLinecap="round" opacity="0.4" />
          <circle cx="12" cy="16" r="1.5" fill="#D97706" opacity="0.4" />
        </svg>
      </div>

      {/* Commitment hash terminal card */}
      <div className="absolute bottom-0 left-1/2 w-[175px] -translate-x-1/2 rounded-lg border border-amber-border/50 bg-cream-dark/90 px-3 py-2.5 shadow-[0_6px_20px_-6px_rgba(217,119,6,0.2)]">
        <div className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-success" />
          <span className="font-mono text-[9px] uppercase tracking-wide text-amber-muted">commitment</span>
        </div>
        <p className="mt-1 font-mono text-[9px] leading-relaxed text-amber-muted">
          sha256:<br />9f2c…4b7a ✓
        </p>
      </div>
    </div>
  )
}

export function HomePage() {
  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-b from-cream via-cream to-cream-dark">
        {/* Decorative background */}
        <div
          className="pointer-events-none absolute inset-0 bg-dot-grid opacity-40"
          style={{
            maskImage: 'radial-gradient(ellipse at center, black, transparent 78%)',
            WebkitMaskImage: 'radial-gradient(ellipse at center, black, transparent 78%)',
          }}
        />
        <div className="pointer-events-none absolute -right-[10%] -top-24 h-[420px] w-[420px] rounded-full bg-amber-primary/[0.06] blur-[100px]" />
        <div className="pointer-events-none absolute -left-[8%] bottom-0 h-[360px] w-[360px] rounded-full bg-amber-primary/[0.07] blur-[90px]" />

        <div className="relative mx-auto flex w-full max-w-7xl flex-col justify-center px-10 pt-20 pb-16 sm:px-16 sm:pt-24 sm:pb-20 lg:px-24">
          <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-2 lg:gap-6">
            {/* Left: Text */}
            <div className="relative z-10 lg:pl-6">
              <Reveal>
                <div className="inline-flex items-center gap-2 rounded-full border border-amber-border/70 bg-amber-primary/10 px-3.5 py-1.5">
                  <Shield size={13} className="text-amber-primary" />
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-amber-primary">
                    Privacy-first marketplace
                  </span>
                </div>
              </Reveal>

              <Reveal delay={80}>
                <h1 className="mt-6 font-[family-name:var(--font-display)] text-[2.5rem] font-bold leading-[1.08] tracking-tight text-foreground sm:text-5xl lg:text-[3.4rem]">
                  <span>Encrypted Data</span>
                  <br />
                  <span className="text-amber-primary">Marketplace</span>
                </h1>
              </Reveal>

              <Reveal delay={160}>
                <p className="mt-6 max-w-md text-[0.95rem] leading-relaxed text-foreground-light sm:text-base">
                  Trade data privately on Midnight Network. Sellers list encrypted datasets and buyers verify quality through zero-knowledge proofs. Data never touches the chain, only commitment hashes.
                </p>
              </Reveal>

              <Reveal delay={240}>
                <div className="mt-8 flex flex-col items-start gap-3 sm:flex-row">
                  <Link to="/browse">
                    <Button
                      size="lg"
                      className="w-full shadow-[0_2px_12px_-2px_rgba(217,119,6,0.35)] hover:shadow-[0_4px_20px_-2px_rgba(217,119,6,0.45)] sm:w-auto"
                    >
                      Browse Marketplace <ArrowRight size={16} />
                    </Button>
                  </Link>
                  <Link to="/list" className="w-full sm:w-auto">
                    <Button variant="secondary" size="lg" className="w-full sm:w-auto">
                      List Your Data
                    </Button>
                  </Link>
                </div>
              </Reveal>

              {/* Trust strip */}
              <Reveal delay={320}>
                <div className="mt-9 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-amber-border/50 pt-6">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-foreground-light">
                    <BadgeCheck size={14} className="text-amber-primary" />
                    Zero-knowledge proofs
                  </div>
                  <div className="flex items-center gap-1.5 text-xs font-medium text-foreground-light">
                    <Fingerprint size={14} className="text-amber-primary" />
                    Data stays off-chain
                  </div>
                  <div className="flex items-center gap-1.5 text-xs font-medium text-foreground-light">
                    <Shield size={14} className="text-amber-primary" />
                    On-chain commitments
                  </div>
                </div>
              </Reveal>
            </div>

            {/* Right: Illustration */}
            <Reveal delay={200}>
              <HeroIllustration />
            </Reveal>
          </div>
        </div>

        <WaveBackground />
      </section>

      {/* Stats */}
      <section className="relative overflow-hidden bg-cream py-16 sm:py-24">
        <div className="pointer-events-none absolute left-1/2 top-0 h-[300px] w-[600px] -translate-x-1/2 rounded-full bg-amber-primary/[0.04] blur-[90px]" />

        <div className="relative mx-auto max-w-3xl px-5 sm:px-6 lg:px-8">
          <Reveal>
            <div className="flex flex-col items-center text-center">
              <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-amber-primary">
                Marketplace at a glance
              </span>
              <h2 className="mt-3 font-[family-name:var(--font-display)] text-[1.75rem] font-bold text-foreground sm:text-3xl">
                Live marketplace metrics
              </h2>
              <p className="mt-2 max-w-md text-sm text-foreground-light sm:text-base">
                The current state of the Onyx network, updated in real time on-chain.
              </p>
            </div>
          </Reveal>

          <div className="mt-14 grid grid-cols-1 gap-5 sm:mt-16 sm:grid-cols-3 sm:gap-6">
            {[
              {
                icon: Database,
                label: 'Total Listings',
                value: MOCK_STATS.totalListings,
                note: 'Across all categories',
              },
              {
                icon: BadgeCheck,
                label: 'Completed Sales',
                value: MOCK_STATS.completedSales,
                note: 'Verified via ZK proofs',
              },
              {
                icon: TrendingUp,
                label: 'Total Volume',
                value: MOCK_STATS.totalVolume.toLocaleString(),
                note: 'Settled off-chain',
              },
            ].map((stat, i) => (
              <Reveal key={stat.label} delay={i * 100}>
                <div className="group relative h-full overflow-hidden rounded-2xl border border-amber-border/60 bg-cream-light p-7 text-center shadow-[0_2px_16px_-6px_rgba(217,119,6,0.14)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_14px_30px_-12px_rgba(217,119,6,0.28)]">
                  <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-transparent via-amber-primary/40 to-transparent opacity-60 transition-opacity duration-300 group-hover:opacity-100" />
                  <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-full border border-amber-border/70 bg-cream shadow-[0_2px_8px_-2px_rgba(217,119,6,0.15)]">
                    <stat.icon size={22} className="text-amber-primary" strokeWidth={1.75} />
                  </div>
                  <p className="font-[family-name:var(--font-display)] text-3xl font-bold text-amber-primary sm:text-4xl">
                    {stat.value}
                  </p>
                  <p className="mt-1.5 text-sm font-semibold text-foreground">{stat.label}</p>
                  <p className="mt-2 text-[11px] text-foreground-light/80">{stat.note}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="relative overflow-hidden bg-cream-dark py-20 sm:py-28">
        <div className="pointer-events-none absolute -right-[6%] top-0 h-[300px] w-[300px] rounded-full bg-amber-primary/[0.06] blur-[90px]" />
        <div className="pointer-events-none absolute -left-[6%] bottom-0 h-[300px] w-[300px] rounded-full bg-amber-primary/[0.06] blur-[90px]" />

        <div className="relative mx-auto max-w-3xl px-5 sm:px-6 lg:px-8">
          <Reveal>
            <div className="flex flex-col items-center text-center">
              <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-amber-primary">
                How it works
              </span>
              <h2 className="mt-3 font-[family-name:var(--font-display)] text-[1.75rem] font-bold text-foreground sm:text-3xl">
                Three steps to complete privacy
              </h2>
              <p className="mt-2 max-w-md text-sm text-foreground-light sm:text-base">
                Three simple steps to trade data with complete privacy.
              </p>
            </div>
          </Reveal>

          <div className="relative mt-16 sm:mt-20">
            {/* Connecting line */}
            <div className="pointer-events-none absolute left-[16.5%] right-[16.5%] top-[88px] hidden h-[2px] bg-gradient-to-r from-transparent via-amber-primary/25 to-transparent md:block" />

            <div className="grid grid-cols-1 gap-10 md:grid-cols-3 md:gap-8 lg:gap-10">
              {steps.map((step, i) => (
                <Reveal key={step.title} delay={i * 120}>
                  <div className="group relative h-full rounded-2xl border border-amber-border/50 bg-cream-light/90 p-8 text-center shadow-[0_2px_18px_-8px_rgba(217,119,6,0.16)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_16px_36px_-14px_rgba(217,119,6,0.3)]">
                    {/* Step icon */}
                    <div className="relative mx-auto mb-6 inline-flex">
                      <div className="flex h-[92px] w-[92px] items-center justify-center rounded-full border border-amber-border/60 bg-gradient-to-b from-cream to-cream-dark shadow-[0_4px_16px_-6px_rgba(217,119,6,0.18)] transition-all duration-300 group-hover:border-amber-primary/50">
                        <step.icon size={36} className="text-amber-primary" strokeWidth={1.5} />
                      </div>
                      <div className="absolute -right-1 -top-1 flex h-7 w-7 items-center justify-center rounded-full bg-amber-primary text-[11px] font-bold text-white shadow-[0_2px_10px_-1px_rgba(217,119,6,0.45)]">
                        {step.number}
                      </div>
                    </div>

                    <h3 className="font-[family-name:var(--font-display)] text-xl font-semibold text-foreground">
                      {step.title}
                    </h3>
                    <p className="mt-3 text-sm leading-relaxed text-foreground-light">
                      {step.description}
                    </p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative overflow-hidden bg-cream py-20 sm:py-28">
        <div className="mx-auto max-w-3xl px-5 sm:px-6 lg:px-8">
          <Reveal>
            <div className="relative overflow-hidden rounded-3xl border border-amber-border/60 bg-gradient-to-br from-cream-light via-cream to-cream-dark p-8 text-center shadow-[0_16px_50px_-18px_rgba(217,119,6,0.3)] sm:p-14">
              {/* Decorative layer */}
              <div className="pointer-events-none absolute -left-10 -top-10 h-40 w-40 rounded-full bg-amber-primary/[0.05] blur-3xl" />
              <div className="pointer-events-none absolute -bottom-10 -right-10 h-40 w-40 rounded-full bg-amber-primary/[0.05] blur-3xl" />

              {/* Floating data chips */}
              <div className="pointer-events-none absolute left-[15%] top-[10%] rounded-lg border border-amber-border/50 bg-cream/70 px-2.5 py-1.5 font-mono text-[9px] text-amber-muted rotate-[-4deg] hidden sm:block">
                {`{ zkp: verified }`}
              </div>
              <div className="pointer-events-none absolute bottom-[12%] right-[15%] rounded-lg border border-amber-border/50 bg-cream/70 px-2.5 py-1.5 font-mono text-[9px] text-amber-muted rotate-[3deg] hidden sm:block">
                {`{ data: off-chain }`}
              </div>

              {/* Shield watermark */}
              <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 opacity-[0.04]">
                <svg viewBox="0 0 200 240" fill="none" className="h-[320px] w-[260px]">
                  <path d="M100 10L10 50V110C10 165 50 210 100 225C150 210 190 165 190 110V50L100 10Z" stroke="#D97706" strokeWidth="3" fill="none" />
                </svg>
              </div>

              <div className="relative z-10">
                <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-amber-border/60 bg-gradient-to-b from-cream to-cream-dark shadow-[0_8px_24px_-8px_rgba(217,119,6,0.3)]">
                  <Shield size={30} className="text-amber-primary" strokeWidth={1.5} />
                </div>

                <h2 className="font-[family-name:var(--font-display)] text-[1.9rem] font-bold text-foreground sm:text-4xl">
                  Ready to trade data privately?
                </h2>
                <p className="mx-auto mt-4 max-w-lg text-sm leading-relaxed text-foreground-light sm:text-base">
                  List encrypted datasets, verify quality with zero-knowledge proofs, and keep sensitive data off-chain.
                </p>

                <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
                  <Link to="/browse" className="w-full sm:w-auto">
                    <Button
                      size="lg"
                      className="w-full shadow-[0_2px_12px_-2px_rgba(217,119,6,0.35)] hover:shadow-[0_4px_20px_-2px_rgba(217,119,6,0.45)] sm:w-auto"
                    >
                      Browse Marketplace <ArrowRight size={16} />
                    </Button>
                  </Link>
                  <Link to="/list" className="w-full sm:w-auto">
                    <Button variant="secondary" size="lg" className="w-full sm:w-auto">
                      List Your Data
                    </Button>
                  </Link>
                </div>

                <p className="mt-7 font-mono text-[10px] uppercase tracking-widest text-amber-muted/80">
                  only commitment hashes are stored on-chain
                </p>
              </div>
            </div>
          </Reveal>
        </div>
      </section>
    </div>
  )
}