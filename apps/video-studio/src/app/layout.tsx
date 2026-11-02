import type { Metadata } from 'next';
import './globals.css';
import ClientLayout from './ClientLayout';

export const metadata: Metadata = {
  title: 'Video Studio - AI 视频生成工作台',
  description: '剧本拆解 · 分镜设计 · AI 视频生成',
  icons: { icon: '/icon.svg' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body className="bg-[var(--app-bg)] text-[var(--app-text)]">
        <ClientLayout>{children}</ClientLayout>
      </body>
    </html>
  );
}
