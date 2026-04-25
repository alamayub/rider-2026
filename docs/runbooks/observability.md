# Observability Runbook

## Logging
- Structured JSON logs for app lifecycle and each HTTP request.
- Every request includes `x-request-id` for tracing.

## Error Tracking
- `captureException` helper logs stack + request context.
- Integrate the helper with Sentry or Datadog in production.

## Basic Performance Checks
- Start backend and run `npm run load:test` in `backend/`.
- Track response success count and requests-per-second.
