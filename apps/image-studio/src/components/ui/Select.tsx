'use client'

import React from 'react'
import { clsx } from 'clsx'

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  options: { value: string; label: string }[]
}

export function Select({ options, className, ...props }: SelectProps) {
  return (
    <div className="relative">
      <select
        className={clsx(
          'w-full appearance-none rounded-md border border-app-border bg-transparent px-2.5 py-1.5 pr-8 text-sm',
          'focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500',
          className
        )}
        {...props}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <svg
        className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-app-text-muted"
        width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      >
        <path d="m6 9 6 6 6-6" />
      </svg>
    </div>
  )
}
