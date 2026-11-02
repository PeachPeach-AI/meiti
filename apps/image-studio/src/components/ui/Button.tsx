'use client'

import React from 'react'
import { clsx } from 'clsx'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'ghost' | 'danger'
  size?: 'sm' | 'md'
}

export function Button({ variant = 'ghost', size = 'md', className, ...props }: ButtonProps) {
  return (
    <button
      className={clsx(
        'inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-colors select-none',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-primary)]',
        size === 'sm' ? 'h-8 px-3 text-xs' : 'h-9 px-4 text-sm',
        variant === 'primary' &&
          'bg-[var(--app-primary)] text-white hover:bg-[var(--app-primary-hover)]',
        variant === 'ghost' &&
          'text-[var(--app-text-secondary)] hover:bg-[var(--app-hover)]',
        variant === 'danger' &&
          'text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20',
        className
      )}
      {...props}
    />
  )
}

