import type { NextConfig } from 'next'

const cspHeader = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://challenges.cloudflare.com https://*.supabase.co",
  "style-src 'self' 'unsafe-inline' https://challenges.cloudflare.com https://*.supabase.co",
  "frame-src https://challenges.cloudflare.com https://*.supabase.co",
  "img-src 'self' blob: data: https://challenges.cloudflare.com https://*.supabase.co",
  "font-src 'self'",
  "connect-src 'self' https://challenges.cloudflare.com https://*.supabase.co",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ')

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
  serverExternalPackages: ['@supabase/ssr'],
  async headers() {
    return [
      {
        source: '/((?!api|_next/static|_next/image|favicon.ico).*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: cspHeader.replace(/\s{2,}/g, ' ').trim(),
          },
        ],
      },
    ]
  },
}

export default nextConfig
