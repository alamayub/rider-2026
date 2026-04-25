# Ride App Architecture

## Services
- Express API for auth, rides, admin, payments, ratings
- Socket.IO hub for location and ride event streaming
- Redis for queue/pub-sub; MySQL for durable storage

## Mobile Clients
- Rider app for booking and tracking
- Driver app for availability and trip execution
- Admin app for operations and interventions

## Core Ride Lifecycle
1. Rider requests ride
2. Dispatch finds nearest available driver
3. Driver accepts and arrives
4. Trip starts and location streams
5. Trip ends and payment settles
