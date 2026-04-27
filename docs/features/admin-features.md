# Admin Features

The **admin_app** is an **Admin Console** for operators and developers: analytics, configuration, trust/safety, payments, outbound notifications, and messaging. Below matches the shipped Flutter UI and `AdminApi`.

## Overview

- **Admin analytics**: ride and user counters, revenue and commission aggregates, **parcels delivered** when present, **live rides** list, **open reports** count.
- **Revenue by city** table: net platform revenue by period (daily / weekly / monthly / yearly / all time) from stored rollups, plus **all cities combined** row when the API returns it.
- **Recent audit logs** (JSON panel).

## Cities & Vehicle Types (Ops tab)

- **List cities**; **create city** by name.
- **List vehicle types**; **create vehicle type** (id, code, name, capacity, fare multiplier).

_Not in the admin console today:_ rich fare editor per city (base/per-km) in the Flutter UI — city-level pricing may still be driven by backend config/seed data outside this screen.

## Trust & Safety

- **Reports** list with filters (reported user id, reason); chips by reason volume.
- **Driver KYC queue** with status filter (all / pending / approved / rejected); **approve** or **reject** with optional rejection reason for a selected driver id.
- **User rating summary** lookup by rider or driver user id.
- **Submit report** (same API as other roles) and **list my reports** for the signed-in admin user.
- **Ride lookup** and **parcel lookup** by id (detail JSON).

## Payments

- **Reconciliation** summary panel.
- **Grouped payment methods** per app scope (admin / rider / driver).
- **Payment timeline**; **update payment status** (status, provider payment id, failure fields).
- **Create refund** and **create payout** against a payment id.
- **Upsert payment method** (code, name, provider, category, enabled, supported apps/countries/currencies).

## Notifications (Notify tab)

- **Global** and **my** notification stats; **my notifications** list.
- **Send admin notification**: audience targets (e.g. all users, all riders, all drivers, specific user/rider/driver), optional **search** for specific recipients, **bulk SEND confirmation** for broadcast targets, title/body/type/channel, optional **JSON payload** (e.g. for deep-link hints).

## Messages

- **List conversations**; **start** with participant user id (e.g. rider); **join** on socket; **list/send messages**.
- Live **`message:new`** stream panel.

## Account & Push

- Admin **sign-in** (phone + password); **FCM** device token registration and push acks consistent with other apps.

_Not in the admin console today:_ full fleet map visualization (live rides are shown as structured JSON, not a map canvas).
