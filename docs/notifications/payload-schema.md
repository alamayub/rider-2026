# Notification Payload Schema

This schema standardizes push/local notification payloads used by `admin_app`, `driver_app`, and `rider_app`.

All producers (backend events, webhooks, cron jobs, admin tools) should include a canonical `type` field.  
Apps route taps based on `type` first, then fallback to heuristic key checks.

## Required fields

- `type` (string): canonical notification type
- `title` (string): notification title
- `body` (string): notification body

## Optional common fields

- `eventType` (string): alternate/legacy type key (apps treat as fallback for `type`)
- `rideId` (string)
- `parcelId` (string)
- `paymentId` (string)
- `conversationId` (string)
- `messageId` (string)
- `kycId` (string)
- `reportId` (string)
- `vehicleTypeId` (string)
- `cityId` (string)
- `actorUserId` (string)
- `metadata` (object)

## Canonical types

Use these exact values whenever possible.

- `message`
- `chat`
- `push-message`
- `ride`
- `trip`
- `dispatch`
- `parcel`
- `delivery`
- `payment`
- `refund`
- `payout`
- `report`
- `kyc`
- `safety`
- `city`
- `vehicle`
- `ops`
- `rating`
- `review`

## App routing map

### Admin app

- `message/chat/push-message` -> Messages tab
- `payment/refund/payout` -> Payments tab
- `report/kyc/safety` -> Trust & Safety tab
- `city/vehicle/ops` -> Ops tab
- fallback -> Overview tab

### Driver app

- `message/chat/push-message` -> Messages tab
- `ride/trip/dispatch` -> Rides tab
- `kyc/vehicle` -> KYC & Vehicle tab
- `rating/review` -> Ratings tab
- fallback -> Overview tab

### Rider app

- `message/chat/push-message` -> Chat & Ratings tab
- `parcel/delivery` -> Parcels tab
- `payment/refund` -> Payments tab
- `ride/trip` -> Rides tab
- `rating/review` -> Chat & Ratings tab
- fallback -> Overview tab

## Example payloads

### Message

```json
{
  "type": "message",
  "title": "New message from driver",
  "body": "I am at your pickup point",
  "conversationId": "conv_123",
  "messageId": "msg_456",
  "rideId": "ride_789"
}
```

### Payment success

```json
{
  "type": "payment",
  "title": "Payment successful",
  "body": "Your NPR 220 payment is complete",
  "paymentId": "pay_001",
  "rideId": "ride_789",
  "metadata": {
    "provider": "esewa"
  }
}
```

### KYC status update

```json
{
  "type": "kyc",
  "title": "KYC approved",
  "body": "Your driver KYC has been approved",
  "kycId": "kyc_202",
  "actorUserId": "admin_12"
}
```

## Producer guidance

- Always set `type`.
- Keep keys camelCase for IDs (`rideId`, `paymentId`, etc.).
- Include entity IDs for deep-link context.
- Keep `metadata` small (avoid large nested payloads).
- Treat `title/body` as user-visible content.
