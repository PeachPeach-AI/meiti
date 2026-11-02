'use client'

import React from 'react'
import { useAppStore } from '@/store'
import { useEffect } from 'react'

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const theme = useAppStore((s) => s.theme)

  useEffect(() => {
    const root = document.documentElement
    if (theme === 'dark') {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
  }, [theme])

  return <>{children}</>
}
