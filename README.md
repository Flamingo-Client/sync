# Flamingo Sync Server

**End-to-end encrypted sync backend** for Flamingo, the modern desktop API client. Built with Next.js 15 and Supabase, this server enables secure cross-device data synchronization with zero-knowledge architecture — the server never sees plaintext data or encryption keys.

---

## Features

- **Two-Phase Device Authorization** — Browser-based OAuth-like flow: desktop client creates a temp token, user authenticates via browser, client polls for the session token
- **End-to-End Encryption** — Server stores only AES-256-GCM encrypted blobs; encryption keys are never transmitted in plaintext
- **Multi-Device Sync** — Unlimited devices per account with automatic conflict resolution by last-writer-wins
- **Selective Sync** — Per-data-type sync toggles for 5 categories: history, environments, secrets, collections, settings
- **Session Management** — Token rotation and revocation, device listing and removal
- **Audit Logging** — Complete security event trail (connections, key rotations, device approvals, config changes)
- **Event Queue** — Real-time sync event notifications (`data_updated`, `config_changed`, `device_revoked`, `key_rotated`)
- **Web Dashboard** — Full management UI with overview stats, sync settings, device management, and security panel
- **Key Rotation** — Versioned master key updates with full audit trail
- **Password Management** — Change password from the web dashboard
- **Cloudflare Turnstile** — Bot protection on signup flows
- **CORS Middleware** — Cross-origin support for desktop client API calls

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript 5 |
| Database | Supabase (PostgreSQL) |
| Auth | Supabase Auth (cookie-based) |
| Styling | TailwindCSS 3 |
| Components | Radix UI |
| Icons | Lucide React |
| Bot Protection | Cloudflare Turnstile |
| Deployment | Node.js (Vercel-ready) |

---

## Architecture

```
backend-server/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── sync/
│   │   │   │   ├── init/route.ts         # Create temp token
│   │   │   │   ├── claim/route.ts        # Claim token (browser)
│   │   │   │   ├── token/route.ts        # Poll for session (client)
│   │   │   │   ├── config/route.ts       # Sync preferences CRUD
│   │   │   │   ├── config/data-type/     # Placeholder
│   │   │   │   ├── key/route.ts          # Master key storage/retrieval
│   │   │   │   ├── data/route.ts         # List all encrypted blobs
│   │   │   │   ├── data/[type]/route.ts  # CRUD per data type
│   │   │   │   ├── rotate/route.ts       # Token rotation
│   │   │   │   └── revoke/route.ts       # Session revocation
│   │   │   ├── devices/
│   │   │   │   ├── route.ts              # List devices
│   │   │   │   └── [id]/route.ts         # Revoke specific device
│   │   │   ├── audit/route.ts            # Audit log (last 50 events)
│   │   │   └── auth/
│   │   │       ├── password/route.ts     # Change password
│   │   │       └── verify-turnstile/     # Cloudflare Turnstile verification
│   │   ├── dashboard/                    # Web dashboard pages
│   │   │   ├── page.tsx                  # Overview (stats + sync status)
│   │   │   ├── sync/page.tsx             # Sync settings toggles
│   │   │   ├── devices/page.tsx          # Device management table
│   │   │   └── security/page.tsx         # Security audit + change password
│   │   ├── login/page.tsx                # Login + signup with Turnstile
│   │   ├── sync/
│   │   │   ├── authorize/page.tsx        # Token claim page (OAuth)
│   │   │   └── complete/page.tsx         # Claim success confirmation
│   │   ├── layout.tsx                    # Root layout
│   │   ├── page.tsx                      # Redirect / → /dashboard
│   │   └── globals.css                   # Global styles + theme vars
│   ├── components/
│   │   ├── dashboard/
│   │   │   ├── header.tsx                # User avatar + sign out
│   │   │   ├── sidebar.tsx               # Navigation sidebar
│   │   │   └── sync-status-card.tsx      # Per-type status card + loading skeleton
│   │   ├── login/
│   │   │   └── login-form.tsx            # Auth form with Turnstile
│   │   └── ui/                           # Radix-based primitives
│   │       ├── avatar.tsx, badge.tsx, button.tsx, card.tsx
│   │       ├── dropdown-menu.tsx, input.tsx, label.tsx
│   │       ├── separator.tsx, skeleton.tsx, switch.tsx
│   │       ├── table.tsx, tabs.tsx, toast.tsx
│   │       └── turnstile.tsx             # Cloudflare Turnstile widget
│   ├── lib/
│   │   ├── api-utils.ts                  # Auth, response helpers, token gen
│   │   ├── crypto.ts                     # Client crypto reference (AES, PBKDF2)
│   │   ├── supabase/
│   │   │   ├── admin.ts                  # Service-role client
│   │   │   ├── client.ts                 # Browser client
│   │   │   └── server.ts                 # Server cookie-based client
│   │   ├── types.ts                      # All TypeScript interfaces
│   │   └── utils.ts                      # cn(), generateId(), formatRelativeTime()
│   ├── middleware.ts                      # CORS + dashboard route protection
│   └── globals.css                       # Tailwind + theme CSS variables
├── supabase/
│   └── migrations/
│       └── 001_schema.sql                # Full database schema (7 tables)
└── # Config files (next.config, tailwind, postcss, tsconfig)
```

### Authentication Flow

```
Desktop Client                    Browser                     Server
     |                              |                            |
     |---- POST /api/sync/init ---->|                            |
     |<--- { temp_token, url } -----|                            |
     |                              |                            |
     |---- open url in browser ---->|                            |
     |                              |---- GET /sync/authorize ->|
     |                              |    (authenticated via cookie)|
     |                              |    If not logged in:       |
     |                              |    redirect /login?token   |
     |                              |                            |
     |                              |---- POST /api/sync/claim ->|
     |                              |    { temp_token }          |
     |                              |<--- success ---------------|
     |                              |                            |
     |---- POST /api/sync/token --->|                            |
     |     { temp_token }           |                            |
     |     (polls every 2s)         |                            |
     |<--- { session_token } -------|                            |
     |                              |                            |
     |===== session established ===>|                            |
     |-- PUT /api/sync/key -------->|  Store master key          |
     |-- PUT /api/sync/data/* ----->|  Upload encrypted blobs    |
```

---

## Getting Started

### Prerequisites

- **Node.js** >= 18
- **npm** >= 9
- **Supabase** account (free tier works)

### Installation

```bash
cd backend-server
npm install
```

### Environment Variables

Create `.env.local` in the project root:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Server
NEXT_PUBLIC_SERVER_URL=http://localhost:3000

# Session
SESSION_EXPIRY_DAYS=90
TEMP_TOKEN_EXPIRY_MINUTES=5

# Cloudflare Turnstile (get at https://dash.cloudflare.com/?to=/:account/turnstile)
NEXT_PUBLIC_TURNSTILE_SITE_KEY=your-turnstile-site-key
TURNSTILE_SECRET_KEY=your-turnstile-secret-key
```

### Database Setup

Run the migration in your Supabase SQL editor:

```
supabase/migrations/001_schema.sql
```

This creates all 7 tables, indexes, RLS policies, triggers, and helper functions.

### Development

```bash
npm run dev              # Next.js dev server (port 3000)
```

### Production Build

```bash
npm run build            # Production build
npm run start            # Start production server
```

---

## API Reference

All endpoints return JSON with the structure `{ success: boolean, data?: T, error?: string, message?: string }`.

### Authentication (Device Authorization)

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/sync/init` | POST | None | Create temp token, get login URL |
| `/api/sync/token` | POST | None | Poll for session token (body: `{ temp_token }`) |
| `/api/sync/claim` | POST | Cookie/Bearer | Claim a temp token (browser or client) |
| `/api/sync/rotate` | POST | Bearer | Rotate current session token |
| `/api/sync/revoke` | POST | Bearer | Revoke current session |

### Data Sync

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/sync/config` | GET | Bearer/Cookie | Get sync preferences |
| `/api/sync/config` | PUT | Bearer/Cookie | Update sync preferences |
| `/api/sync/key` | GET | Bearer/Cookie | Get master encryption key |
| `/api/sync/key` | PUT | Bearer/Cookie | Store/rotate master encryption key |
| `/api/sync/data` | GET | Bearer/Cookie | List all encrypted data items |
| `/api/sync/data/[type]` | GET | Bearer/Cookie | Download encrypted data blob |
| `/api/sync/data/[type]` | PUT | Bearer/Cookie | Upload encrypted data blob |
| `/api/sync/data/[type]` | DELETE | Bearer/Cookie | Delete encrypted data |

Valid data types: `history`, `environment`, `secret`, `collection`, `setting`.

### Devices

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/devices` | GET | Bearer/Cookie | List connected devices |
| `/api/devices/[id]` | DELETE | Bearer/Cookie | Revoke a device |

### Audit Log

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/audit` | GET | Bearer/Cookie | Get last 50 security audit events |

### Auth Management

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/auth/password` | PUT | Cookie | Change password (body: `{ current_password, new_password }`) |
| `/api/auth/verify-turnstile` | POST | None | Verify Cloudflare Turnstile token |

---

## Dashboard Pages

| Route | Page | Description |
|-------|------|-------------|
| `/dashboard` | Overview | Sync status summary, connected devices count, per-type sync cards |
| `/dashboard/sync` | Sync Settings | Toggle sync per data type (history, environments, secrets, collections, settings) |
| `/dashboard/devices` | Devices | View all connected devices, revoke access with confirmation |
| `/dashboard/security` | Security | View audit log (last 50 events), change password, encryption info |
| `/login` | Login | Sign in or create account with Turnstile bot protection |
| `/sync/authorize` | OAuth Authorize | Authorize a new sync device (reads `?token=` from query) |
| `/sync/complete` | OAuth Complete | Authorization success confirmation with auto-close countdown |

---

## Database Schema

### Tables

| Table | Purpose |
|-------|---------|
| `sync_temp_tokens` | Short-lived OAuth-like tokens (5-min TTL) |
| `sync_sessions` | Persistent device sessions (90-day expiry) with encrypted master key storage |
| `sync_configs` | Per-user sync preferences (5 boolean toggles, all default true) |
| `sync_data` | Encrypted sync blobs (one row per data type per user, versioned) |
| `devices` | Registered device metadata with approval status |
| `audit_logs` | Security event trail (8 event types) |
| `sync_events` | Event queue for real-time notifications (4 event types) |

### Row-Level Security

All 7 tables have RLS enabled with `user_id = auth.uid()` isolation policies. API routes authenticate at the application layer and use the admin client (service role) to bypass RLS.

### Audit Event Types

| Event Type | Trigger |
|------------|---------|
| `token_claimed` | Temp token claimed |
| `device_connected` | New session token issued |
| `config_updated` | Sync preferences changed |
| `key_stored` | Master key stored or rotated |
| `token_rotated` | Session token rotated |
| `token_revoked` | Session revoked |
| `device_revoked` | Device deleted |
| `data_cleared` | Sync data deleted |

---

## Middleware

The middleware (`src/middleware.ts`) handles:

- **Public routes** — `/login`, `/sync/authorize`, `/sync/complete`, `/api/*`, and `/` are accessible without authentication
- **CORS headers** — Allows all origins for GET, POST, PUT, DELETE, OPTIONS with `Content-Type` and `Authorization` headers. Preflight requests return 204 with 86400s max-age.
- **Dashboard protection** — Redirects unauthenticated users to `/login?redirect=<path>` for all `/dashboard/*` routes

---

## Security

- **Encryption**: AES-256-GCM with unique 12-byte random nonces per operation
- **Key Storage**: Master key stored as raw base64 on the server (no wrapping — only the key holder can decrypt)
- **Session Tokens**: Random 128-bit tokens prefixed `flm_sync_`, stored as SHA-256 hashes
- **Temp Tokens**: 5-minute TTL, single-use only, prefixed `flm_temp_`
- **Audit Trail**: All sensitive operations logged with event type, IP, user agent, and metadata
- **CORS**: Pre-configured for cross-origin desktop client access
- **Bot Protection**: Cloudflare Turnstile widget on signup form
- **Content Security**: CSP headers set in `next.config.ts`

---

## Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Next.js development server |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run lint` | Next.js lint |
| `npm run typecheck` | TypeScript type-check |

---

## License

MIT License — see [LICENSE](./LICENSE)

Copyright (c) 2024 Javier Fernández (Jallox/Jayox)
