# Pilot Rollout Runbook (1-2 Cities)

## Pre-launch
- Configure cities in `backend/src/config/cities.json`.
- Bring up infra with `infra/docker/docker-compose.yml` (MySQL + Redis).
- Start API + sockets (`cd backend && npm install && npm run db:migrate && npm run dev`).
- Verify health + smoke checks (`node scripts/pilot-smoke.js`).

## City Enablement Checklist
- Confirm fare config (`baseFare`, `perKm`, taxes).
- Confirm local support number and escalation owner.
- Enable a small driver cohort and monitor acceptance rates.
- Verify payment webhooks in staging before production.

## Launch Day
- Launch city 1 with limited geofence and limited fleet.
- Monitor API error rate, booking success, and socket latency.
- After stability window, launch city 2 with same checklist.

## Post-launch
- Compare cancellation, ETA variance, and payment failures by city.
- Tune pricing and dispatch radius city by city.
