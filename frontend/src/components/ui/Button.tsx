import { type ButtonHTMLAttributes, type ReactNode } from 'react'
import { Spinner } from './Spinner'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'destructive'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  children: ReactNode
}

const variantStyles = {
  primary: 'bg-amber-primary text-white hover:bg-amber-hover active:bg-amber-active shadow-[0_1px_3px_0_rgba(217,119,6,0.3),0_1px_2px_-1px_rgba(217,119,6,0.3)] hover:shadow-[0_4px_12px_-2px_rgba(217,119,6,0.4)]',
  secondary: 'bg-cream-light/80 border border-amber-border/70 text-foreground hover:bg-cream-dark hover:border-amber-primary/30 shadow-[0_1px_2px_0_rgba(217,119,6,0.06)]',
  ghost: 'bg-transparent text-amber-primary hover:bg-cream-dark',
  destructive: 'bg-danger text-white hover:bg-red-700 shadow-sm',
}

const sizeStyles = {
  sm: 'px-3 py-1.5 text-sm rounded-lg',
  md: 'px-4 py-2 text-sm rounded-lg',
  lg: 'px-5 py-2.5 text-[0.9rem] rounded-xl',
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  children,
  className = '',
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 font-semibold transition-all duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <Spinner size="sm" />}
      {children}
    </button>
  )
}
