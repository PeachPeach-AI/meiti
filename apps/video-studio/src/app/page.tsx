'use client';
import { AuthGate } from '@/components/auth/AuthGate';
import { Workspace } from '@/components/layout/Workspace';
import { SharedConfigBridge } from '@/components/SharedConfigBridge';

export default function Home() {
  return (
    <AuthGate>
      <SharedConfigBridge />
      <main className="flex flex-col h-screen overflow-hidden">
        <Workspace />
      </main>
    </AuthGate>
  );
}
