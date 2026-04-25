# Rider Features

## Account & Identity
- Phone/email sign-in and OTP verification
- JWT session management with refresh flow
- Basic profile management (name, phone, emergency contact)
- Saved favorite places (home/work/custom)

## Ride Discovery & Booking
- Pickup/drop input with map-assisted selection
- Fare estimate before booking
- Ride type selection (standard/premium/future shared)
- Immediate booking and scheduled ride support
- Cancel ride with rule-based cancellation logic

## Realtime Trip Experience
- Driver assignment and ETA updates
- Live map tracking of driver location
- Ride status timeline (`requested`, `matched`, `arrived`, `in_progress`, `completed`)
- In-app trip sharing for safety contacts

## Payments & Billing
- Cash and online payment options
- Payment intent creation and confirmation state
- Invoice/trip receipt after completion
- Promo/coupon application (phase expansion)
- Wallet balance usage (phase expansion)

## Trip History & Feedback
- Past rides list with filter by city/date/status
- Ride details (distance, fare, route summary)
- Rider-to-driver star rating and feedback comments
- Dispute or support request initiation for a completed ride

## Safety & Support
- SOS shortcut and emergency workflow
- Trusted contact notifications for active trip
- In-app support ticket creation
- Fraud-safe idempotent request handling for critical actions
