# Ride App Features

Centralized overview of all implemented and planned product features for the ride-hailing platform.

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
- Phone-based sign-in with optional email field
- Role-based auth session (rider)
- Profile basics and account status handling

### Ride booking and trip lifecycle
- Fare estimate by city and distance
- Create ride request with pickup/drop points
- View ride status and trip history
- Cancelled/completed state handling

### Real-time experience
- Live driver location updates via Socket.IO
- Ride room subscription support for trip updates

### Payments and pricing
- Payment intent creation and webhook status update flow
- Coupon validation and coupon application support
- Discount-aware final fare handling

### Ratings and feedback
- Rider can rate driver after completed trip
- One directional rating per ride per user pair
- Received ratings listing endpoint

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
- Phone-based sign-in with optional email field
- Role-based auth session (driver)
- Status-aware account access (active/suspended/banned)

### Availability and dispatch
- Live location upsert events
- Nearest available driver matching
- Driver assignment to ride requests

### Trip operations
- Ride status transitions through API
- Assigned/completed/cancelled ride visibility

### Earnings and deductions
- Gross fare tracking per trip
- Commission computation against configurable rate
- Penalty handling support
- Net earnings calculation

### Ratings and trust
- Driver can rate rider after completed trip
- Duplicate directional ratings blocked

### Driver analytics dashboard
- Daily/weekly/monthly/yearly/all-time stats
- Total rides, completed rides, cancelled rides
- Gross earnings, commission given, penalties, net earnings

## Admin Features
### Operations and controls
- City listing and city creation
- Live rides monitoring endpoint
- System-wide reports listing endpoint
- Audit logs listing endpoint

### Trust and safety
- Full report visibility for admin
- Automatic suspension and ban triggers from report thresholds
- Account action records for moderation events

### Promotions and campaigns
- Create and list coupons
- Create and list active offers (global or city-scoped)

### Financial and policy controls
- Commission rate configuration via environment
- Penalty model integrated in analytics data flow

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

### Data and persistence
- MySQL-backed persistence layer
- Redis-ready local infra setup
- SQL bootstrap schema for all core entities

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

## Current Core Tables
- `users`
- `cities`
- `rides`
- `ride_events`
- `driver_locations`
- `payments`
- `ratings`
- `reports`
- `account_actions`
- `audit_logs`
- `coupons`
- `offers`
- `coupon_redemptions`
- `penalties`
- `driver_daily_stats`
- `rider_daily_stats`
- `admin_daily_stats`

## Existing Detailed Feature Docs
- `docs/features/README.md`
- `docs/features/rider-features.md`
- `docs/features/driver-features.md`
- `docs/features/admin-features.md`
- `docs/features/platform-features.md`
