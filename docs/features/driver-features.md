# Driver Features

The **driver_app** is a **Driver Console**: it drives dispatch and ride APIs from forms and JSON, not a production driver map UX. Below matches the shipped Flutter UI and `DriverApi`.

## Account & Identity

- **Register** with phone + password; optional email.
- **Sign-in** with phone + **password** (the console sign-in screen does not use OTP; the API supports `request-otp` for driver if you wire it).
- JWT session and sign out from the app bar.

## Overview

- **Driver analytics** (totals for rides, earnings, commission, cancellations, penalties — as returned by `/analytics/driver`).

## Rides & Dispatch

- **Online** toggle; when on, ensures the app **socket** connects.
- **Emit driver location** on the socket (`driver:location` with driver id, city id, lat/lng) for dispatch/nearby logic on the server.
- **List my rides**; **update ride status** for a ride id (accepted, arrived, in_progress, completed, cancelled, etc. — per backend rules).
- **Trip start:** moving to **`in_progress`** requires the **rider’s six-digit trip code** (OTP); dedicated control to fill ride id from “first active” ride and submit `in_progress` with code.
- Listen for **`message:new`** and **`driver:location:updated`** (surfaced in the notification center).

_Not in the driver console today:_ dedicated incoming-request card UI with accept/reject countdown (dispatch may still assign rides server-side), in-app navigation to pickup, dedicated no-show flow screens.

## KYC & Vehicles

- **Get my KYC**; **submit KYC** (full name, license number, document URL).
- **List vehicle types**; **list my vehicles**; **add driver vehicle** (type id, plate, model, color, default flag).

## Messaging

- **List conversations**; **start conversation** with participant user id; **join** conversation on socket.
- **List messages**; **send message** (REST).
- **My notifications** and **stats** from the server; FCM token registration and push **received / delivered / read** acks when applicable.
- **Local notifications** and tap routing (rides, KYC, messages, ratings).

## Ratings & Safety

- **My rating summary**; **ratings received** list.
- **Rate rider** after a trip (ride id, rider user id, score, comment).
- **Lookup rider rating summary** by user id.
- **Report rider** with reason, description, optional ride id; **list my reports**.

## Earnings & Payouts

- Earnings and commission appear in **analytics** and ride-related payloads as the backend provides them.

_Not in the driver console today:_ dedicated payouts wallet UI, incentive/bonus dashboards (beyond what analytics returns).
