# Ride App Features

Centralized overview of implemented product features for the ride-hailing platform.

## Feature Groups
- Rider features
- Driver features
- Admin features
- Shared platform features
- Trust and safety features
- Growth and monetization features
- Analytics and dashboard features

## Rider Features
### Account and profile
- Phone-based sign-in with required phone and optional email
- Password and OTP sign-in support
- Role-based auth session (rider)
- Profile basics and account status handling

### Ride booking and trip lifecycle
- Fare estimate by city and distance
- Create ride request with pickup/drop points
- Vehicle-type aware booking and pricing
- Ride start OTP verification support
- View ride status and trip history
- Ride detail lookup by id
- Cancelled/completed state handling

### Real-time experience
- Live driver location updates via Socket.IO
- Ride room subscription support for trip updates
- Rider <-> Driver/Admin chat messaging (conversation + messages)

### Payments and pricing
- Payment intent creation and status update flow
- Payment timeline/history visibility
- Coupon validation and coupon application support
- Discount-aware final fare handling
- App-filtered payment methods listing

### Ratings and feedback
- Rider can rate driver after completed trip
- One directional rating per ride per user pair
- Received ratings listing and aggregate summary
- Driver summary lookup (privacy-safe fields)

### Safety and accountability
- Report driver/user from authenticated account
- View own submitted reports
- Auto moderation support through report thresholds

### Rider analytics dashboard
- Daily/weekly/monthly/yearly/all-time stats
- Total rides, completed rides, cancelled rides
- Total spent, total savings, penalties

## Driver Features
### Account and profile
- Phone-based sign-in with required phone and optional email
- Password and OTP sign-in support
- Role-based auth session (driver)
- Status-aware account access (active/suspended/banned)
- Driver KYC submit and status view

### Availability and dispatch
- Live location upsert events
- Nearest available driver matching
- Driver assignment to ride requests

### Trip operations
- Ride status transitions through API
- Ride start OTP verification support
- Assigned/completed/cancelled ride visibility
- Ride detail lookup by id

### Earnings and deductions
- Gross fare tracking per trip
- Commission computation against configurable rate
- Penalty handling support
- Net earnings calculation
- Payout ledger visibility via admin reconciliation flows

### Ratings and trust
- Driver can rate rider after completed trip
- Duplicate directional ratings blocked
- Received ratings listing and aggregate summary
- Rider summary lookup (privacy-safe fields)
- Report rider/user and view own reports

### Driver analytics dashboard
- Daily/weekly/monthly/yearly/all-time stats
- Total rides, completed rides, cancelled rides
- Gross earnings, commission given, penalties, net earnings

## Admin Features
### Operations and controls
- City listing and city creation
- Vehicle type listing and creation
- Live rides monitoring endpoint
- System-wide reports listing endpoint
- Audit logs listing endpoint
- Ride and parcel detail lookup by id

### Trust and safety
- Full report visibility for admin
- Automatic suspension and ban triggers from report thresholds
- Account action records for moderation events
- Driver KYC queue review (approve/reject)
- Admin report submission and personal report history views

### Promotions and campaigns
- Create and list coupons
- Create and list active offers (global or city-scoped)

### Financial and policy controls
- Commission rate configuration via environment
- Penalty model integrated in analytics data flow
- Payment status updates, refunds, payouts, and reconciliation tools
- Payment method upsert and grouped listing

### Admin analytics dashboard
- Daily/weekly/monthly/yearly/all-time stats
- Total rides, completed rides, cancelled rides
- Gross bookings, commission earned, penalties collected, net platform revenue

## Shared Platform Features
### API architecture
- Express modular backend using routes/controllers/services pattern
- Role-aware middleware (`rider`, `driver`, `admin`)
- Request context and structured HTTP logging

### Realtime infrastructure
- Socket.IO server for driver location streaming
- Event broadcast for live location updates
- Socket-authenticated conversation messaging events

### Data and persistence
- MySQL-backed persistence layer
- Redis-ready local infra setup
- SQL bootstrap schema for all core entities
- MySQL-backed tests with fixture reset/reseed flow

### Auditing and governance
- Entity-level audit logs with before/after snapshots
- Standard audit fields across domain tables:
  - `created_at`, `updated_at`
  - `created_by`, `updated_by`

### Reliability and DX
- Unit/integration style test suite for core modules
- CI workflow for backend tests
- Local migration script support

## Trust and Safety Features
- Report creation by authenticated rider/driver
- Open report counting per reported account
- Auto suspension when report threshold is reached
- Auto ban when higher threshold is reached
- Account lock enforcement during auth/middleware checks
- Moderation action journaling in account actions and audit logs

## Growth and Monetization Features
### Coupons
- Admin-created coupon catalog
- Percentage/fixed discount modes
- Min fare and max discount controls
- Activation window and usage limit checks
- Redemption tracking per ride and rider

### Offers
- Admin-created offer campaigns
- Active-window filtering
- Optional city targeting

## Analytics Features (Pre-aggregated)
- Dedicated daily aggregate tables for scale:
  - `driver_daily_stats`
  - `rider_daily_stats`
  - `admin_daily_stats`
- Incremental updates triggered by:
  - Ride creation and ride status transitions
  - Coupon redemptions
  - Penalty creation
- Period dashboards computed from aggregates (not full raw scans)

## Notifications Features
- Backend `notifications` and `user_device_tokens` tables
- Notification lifecycle tracking: sent, received, delivered, read
- User-level and global notification stats endpoints
- Admin send-notification endpoint
- FCM push dispatch integration and dead-token deactivation
- Flutter app integration in all apps:
  - FCM token registration to backend
  - Foreground/background handling
  - OS-level local banners via `flutter_local_notifications`
  - Notification tap deep-link handling by payload `type`
- Android manifests configured with default FCM channel IDs per app

## Current Core Tables
- `users`
- `cities`
- `rides`
- `ride_events`
- `driver_locations`
- `payments`
- `ratings`
- `user_rating_stats`
- `reports`
- `account_actions`
- `audit_logs`
- `coupons`
- `offers`
- `coupon_redemptions`
- `penalties`
- `vehicle_types`
- `driver_vehicles`
- `driver_kyc`
- `parcels`
- `parcel_events`
- `messages`
- `conversations`
- `payment_events`
- `payment_refunds`
- `payment_webhooks`
- `payout_ledger`
- `payment_methods`
- `notifications`
- `user_device_tokens`
- `driver_daily_stats`
- `rider_daily_stats`
- `admin_daily_stats`

## Existing Detailed Feature Docs
- `docs/features/README.md`
- `docs/features/rider-features.md`
- `docs/features/driver-features.md`
- `docs/features/admin-features.md`
- `docs/features/platform-features.md`
