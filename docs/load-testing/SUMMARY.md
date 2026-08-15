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

**Confirmed with OpenTelemetry tracing, not just inferred from aggregate numbers.** Workshop 9's
observability stack (Jaeger, Zipkin, Prometheus, via `api/instrumentation.ts` and `@vercel/otel`) is
wired into the same `api` container, so every request during a load test gets a real trace. Re-ran
the x100 stage with tracing live and inspected the slowest `/api/health` traces in Jaeger
(`http://localhost:16686`): even the slowest one measured **~1.5 seconds of actual traced work**
(`resolve page components` + `executing api route` + `start response`) — while JMeter measured
requests in the *same run* taking up to 15 seconds end to end, with an average around 3.9 seconds.

That gap — traced application code finishing in ~1.5s while the client-observed response time was
2–10× longer — rules out slow queries or slow route-handler logic as the cause (a slow query would
show up *inside* the trace). **The delay is happening before the request reaches the traced code
path at all.** The most likely explanation: this `docker-compose` setup runs the `api` container
with `npm run dev` (development mode), not a production build — Next.js dev mode does on-demand
compilation and single-process request handling that a production `next build && next start` does
not, and that queuing would sit entirely outside what request-level tracing captures.

**Original hypothesis (Prisma connection pool exhaustion) was reasonable from the aggregate numbers
alone, but the trace evidence points somewhere else — a case for tracing over guessing.** `/api/health`
runs a single trivial query and still degraded identically to the DB-heavier routes, which is more
consistent with "every request queues behind the same bottleneck regardless of what it does" than
with a connection-pool-specific limit.

**What this motivates for Assessment 4's performance-improvements criterion:** re-run this same load
test against a **production build** (`next build && next start`) instead of dev mode first — if the
ceiling moves substantially, dev-mode overhead was the dominant factor, not application code. If it
doesn't move much, that's evidence for the concurrency-handling theory instead (Prisma pool size,
horizontal replicas, a fast-failing rate limit). Either way, the before/after JMeter comparison
should be paired with the same Jaeger trace inspection done here, not just the aggregate table.

## Reproducing

```bash
docker-compose up -d --build
cd docs/load-testing
jmeter -n -t rss-server-load-test.jmx -Jusers=100 -Jrampup=2 -l results-x100.jtl
```

`users` and `rampup` are JMeter properties (`-J`), so the same `.jmx` file drives every stage.
