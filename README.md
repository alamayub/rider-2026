# Ride App Monorepo

Uber/Ola-style ride-hailing platform using:
- Node.js, Express, Socket.IO, MySQL, nodemon
- Flutter, flutter_hooks, hooks_riverpod

## Structure
- `backend/` API + realtime server
- `apps/rider_app/` Rider Flutter app
- `apps/driver_app/` Driver Flutter app
- `apps/admin_app/` Admin Flutter app
- `packages/shared_models/` Shared DTOs
- `packages/shared_client/` Shared API/socket clients
- `infra/docker/` Local MySQL + Redis

## What is implemented
- MySQL-only backend persistence (no in-memory runtime data path)
- JWT auth with role-aware access (`rider`, `driver`, `admin`)
- Password + OTP sign-in with rate limits and lock protections
- Ride lifecycle with OTP gate before ride start
- Parcel delivery lifecycle with single OTP for pickup/drop flow
- Real-time messaging and driver location via Socket.IO
- Payments depth: intents, status transitions, timeline/events, refunds, payouts, reconciliation
- Nepal-oriented methods support (eSewa, Khalti, Fonepay, ConnectIPS) via payment methods catalog
- Ratings with aggregate stats and privacy-safe user summary views
- Trust/safety: reports, moderation history, account action trails, audit logs
- Driver KYC submit/review flow and driver-vehicle mapping
- Notifications system:
  - Backend notification records + status lifecycle (`sent`, `received`, `delivered`, `read`)
  - FCM device-token registration endpoint
  - Push dispatch pipeline + invalid token deactivation
  - Flutter in-app center + OS local banners + deep-link routing

## Quick start
### Infrastructure
```bash
cd infra/docker
docker compose up -d
```

### Backend
```bash
cd backend
cp .env.example .env
npm install
npm run db:migrate
npm run dev
```

### Mobile apps
Run each app separately with Flutter:
```bash
cd apps/rider_app && flutter pub get && flutter run
cd apps/driver_app && flutter pub get && flutter run
cd apps/admin_app && flutter pub get && flutter run
```

## Notification setup notes (Android)
Each app manifest contains Firebase default channel metadata and it is aligned with app channels:
- Rider: `rider_app_notifications`
- Driver: `driver_app_notifications`
- Admin: `admin_app_notifications`

See notification payload contract: `docs/notifications/payload-schema.md`.
