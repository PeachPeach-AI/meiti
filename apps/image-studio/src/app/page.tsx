'use client'

import { Workspace } from '@/components/layout/Workspace'
import { SharedConfigBridge } from '@/components/SharedConfigBridge'

export default function Home() {
  return (
    <main className="flex flex-col h-screen w-screen overflow-hidden">
      <SharedConfigBridge />
      <Workspace />
    </main>
  )
}
