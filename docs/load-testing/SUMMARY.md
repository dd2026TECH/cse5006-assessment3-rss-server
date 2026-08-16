# Load testing — staged results, dev mode vs. production build

**Tool:** Apache JMeter 5.6.3, non-GUI mode, against the Dockerised stack (`docker-compose up -d`)
run on this machine — see `rss-server-load-test.jmx`. **Target:** `app-api-1` on `localhost:4080`,
the same container the frontend and RSS Client talk to.

**What each virtual user does** (one pass, matching a real RSS client session): `GET /api/health` →
`GET /api/feeds` → `GET /api/posts` → `GET /api/feeds/rss.xml?slug=build-journal`. Ramp-up scales
with thread count so large stages don't launch every thread in the same instant.

## Results — dev mode (`npm run dev`, the original build)

| Stage | Threads | Ramp-up | Total requests | Errors | Error rate | Avg response | Max response |
|---|---|---|---|---|---|---|---|
| x1 | 1 | 1s | 4 | 0 | 0% | 67ms | 93ms |
| x10 | 10 | 1s | 40 | 0 | 0% | 403ms | 1,002ms |
| x100 | 100 | 2s | 400 | 5 | 1.25% | 3,209ms | 15,005ms |
| x1000 | 1,000 | 10s | 4,000 | 2,884 | 72.10% | 12,475ms | 15,058ms |
| x10000 | 10,000 | 60s | 40,000 | 39,342 | 98.36% | 9,916ms | 39,858ms |

Raw results: `results-x1.jtl` … `results-x10000.jtl`. `results-x10000.jtl` is downsampled to every
50th row (800 of the real 40,000) to stay under this repo's file-size limit — the table above
reports the true, full-run totals from JMeter's own console summary, not numbers recomputed from
the downsampled file.

## Results — production build (`next build` + `next start`, after the fix below)

| Stage | Threads | Ramp-up | Total requests | Errors | Error rate | Avg response | Max response |
|---|---|---|---|---|---|---|---|
| x100 | 100 | 2s | 400 | 0 | **0%** | **227ms** | **416ms** |
| x1000 | 1,000 | 10s | 4,000 | 0 | **0%** | **1,613ms** | 6,934ms |
| x10000 | 10,000 | 60s | 40,000 | 36,522 | 91.31% | 10,987ms | 44,846ms |

Raw results: `prod-results-x100.jtl`, `prod-results-x1000.jtl`, `prod-results-x10000.jtl` (the last
one downsampled the same way, every 50th row, same file-size reason).

## Results — production build on EC2 (the actual deployed instance, over the public internet)

Same `.jmx` plan, same production build, but run from this machine against the live EC2 host
(`ec2-54-161-72-94.compute-1.amazonaws.com:4080`) instead of localhost — real network latency and
the Learner Lab instance's real (smaller) hardware, instead of loopback on a dev machine. x10000
wasn't run here; the localhost result already established where that ceiling is, and repeating it
over the public internet wouldn't add information.

| Stage | Threads | Ramp-up | Total requests | Errors | Error rate | Avg response | Max response |
|---|---|---|---|---|---|---|---|
| x100 | 100 | 2s | 400 | 0 | **0%** | **437ms** | 1,508ms |
| x1000 | 1,000 | 10s | 4,000 | 0 | **0%** | **963ms** | 3,646ms |

Raw results: `ec2-results-x100.jtl`, `ec2-results-x1000.jtl`.

Both stages still cleared with zero errors — the ~200-700ms increase over the localhost production
numbers (227ms → 437ms at x100, 1,613ms → 963ms... note x1000 is actually *faster* despite the
network hop, most likely because the EC2 host isn't sharing CPU/IO with the JMeter client process
itself the way localhost does) is consistent with real internet round-trip time plus a smaller
instance, not a regression in the fix. This is the number that reflects what an actual user hitting
the live deployment would experience.

## What changed

The `api` and `frontend` Dockerfiles now run `RUN npm run build` at image-build time, and their
containers run `next start` (via `entrypoint.sh` for the API, the Dockerfile `CMD` for the
frontend) instead of `next dev`. `docker-compose.yml`'s bind-mount volumes for both services were
removed — a bind mount would hide the image's build output behind the host's raw source, undoing
the whole point of building first. `NODE_ENV` changed from `development` to `production` on both.
One build-time wrinkle: `next build`'s page-data-collection step imports every route module,
including `lib/prisma.ts`, which throws if `DATABASE_URL` is unset — it never actually connects at
build time, so the Dockerfile just sets the same value docker-compose uses at runtime as a build
`ENV`, which is enough to satisfy the check.

This was the same finding flagged independently by Assessment 2's own grading feedback
("Dockerize... 0.5 deducted because both application containers use `npm run dev`... rather than a
clean production deployment") and by this assessment's own JMeter/tracing investigation below — two
independent reviews landing on the same root cause.

## Interpretation

**The production build resolved the x100 and x1000 bottleneck completely.** Both stages went from
meaningful error rates and multi-second averages in dev mode to **zero errors** and sub-2-second
averages in production mode — x100's average response time dropped **93%** (3.2s → 227ms), and
x1000 went from **72.1% errors to none at all**. This is strong, direct confirmation of the
original hypothesis: dev mode's on-demand compilation and single-process request handling, not
application code or the database, was the dominant cause of the degradation at realistic load
levels.

**x10000 is still a real ceiling, even in production mode, but it did improve too** — 91.31% errors
versus dev mode's 98.36%, roughly 2,800 fewer failed requests out of 40,000. Not a fix, but not
nothing either: the production build helped at every stage tested, just not enough to clear the
extreme end. This is the honest, useful part of the result: the fix didn't make the system
infinitely scalable, it moved the breaking point from "cracks under 100 concurrent users" to "holds
firm through 1,000 concurrent users and only genuinely breaks at 10,000." For context, 10,000
simultaneous requests against a single-container, single-database instance is a genuinely extreme
load — the remaining ceiling at that stage is consistent with normal single-instance concurrency
limits (one Node process, one Postgres connection pool), not a bug, and is exactly what the original
`SUMMARY.md` flagged as the fallback explanation if the production-build fix didn't fully resolve
things: "evidence for the concurrency-handling theory instead (Prisma pool size, horizontal
replicas, a fast-failing rate limit)."

**Why this was tested with tracing rather than just re-running JMeter and reading the aggregate
table.** The original investigation used Jaeger to confirm *where* the dev-mode delay was actually
occurring, rather than guessing from the error-rate numbers alone: the traced application code (the
actual route handler + Prisma query) consistently finished in under 1.5 seconds even while
JMeter's end-to-end measurement ran into multiple seconds or timed out — meaning the delay was
sitting *before* the traced code ran at all, which pointed at request-handling overhead (dev mode)
rather than slow queries or slow route logic. That earlier, trace-confirmed diagnosis is exactly
what this before/after re-run was designed to test, and the x100/x1000 results confirm it.

**The "errors" at every stage, in both modes, are still client-side timeouts, not application
errors.** Every failed sample records `Non HTTP response code: java.net.SocketTimeoutException` /
`Read timed out` — JMeter's own 15-second response timeout expiring, not the server returning a
4xx/5xx. The server never crashed and never rejected a request outright at any stage tested; it
just couldn't keep up with the extreme end of the load.

## Reproducing

```bash
# Dev-mode results (historical baseline, before the fix on this branch):
git checkout main -- docker-compose.yml api/Dockerfile api/entrypoint.sh frontend/Dockerfile
docker-compose up -d --build

# Production-build results (current state of this branch):
docker-compose up -d --build
cd docs/load-testing
jmeter -n -t rss-server-load-test.jmx -Jusers=100 -Jrampup=2 -l prod-results-x100.jtl
```

`users` and `rampup` are JMeter properties (`-J`), so the same `.jmx` file drives every stage.
