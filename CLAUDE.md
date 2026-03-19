# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This App Is

**CalO by FoodPharmer** — a full-stack calorie tracking app. Users photograph food; an AI backend analyzes the image and logs nutritional data. Supports iOS, Android, and Web (PWA).

---

## Commands

### Frontend (Expo)

```bash
# Start dev server
npm run dev

# Platform-specific
npm run android
npm run ios
npm run web

# Lint
npm run lint

# Build
npm run build:web
npm run build:android
```

### Backend (from `backend/`)

```bash
cd backend

# Dev server (hot reload)
npm run dev

# Database
npm run db:generate    # Generate Drizzle schema
npm run db:migrate     # Run migrations
npm run db:push        # Generate + migrate
npm run db:seed        # Seed food database (20k+ items)
```

There is no test suite configured.

---

## Architecture

### Frontend

**Expo Router** with file-based routing. Platform-specific variants use `.ios.tsx` suffix (e.g., `profile.ios.tsx` vs `profile.tsx`). iOS variants often have native UI; Android uses custom components like `FloatingTabBar`.

**Auth flow**: `app/_layout.tsx` wraps everything in `AuthGate`, which redirects unauthenticated users to `/auth`. After sign-in, users may be pushed to `/onboarding` if profile setup is incomplete.

**Tab structure** (`app/(tabs)/`):
- `(home)/` — daily calorie dashboard with food entry list
- `history` — calendar-based historical view
- `profile` — user profile and settings

**Modal routes**: `camera`, `onboarding`, `notifications`, `join-group/[token]`

**State management**:
- `contexts/AuthContext.tsx` — session state, sign in/out, guest mode, bearer token
- `contexts/ThemeContext.tsx` — light/dark mode (iOS is forced light)
- `lib/auth.ts` — Better Auth client; token stored in SecureStore (native) or localStorage (web)
- `utils/api.ts` — `authenticatedGet/Post/Delete()` helpers with exponential backoff retry (up to 7 retries), SSL error handling

### Backend

**Fastify 5** server in `backend/src/`. Entry: `backend/src/index.ts`.

Routes in `backend/src/routes/`:
| Route | Purpose |
|---|---|
| `auth.ts` | Better Auth endpoints |
| `food-entries.ts` | CRUD + AI image recognition |
| `user-profile.ts` | Profile management |
| `usage.ts` | Free-tier scan limits (dailyUsage table) |
| `groups.ts` | Group management |
| `invitations.ts` | Group invite tokens |
| `notifications.ts` | User notifications |

**Database**: PostgreSQL via **Drizzle ORM**. Schema in `backend/src/db/schema.ts`. Key tables: `foodEntries`, `userProfiles`, `dailyUsage`, `foodDatabase` (20k+ items, auto-seeded on startup), `groups`, `groupMembers`, `groupInvitations`, `guestUsers`, `guestDailyUsage`.

**Auth**: Better Auth handles sessions. Bearer tokens passed in all API requests. Guest users get limited daily scans tracked separately from registered users.

### Theme System

- **Light**: green primary `#10B981`, off-white background `#F8FAF9`
- **Dark**: golden primary `#FFD700`, dark purple background `#1A1625`
- iOS always uses light theme (dark mode disabled)
- Macro colors: Protein=Red, Carbs=Orange, Fat=Blue
- Persisted via AsyncStorage (non-iOS)

### Deep Linking

Scheme: `iwanttobuildaca://` — used for group invite links and OAuth callbacks. Configured in `app.json`.

### Platform Considerations

- iOS files (`.ios.tsx`) use native navigation patterns; Android uses `FloatingTabBar`
- Tab layout (`app/(tabs)/_layout.tsx`) returns `null` on iOS — iOS uses its own layout file
- Some SSL/TLS error handling is iOS-specific in `utils/api.ts`
- Web builds use Workbox for PWA/offline support

### Path Aliases (tsconfig)

`@/*` maps to root. Components importable as `@components/...`, etc.

---

## Deployment

| Layer | Host | Notes |
|---|---|---|
| Backend | **Specular** | `https://8sy935d3kbfkkm35z7tbk22nep8qpb9m.app.specular.dev` |
| Database | **Neon Postgres** | Serverless, managed by Specular |
| Frontend | **EAS / Expo** | iOS + Android via EAS Build; Web via `expo export` |

**Setting backend environment variables**: The live server reads env vars from the **Specular Dashboard → Project → Environment Variables / Secrets**. There is no `.env` file that controls the deployed server. When a new secret is needed (e.g. `REVENUECAT_WEBHOOK_SECRET`), add it there.

### RevenueCat Integration

- Paywall screen: `app/subscribe.tsx` (modal, push via `router.push('/subscribe')`)
- SDK abstraction: `lib/purchases.native.ts` (real) / `lib/purchases.ts` (web stub)
- Webhook endpoint: `POST /api/webhooks/revenuecat`
- API keys (public, safe to bake in): `app.json` → `extra.revenuecatIosKey` / `extra.revenuecatAndroidKey`
- Webhook secret: set `REVENUECAT_WEBHOOK_SECRET` in Specular Dashboard

### Guest Session Limit

- Guests are locked out after 7 days from account `createdAt`
- Check endpoint: `GET /api/auth/guest-status` → `{ is_guest, expired, days_remaining }`
- Guard runs in `AuthGate` (`app/_layout.tsx`) on every cold start when `user.isGuest === true`; network failures fail open (guest not evicted)
