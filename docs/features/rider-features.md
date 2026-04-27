# Rider Features

The **rider_app** is a **Rider Console**: it exercises backend APIs with forms and JSON panels, not a production consumer map-first experience. Below matches the shipped Flutter UI and `RiderApi`.

## Account & Identity

- Register with **phone** + password; optional **email** on registration.
- Sign-in with **phone** + **password**, or **phone** + **OTP** (request OTP, then sign-in with OTP).
- Session uses backend **JWT** (access token) via the shared session layer.
- Sign out from the console app bar.

_Not in the rider console today:_ dedicated profile screens (name, emergency contact), email-as-login, saved favorite places.

## Rides

- List **cities** and **vehicle types** from the backend; select for booking context.
- **Fare estimate** from distance (km), city, and vehicle type.
- **Create ride** with pickup/drop as **lat/lng** plus distance (km); optional **coupon** on create.
- **Validate** and **apply** coupon against a fare or ride id.
- **List my rides**; **get ride by id**; **update ride status** (e.g. cancelled, in_progress, completed) with **OTP required** when moving to `in_progress` (six-digit trip start code shown after create / in list for active rides).
- Socket subscription for **`driver:location:updated`** and **`message:new`** (surfaced in the in-app notification center).

_Not in the rider console today:_ map picker UI, scheduled rides, rich ride-type marketing, in-app trip share link for contacts.

## Parcels

- **Estimate parcel fare** (distance, weight, city, vehicle type).
- **Create parcel** with pickup/drop coordinates, sender/receiver fields, and metadata required by the API.
- **List my parcels**; **get parcel by id**; **update parcel status** with optional OTP when the backend requires it.

## Payments

- **List payment methods** (country/currency scoped, e.g. Nepal NPR in the client).
- **Create payment intent** for a ride (method, provider, amount, currency).
- **Payment timeline** for a payment id.

## Offers & Analytics

- **List offers** (optional city filter for windowed in-app offers).
- **Rider analytics** on the overview tab (e.g. trips, spend, cancellations — as returned by the API).

## Messaging & Support

- **List conversations**; **start conversation** with a participant user id (optional ride id).
- **Ensure support conversation** — opens or resumes **rider ↔ admin (operations)** thread; send via REST or socket **`message:send`** with ack when connected.
- **List messages** for a conversation; join conversation room over the socket.
- **Notification inbox** in the app bar; **server notification list** and **stats** on the Chat tab.
- **FCM:** register device token, foreground/background handling, **mark received / delivered / read** when `notificationId` is present in the payload.
- **Local notifications** and tap routing to tabs (rides, parcels, payments, chat, ratings).

## Ratings, Reports & Feedback

- **My rating summary** and **list my ratings**.
- **Create rating** (ride id, driver user id, score, comment).
- **User rating summary** lookup for another user id.
- **Create report** and **list my reports**.

## Product roadmap (not rider console)

Consumer-grade **map booking**, **SOS**, **trusted contacts**, **wallet** UX, and **dispute** flows are backend or product extensions beyond what the Rider Console implements today.
