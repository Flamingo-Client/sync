import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Flamingo Sync',
  description: 'Sync your Flamingo API client data across devices',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link
          rel="preconnect"
          href="https://fonts.googleapis.com"
        />
        <link rel="shortcut icon" href="favicon.svg" type="image/x-icon" />
      </head>
      <body className="min-h-screen antialiased">
        {children}
      </body>
    </html>
  )
}
