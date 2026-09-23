import { useEffect, useRef, useState, type ReactNode } from 'react'

interface RevealProps {
  children: ReactNode
  className?: string
  delay?: number
}

export function Reveal({ children, className = '', delay = 0 }: RevealProps) {
  const ref = useRef<HTMLDivElement>(null)
  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const [visible, setVisible] = useState(prefersReducedMotion)

  useEffect(() => {
    if (visible) return

    const el = ref.current
    if (!el) return

    const observer = new IntersectionObserver(
      entries => {
        const [entry] = entries
        if (entry.isIntersecting) {
          setVisible(true)
          observer.disconnect()
        }
      },
      { threshold: 0.15 }
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [visible])

  return (
    <div
      ref={ref}
      className={`reveal ${visible ? 'is-visible' : ''} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  )
}