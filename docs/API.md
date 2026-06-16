# Webhook integration

The app is both a webhook **consumer** (inbound) and a webhook **producer** (outbound).
This is how external engines (trigger.dev, LangGraph, etc.) connect — see
[reference/trigger-dev.md](./reference/trigger-dev.md) for Trigger.dev task patterns.

## Inbound — item ingestion

`POST /api/workflows/[id]/items`

External engines call this to enqueue items for review and to settle items after acting
on a decision. The payload is validated against `ItemSchema` (Zod). Authentication is
per-workflow HMAC (secret stored in the `workflows` table as `webhook_secret`).
Idempotent on `item.id`.

## Outbound — decision dispatch

When a reviewer fires an action whose `handler` is `{ url, method? }`:

1. The server action immediately persists the decision with `status = "dispatching"` and
   returns — the UI responds instantly.
2. An outbound POST is dispatched to the handler URL, HMAC-signed with the workflow's
   webhook secret.
3. The receiving engine acts on the decision and calls the inbound endpoint to settle the
   item to its final status.

Security: outbound URLs are validated against a per-workflow SSRF allowlist stored in the
DB. **No outbound dispatch fires to an unregistered host.**

## FastAPI data API — RateInsights rate estimate

The FastAPI service (`api/`) exposes a mock of Truckstop.com's RateInsights API, deriving a
rate band for a lane from the local `lanes` + `rate_snapshots` tables. The quote-desk engine
(feat-017) calls it to price a draft quote.

`POST /rate-insights/estimate` (optional `?persist=true`)

Request body (`RateInsightsRequest`):

```json
{
  "origin_city": "Los Angeles",
  "origin_state_code": "CA",
  "destination_city": "Phoenix",
  "destination_state_code": "AZ",
  "equipment_code": "V",
  "origin_zip_code": "90021",
  "destination_zip_code": "85043",
  "pickup_date": "2026-06-18"
}
```

Response (`RateInsightsEstimateOut`): echoed lookup plus `mileage`, the
`low/avg/high_rate_per_mile` linehaul band, `fuel_surcharge_per_mile`, the all-in dollar band
`total_low/avg/high` (`(rate_per_mile + fuel) × mileage`), and provenance/scoring
(`rate_source: "truckstop"`, `match_tier`, `comparable_count`, `confidence_score`,
`confidence_level`, `as_of`).

Matching strategy (pure helper in `api/services/rate_insights.py`, offline unit-tested):

1. **`lane_snapshots`** — recent `rate_snapshots` on the exact origin/destination *city*
   pair + equipment (within a 90-day window). Strongest signal.
2. **`lane_aggregate`** — fall back to the matching lane row's `avg_carrier_rate_per_mile`
   (± an 8% / 12% spread) when there are no fresh city-level comps.
3. **`loose_snapshots`** — widen to recent snapshots on the same origin/destination *state*
   pair + equipment (city ignored).
4. **`none`** — nothing matched; estimate carries no rate and zero confidence.

Thin history lowers `confidence_score`; the `high` band (≥ 0.75) is aligned with the
quote-desk `confidenceFloor`. With `?persist=true` and a matched lane, the lookup is written
back as a `rate_source='truckstop'` snapshot for the audit trail.
