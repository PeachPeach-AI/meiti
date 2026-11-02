'use client'

import { useCallback, useRef, useEffect } from 'react'
import { useAppStore } from '@/store'

export function useResizer(side: 'left' | 'right') {
  const setLeftWidth = useAppStore((s) => s.setLeftPanelWidth)
  const setRightWidth = useAppStore((s) => s.setRightPanelWidth)
  const leftWidth = useAppStore((s) => s.leftPanelWidth)
  const rightWidth = useAppStore((s) => s.rightPanelWidth)
  const isDragging = useRef(false)

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      isDragging.current = true
      const startX = e.clientX
      const startWidth = side === 'left' ? leftWidth : rightWidth

      const onMouseMove = (ev: MouseEvent) => {
        if (!isDragging.current) return
        const delta = side === 'left' ? ev.clientX - startX : startX - ev.clientX
        const newWidth = Math.max(side === 'left' ? 200 : 240, Math.min(500, startWidth + delta))
        if (side === 'left') setLeftWidth(newWidth)
        else setRightWidth(newWidth)
      }

      const onMouseUp = () => {
        isDragging.current = false
        document.removeEventListener('mousemove', onMouseMove)
        document.removeEventListener('mouseup', onMouseUp)
      }

      document.addEventListener('mousemove', onMouseMove)
      document.addEventListener('mouseup', onMouseUp)
    },
    [side, leftWidth, rightWidth, setLeftWidth, setRightWidth]
  )

  const onDoubleClick = useCallback(() => {
    if (side === 'left') setLeftWidth(282)
    else setRightWidth(336)
  }, [side, setLeftWidth, setRightWidth])

  return { onMouseDown, onDoubleClick }
}
