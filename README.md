# Ride App Monorepo

Uber/Ola-style ride-hailing platform scaffold using:
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
