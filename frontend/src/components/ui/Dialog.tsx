import { type ReactNode, useEffect } from 'react'
import { X } from 'lucide-react'

interface DialogProps {
  open: boolean
  onClose: () => void
  title?: string
  children: ReactNode
}

export function Dialog({ open, onClose, title, children }: DialogProps) {
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [open])

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    if (open) {
      document.addEventListener('keydown', handleEscape)
      return () => document.removeEventListener('keydown', handleEscape)
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-cream border border-amber-border rounded-xl shadow-xl max-w-lg w-full mx-4 p-6 z-10">
        <div className="flex items-center justify-between mb-5">
          {title && (
            <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold text-foreground">{title}</h2>
          )}
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-cream-dark transition-colors cursor-pointer ml-auto">
            <X size={20} className="text-amber-muted" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
