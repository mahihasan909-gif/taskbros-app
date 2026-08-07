# TaskBros

Bachelor-mess (shared room) manager. Roommates submit their weekly busy hours;
the admin sees everyone's free time and assigns a fair, recurring chore
rotation. Reminders fire on time — even if nobody has the app open.

## Stack

- Expo (React Native, SDK 54) + TypeScript, Expo Router (file-based, multi-screen)
- NativeWind (Tailwind for RN) — dark/light theme, CSS-variable driven
- Supabase — Auth, Postgres, Row Level Security, Edge Functions, Realtime, pg_cron
- expo-notifications + Notifee — local alarm-style reminders
- Firebase Cloud Messaging (via Expo push service) — server-driven reminders that work without opening the app
- EAS Build — dev-client and production APK builds

## Structure

```
app/
  _layout.tsx              root stack + theme/auth/room providers
  index.tsx                 session-aware redirect
  (auth)/                    welcome, login, signup
  (tabs)/                    home, routine, schedule, room, profile
  room/create.tsx, room/join.tsx   modals
  profile/edit.tsx, privacy.tsx, help.tsx
components/ui/              Button, TextField, Card, Badge, ScreenContainer
contexts/                    Auth, Room (membership/profile/role), Theme
lib/                          supabase client, date/notifications helpers
types/db.ts                   shared domain types
supabase/schema.sql            base tables + RLS
supabase/migrations_*.sql      incremental migrations, run in order
supabase/functions/            generate-schedule, send-reminders (edge functions)
```

## Core features

- **Rooms** — create as admin, join by code with admin approval, leave/remove members, delete room.
- **Routine** — each member logs weekly busy blocks (class/work), 12-hour picker, multiple slots per day.
- **AI Suggest** — a free-time table computed from routines (no external AI call); admin manually assigns chores from it.
- **Recurring tasks** — assign once, repeats every week on that weekday until the admin removes it.
- **Notifications** — alarm-style local reminder (full-screen, loops, bypasses DND) at task time, repeating until marked Done; a server-side cron job (Supabase Edge Function + pg_cron) also pushes reminders and "done" pings to the admin even if the app was never opened that day.

## Setup

```bash
cp .env.example .env
# fill EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY
npm install
npx expo start --dev-client
```

Run every file in `supabase/` (schema.sql, then migrations_1 through the latest, in order) in the Supabase SQL editor.

Notifications require a custom dev-client or production build (`eas build`) —
they are not supported in plain Expo Go.

## Building

```bash
eas build --platform android --profile development   # dev-client, for testing
eas build --platform android --profile production     # standalone APK, no PC/server needed
```

Server-side push reminders additionally need:
- A Firebase project with an FCM V1 service account key uploaded via `eas credentials -p android`
- `supabase secrets set CRON_SECRET=<random>` and `supabase functions deploy send-reminders --no-verify-jwt`
- The `pg_cron` + `pg_net` schedule in `migrations_14_reminder_cron.sql`
