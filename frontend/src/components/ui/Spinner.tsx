interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg'
}

const sizeStyles = {
  sm: 'w-4 h-4',
  md: 'w-6 h-6',
  lg: 'w-10 h-10',
}

export function Spinner({ size = 'md' }: SpinnerProps) {
  return (
    <div className={`${sizeStyles[size]} animate-spin`}>
      <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.2" strokeWidth="3" />
        <path d="M12 2C6.47715 2 2 6.47715 2 12" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      </svg>
    </div>
  )
}
