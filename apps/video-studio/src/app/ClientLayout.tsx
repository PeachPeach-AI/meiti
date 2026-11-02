'use client';
import { useEffect } from 'react';
import { ToastViewport } from '@/components/feedback/ToastViewport';
import { useAppStore } from '@/store';

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const theme = useAppStore((s) => s.theme);
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  return (
    <>
      {children}
      <ToastViewport />
    </>
  );
}