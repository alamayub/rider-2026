# Shared Platform Features

## Core Backend Services
- Express API gateway with module boundaries
- Socket.IO hub for bi-directional realtime events
- Ride service with explicit status transitions
- Dispatch service with nearest-driver logic
- Payments, ratings, and admin domain modules

## Data & Storage
- Core entities: User, RiderProfile, DriverProfile, Vehicle, City, Ride, RideEvent, DriverLocation, Payment, Payout, Rating, Promo, Wallet
- Immutable ride event stream for audit trails
- City configuration-driven behavior (no city-specific code forks)
- MySQL + Redis architecture target for production

## Realtime & Eventing
- Driver location updates broadcasted in near-real-time
- Ride room subscriptions for trip-specific updates
- Dispatch-to-driver assignment notifications
- Request tracing via request IDs

## Security & Governance
- Role-based access controls (rider/driver/admin)
- JWT auth with refresh-token pattern
- Rate limiting and OTP abuse mitigation baseline
- Signed webhook and idempotency support for payments
- Audit logging for operational/admin actions

## Reliability & Observability
- Structured logs for HTTP and server lifecycle events
- Error capture hooks with contextual metadata
- Unit/integration test baseline for core lifecycle
- Basic load-test tooling for health/realtime throughput
- CI workflow for automated backend test checks

## DevEx & Deployment
- Monorepo with app/package/backend boundaries
- Docker compose for local infra (MySQL + Redis)
- Multi-city pilot rollout runbook and smoke checks
- Foundation for phased rollout to full marketplace feature set
