import type { Metadata } from 'next'
import './globals.css'
import ClientLayout from './ClientLayout'

export const metadata: Metadata = {
  title: 'Image2 Studio',
  description: 'A focused workspace for text-to-image and image-to-image generation.',
  icons: {
    icon: '/icon.svg',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
        <ClientLayout>{children}</ClientLayout>
      </body>
    </html>
  )
}

