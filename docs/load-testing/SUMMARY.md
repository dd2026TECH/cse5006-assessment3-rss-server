# Load testing — staged results

**Tool:** Apache JMeter 5.6.3, non-GUI mode, against the Dockerised stack (`docker-compose up -d`)
run on this machine — see `rss-server-load-test.jmx`. **Target:** `app-api-1` on `localhost:4080`,
the same container the frontend and RSS Client talk to.

**What each virtual user does** (one pass, matching a real RSS client session): `GET /api/health` →
`GET /api/feeds` → `GET /api/posts` → `GET /api/feeds/rss.xml?slug=build-journal`. Ramp-up scales
with thread count so large stages don't launch every thread in the same instant.

## Results

| Stage | Threads | Ramp-up | Total requests | Errors | Error rate | Avg response | Max response |
|---|---|---|---|---|---|---|---|
| x1 | 1 | 1s | 4 | 0 | 0% | 67ms | 93ms |
| x10 | 10 | 1s | 40 | 0 | 0% | 403ms | 1,002ms |
| x100 | 100 | 2s | 400 | 5 | 1.25% | 3,209ms | 15,005ms |
| x1000 | 1,000 | 10s | 4,000 | 2,884 | 72.10% | 12,475ms | 15,058ms |
| x10000 | 10,000 | 60s | 40,000 | 39,342 | 98.36% | 9,916ms | 39,858ms |

Raw results: `results-x1.jtl` … `results-x10000.jtl` (JMeter's own CSV sample log — one row per
request, importable into JMeter's Aggregate Report / Summary Report GUI for the video).
`results-x10000.jtl` is downsampled to every 50th row (800 of the real 40,000) to stay under this
repo's file-size limit — the table above reports the true, full-run totals from JMeter's own
console summary, not numbers recomputed from the downsampled file.

## Interpretation

**The degradation is sharp, not gradual: it's fine at x10, visibly straining at x100, and in
serious trouble by x1000.** Latency roughly 6× between x10 and x100, then another 4× to x1000 —
this is not a linear slowdown, it's the system approaching a concurrency ceiling somewhere between
10 and 100 simultaneous clients.

**The "errors" are not application errors.** Every failed sample in every `.jtl` file records
`Non HTTP response code: java.net.SocketTimeoutException` / `Read timed out` — JMeter's client-side
15-second response timeout expiring, not the server returning a 4xx/5xx. Confirmed directly: `docker
logs app-api-1` shows **zero** 5xx responses logged across the entire test run, even during the
x10000 stage. The server never crashed and never rejected a request outright — it just couldn't
get through its queue fast enough, so requests piled up until the client gave up waiting.

**Likely cause: single-process, single-container serialisation, not the database.** The `api`
container runs one Next.js process; every request — even ones with no DB work like `/api/health` —
funnels through the same Node event loop and the same Prisma connection pool (Prisma's default pool
is small, sized off CPU count). At low concurrency that's invisible. Past roughly 100 concurrent
requests, they start queuing behind each other rather than executing in parallel, and the queue only
grows from there — consistent with `/api/health` (a single trivial query) being just as likely to
time out as the heavier routes once the queue is backed up, since queueing time dominates over
actual work time.

**What this motivates for Assessment 4's performance-improvements criterion:** this points at
concurrency handling rather than query optimisation — e.g. a larger/explicit Prisma connection pool
size, horizontal scaling (more `api` container replicas behind a load balancer), or a rate limit
that fails fast with a real 429 instead of letting requests queue silently until the client times
out. Re-running this same `.jmx` plan after such a change, at the x100/x1000 stages specifically
(where the ceiling first appears), is the natural before/after comparison.

## Reproducing

```bash
docker-compose up -d --build
cd docs/load-testing
jmeter -n -t rss-server-load-test.jmx -Jusers=100 -Jrampup=2 -l results-x100.jtl
```

`users` and `rampup` are JMeter properties (`-J`), so the same `.jmx` file drives every stage.
