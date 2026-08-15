// OpenTelemetry registration, per Workshop 9 and Next.js's own instrumentation
// convention (node_modules/next/dist/docs/.../instrumentation.md). Exports
// real request traces to the otel-collector service (docker-compose), which
// fans them out to Jaeger and Zipkin, and metrics to Prometheus.
//
// This runs alongside the RequestLog-based dashboard, not instead of it — the
// two answer different questions. RequestLog is aggregate counts (how many
// requests, per feed, per client, ok vs error) for the operational dashboard
// the brief asks for. Traces are per-request timelines (where did the time
// inside *this* request actually go) — the evidence needed to confirm, rather
// than guess at, the JMeter load-testing bottleneck.
//
// OTEL_EXPORTER_OTLP_ENDPOINT (set in docker-compose.yml) points @vercel/otel
// at the collector; locally without it, spans are simply not exported.
import { registerOTel } from "@vercel/otel";

export function register() {
  registerOTel("rss-server-api");
}
