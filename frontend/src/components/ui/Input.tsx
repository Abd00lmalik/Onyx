import { type InputHTMLAttributes, forwardRef } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  error?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className = '', ...props }, ref) => {
    return (
      <div className="w-full">
        <label className="block text-sm font-medium text-foreground-light mb-1.5">{label}</label>
        <input
          ref={ref}
          className={`w-full px-4 py-2.5 rounded-lg bg-cream-light border border-amber-border text-foreground placeholder-amber-muted/50 focus:outline-none focus:ring-2 focus:ring-amber-primary/30 focus:border-amber-primary transition-all duration-200 text-sm ${error ? 'border-danger' : ''} ${className}`}
          {...props}
        />
        {error && <p className="mt-1 text-sm text-danger">{error}</p>}
      </div>
    )
  }
)

Input.displayName = 'Input'
