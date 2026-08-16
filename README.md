# CSE5006 Assessment 3 — Data-driven web application & reporting

Turns the RSS Server into a system that proves it is working: an operational dashboard, alert
rules, database-backed metrics, and evidence from Playwright, JMeter and Lighthouse.

**Student:** Xueting Denise Chin (22663637)
**Assessment 1 frontend:** [cse5006-assessment1-rss-server](https://github.com/dd2026TECH/cse5006-assessment1-rss-server)
**Assessment 2 backend:** [cse5006-assessment2-rss-server](https://github.com/dd2026TECH/cse5006-assessment2-rss-server)

## Why the history looks long

This repo was created by cloning the Assessment 2 app rather than copying its files, so A1 and A2's
full build history is an ancestor of every commit here — one continuous story from the original
`create-next-app` scaffold through to this stage. The Assessment 1 and 2 repos themselves are left
untouched exactly as they were submitted.

## Architecture

Unchanged from Assessment 2's split — two Next.js packages plus a database service:

```
.
├── frontend/                 Next.js UI — now includes /dashboard
├── api/                      Next.js API only — route handlers + Prisma
├── docs/
│   ├── load-testing/         JMeter plan (.jmx) + staged results (.jtl) + SUMMARY.md
│   └── lighthouse/           Before/after accessibility results (.json) + SUMMARY.md
└── docker-compose.yml        frontend · api · postgres
```

| Service | Role | Tech | Port (host:container) |
|---|---|---|---|
| `frontend` | UI only | Next.js | `80:3000` |
| `api` | REST API only | Next.js + Prisma 7 | `4080:3000` |
| `postgres` | Database | `postgres:15`, named volume | `5432:5432` |
| `jaegertracing` | Trace viewer | Jaeger | `16686:16686` |
| `zipkin-all-in-one` | Trace viewer (alt) | Zipkin | `9411:9411` |
| `otel-collector` | Trace/metric fan-out | OTel Collector Contrib | `4317`/`4318` (OTLP), `8888`/`8889` (metrics) |
| `prometheus` | Metrics UI | Prometheus | `9090:9090` |

## What Assessment 3 adds

- **`/dashboard`** — health status, total requests, unique clients, RSS feed counts, requests per
  feed, requests per client, and a per-feed status card (Healthy / Empty / Invalid data / Fetch
  failure). Server component, reads `/api/health` and the widened `/api/stats` with `cache:
  "no-store"` so it always shows current state.
- **Alert rules** (`api/app/api/stats/route.ts`) — each one an explicit, single-sentence rule, not a
  vibe: empty feed → warning; fetch failure (5xx) in the last 6 hours → error; invalid data (400) in
  the last 6 hours → warning; no requests at all in the last 30 minutes → idle notice. Surfaced as a
  dedicated Alerts section above the dashboard's stat tiles.
- **`RequestLog` widened** with `clientId` (caller's IP — there's no auth layer to key on instead),
  `feedId` (parsed from the request, not resolved from `?slug=`) and `outcome` (`ok`/`error`,
  derived once at write time). All three are populated inside the existing shared `record()` helper
  in `api/lib/api.ts` — no individual route handler changed. See `api/SCHEMA_RATIONALE.md` for the
  full justification.
- **Simulated data**: a deliberately empty feed (`community-digest`) and ~14 days of simulated
  `RequestLog` history across 5 synthetic clients, so per-day charts have real shape and the alert
  states are demonstrable on camera. Idempotent — re-running the seed replaces only the simulated
  rows (tagged `clientId` starting `seed-sim-`), never real traffic.
- **Testing evidence** — see `docs/load-testing/` and `docs/lighthouse/`, both with their own
  `SUMMARY.md` explaining what was found and, for Lighthouse, what changed because of it.
- **OpenTelemetry instrumentation** (`api/instrumentation.ts`, following Workshop 9) — every request
  to the `api` container is traced and exported to Jaeger and Zipkin, with metrics exported to
  Prometheus via the OTel Collector. This is deliberately separate from the `RequestLog`/dashboard
  metrics above: `RequestLog` answers "how many requests, per feed, per client" (aggregate counts
  for the operational dashboard); tracing answers "where did the time go *inside* one request"
  (per-request timelines). The load-testing writeup in `docs/load-testing/SUMMARY.md` uses real
  trace data from Jaeger to confirm — not just infer — where the JMeter-observed latency actually
  comes from.

  ```
  http://localhost:16686/   Jaeger UI — browse traces for the "rss-server-api" service
  http://localhost:9411/    Zipkin UI — same traces, alternate viewer
  http://localhost:9090/    Prometheus UI — query e.g. otelcol_exporter_sent_spans
  ```

## Running it

This stage runs locally via Docker, not on EC2 — Assessment 3's rubric has no cloud-deployment
criterion (unlike A2's), and JMeter's staged loads need consistent, repeatable conditions rather
than a shared Learner Lab instance. Cloud deployment returns as an explicit requirement in
Assessment 4.

```bash
docker-compose up -d --build
```

Then browse to `http://localhost/` for the UI (including `/dashboard`), `http://localhost/dashboard`
directly, and `http://localhost:4080/` for the API's own documentation page. `entrypoint.sh` waits
for Postgres, applies migrations, then seeds automatically — a fresh volume comes up already
populated, dashboard and alerts included.

Both containers run a production build (`next build` at image-build time, `next start` at
container start), not `npm run dev` — see `docs/load-testing/SUMMARY.md` for why this matters and
the before/after load-testing numbers. There's no bind mount into either container, so a code
change needs `docker-compose up -d --build` to take effect, not just a save — use
[Local development](#local-development) below for a live-reloading edit loop instead.

**Before recording the demo video**, re-run the seed so the alert states are freshly within their
time windows rather than relying on whatever was seeded hours or days earlier:

```bash
docker exec -e DATABASE_URL=postgresql://user:password@postgres:5432/mydb app-api-1 npx prisma db seed
```

(or, for local non-Docker development, `cd api && npx prisma db seed` — see below.)

## Local development

```bash
# database (Docker Desktop or a Postgres instance in WSL2 both work locally)
# DATABASE_URL in api/.env must point at it; see api/.env.example

cd api
npm install
npx prisma migrate deploy
npx prisma db seed
npm run dev                  # http://localhost:3000 (or PORT=4080 npm run start for a prod build)

cd ../frontend
npm install
npm run dev                  # http://localhost:3000 by default; set API_INTERNAL_URL if the
                              # api package above isn't on the default port
npm run lint
npm test                     # production build + Playwright suite (needs the api package running)
```

**Prisma 7 note:** the runtime client requires a driver adapter (`@prisma/adapter-pg`), and CLI
commands read `DATABASE_URL` from `prisma.config.ts`, not from an auto-loaded `.env`. Both are set
up already; see `api/SCHEMA_RATIONALE.md` for why.

## API endpoints

Every response uses the same envelope: `{ data, error }`, with `error: null` on success.

| Method | Path | Purpose |
|---|---|---|
| `GET` `POST` | `/api/feeds` | List / create feeds. `?id=`, `?withPosts=true` |
| `PATCH` `DELETE` | `/api/feeds?id=` | Update / delete one feed (delete cascades to its posts) |
| `GET` `POST` | `/api/posts` | List / create posts. `?id=`, `?slug=`, `?feedId=` |
| `PATCH` `DELETE` | `/api/posts?id=` | Update / delete one post |
| `GET` `POST` | `/api/authors` | List / create authors. `?id=` |
| `PATCH` `DELETE` | `/api/authors?id=` | Update / delete one author (fails if they still have posts) |
| `GET` | `/api/feeds/rss.xml?slug=` | A feed republished as real RSS 2.0 |
| `GET` | `/api/health` | Healthcheck — a real query against Postgres |
| `GET` | `/api/count` | Number of client requests served, read from `RequestLog` |
| `GET` | `/api/stats` | Content stats, usage stats (now incl. per-feed/per-client), feed status, alerts |

Full descriptions and runnable curl / PowerShell commands for every endpoint are on the API's own
root page (`http://localhost:4080/`) — it derives the correct base URL from the request itself.

## Testing

```bash
cd frontend && npx playwright test    # 18 tests — needs the api package running on :4080
```

- **`tests/feed-crud.spec.ts`** — the server use case: full create → read → update → delete
  lifecycle for a feed, plus 400/404 error paths. Request-level, matching the pattern
  `rss-client.spec.ts` already used for server-side checks.
- **`tests/rss-client.spec.ts`** — the client use case: the RSS Client page fetching and rendering
  real RSS 2.0 from the server, plus feed switching and a direct server health/RSS check.
- **`tests/smoke.spec.ts`** — inherited UI/theme/navigation coverage from A1/A2.

**Load testing:** `docs/load-testing/rss-server-load-test.jmx`, staged x1/x10/x100/x1000/x10000
against the Dockerised `api` service. Results and interpretation in
`docs/load-testing/SUMMARY.md` — the short version: clean up to x10, visible strain by x100, and
severe request queuing (not application errors — zero 5xx logged) by x1000+.

**Accessibility:** `docs/lighthouse/before-dashboard.json` / `after-dashboard.json`, with the
specific contrast fix explained in `docs/lighthouse/SUMMARY.md` — 96/100 → 100/100.

## Status

- [x] `/dashboard` — health, stat tiles, requests per feed/client, feed status, both themes
- [x] Alert rules for failed fetches, invalid data, empty feeds and idle, each a single sentence
- [x] `RequestLog` widened (`clientId`, `feedId`, `outcome`), populated in the existing shared
      logging helper, backfilled for pre-existing rows
- [x] Simulated data: empty feed + ~14 days of history + explicit edge cases
- [x] Playwright: server (feed CRUD) and client (RSS retrieval) use cases, 18/18 passing
- [x] JMeter staged load testing x1–x10000 against the Dockerised app, with interpretation
      confirmed by real Jaeger trace data, not just aggregate numbers
- [x] Lighthouse accessibility pass, fix applied and re-verified (96 → 100)
- [x] OpenTelemetry instrumentation (Workshop 9): traces in Jaeger/Zipkin, metrics in Prometheus
- [x] Feature branches, clean `main`, no `node_modules` committed
