'use client'

import React from 'react'
import { clsx } from 'clsx'

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  icon?: React.ReactNode
  onIconClick?: () => void
}

export function Input({ icon, onIconClick, className, ...props }: InputProps) {
  return (
    <div className="relative flex items-center">
      <input
        className={clsx(
          'w-full h-9 rounded-lg border border-[var(--app-border)] bg-[var(--app-bg)] px-3 text-sm text-[var(--app-text)]',
          'placeholder:text-[var(--app-text-muted)]',
          'focus:outline-none focus:border-[var(--app-primary)]',
          'disabled:opacity-50 disabled:cursor-not-allowed transition-colors',
          icon && 'pr-9',
          className
        )}
        {...props}
      />
      {icon && (
        <button
          type="button"
          onClick={onIconClick}
          className="absolute right-2 p-0.5 text-[var(--app-text-muted)] hover:text-[var(--app-text)]"
        >
          {icon}
        </button>
      )}
    </div>
  )
}
