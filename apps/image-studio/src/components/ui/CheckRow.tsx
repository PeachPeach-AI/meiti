'use client'

import React from 'react'
import { clsx } from 'clsx'

interface CheckRowProps {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
  className?: string
}

export function CheckRow({ checked, onChange, label, className }: CheckRowProps) {
  return (
    <label className={clsx('flex items-center gap-2 text-xs text-app-text-secondary cursor-pointer select-none', className)}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="rounded border-app-border text-blue-600 focus:ring-blue-500"
      />
      {label}
    </label>
  )
}
