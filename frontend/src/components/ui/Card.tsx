import { type ReactNode } from 'react'

interface CardProps {
  children: ReactNode
  className?: string
}

export function Card({ children, className = '' }: CardProps) {
  return (
    <div className={`bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl ${className}`}>
      {children}
    </div>
  )
}
