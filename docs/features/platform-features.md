# Shared Platform Features

Cross-cutting behavior implemented in the **Node (Express) + Socket.IO** backend and shared contracts used by rider, driver, and admin apps.

## HTTP API

- **Express** app with modular routes: auth, rides, parcels, coupons, offers, payments, ratings, reports, messages, notifications, driver KYC, driver vehicles, admin, analytics.
- **JWT** bearer authentication for protected routes; role-aware behavior (rider / driver / admin).
- **REST** JSON payloads; consistent error responses for the Flutter clients.

## Realtime (Socket.IO)

- **Driver location** ingestion and broadcast (`driver:location` / `driver:location:updated` patterns as implemented in `socket` code).
- **Messaging:** `conversation:join`, `message:new`, `message:send` with ack where supported.
- Connection lifecycle integrated with the Flutter consoles.

## Core domains

- **Rides:** lifecycle with statuses, dispatch-related assignment, **trip start OTP** for rider/driver verification on `in_progress`, ride events for auditing.
- **Parcels:** separate estimate/create/status flows and parcel events.
- **Dispatch:** nearest-driver style matching using stored driver locations (used by ride/parcel services).
- **Payments:** intents, status updates, timelines, refunds, payouts, configurable **payment methods** (including Nepal-oriented defaults in seed/config).
- **Coupons** validate/apply; **offers** for rider-facing promotions.
- **Ratings** and **reports** across roles.
- **Messages** (conversations + thread messages); **rider support** conversation endpoint tying riders to active admin.
- **Notifications:** per-user records, FCM delivery path, device token registration, admin **broadcast** send with targeting and stats endpoints.
- **Analytics:** rider, driver, and admin aggregates including revenue rollups where implemented.

## Data & persistence

- **MySQL** pool with a large in-memory compatibility layer in `store` for development and tests.
- Primary entity families include: users, cities, vehicle types, rides, ride events, parcels, parcel events, driver locations, driver vehicles, driver KYC, payments (+ events, refunds, webhooks, payouts), ratings, coupons, offers, conversations, messages, notifications, device tokens, reports, penalties, daily stats rollups for analytics.

## Security & operations

- Password hashing and validation rules aligned with the apps.
- **Audit logs** for admin-visible operational history (as exposed on admin overview).
- Structured **logging**, request context, and test coverage for major routes and lifecycles.

## Client infrastructure

- **Monorepo** with `apps/rider_app`, `apps/driver_app`, `apps/admin_app` and `backend/`.
- **Firebase Cloud Messaging** in all three Flutter apps for push; optional **local notifications** for foreground display and tap routing.

## DevEx

- **Docker Compose** (or documented local DB) for MySQL/Redis as per repo setup; **CI** for backend tests; scripts for migration/smoke/load testing where present in `backend/scripts`.
