# Product Features

This directory describes capabilities **as implemented in this repository** (Flutter console apps + Node backend), and calls out **product-style** items only when they are still ahead of the current UI.

## Feature Documents

- [Rider Features](./rider-features.md)
- [Driver Features](./driver-features.md)
- [Admin Features](./admin-features.md)
- [Shared Platform Features](./platform-features.md)

## Current scope (summary)

- **Rider app:** Rider Console — auth, ride and parcel booking flows (coordinates + distance), fare estimate, coupons, payments (intent + timeline), offers, analytics, chat (including rider ↔ admin support), ratings/reports, push (FCM) and local notifications, Socket.IO hooks for messages and driver location.
- **Driver app:** Driver Console — auth (password), ride list and status updates (including **trip start OTP** from rider), socket location pings, KYC + vehicles, messaging, ratings/reports, push and notifications.
- **Admin app:** Admin Console — analytics (including revenue rollups and parcels where exposed), live rides JSON, reports and KYC review, ride/parcel lookup, payments reconciliation and ops (refunds, payouts, method config), **broadcast and targeted notifications**, messaging, audit logs.
- **Platform:** Express HTTP API, Socket.IO realtime (messages, driver location, conversation join), MySQL-backed store (with in-memory path for dev), JWT auth, dispatch and ride/parcel lifecycles, payments, ratings, reports, notifications.
