import type { Metadata } from "next";
import Link from "next/link";
import { getAssessment } from "@/lib/assessments";
import styles from "./assessment-3.module.css";

const assessment = getAssessment("assessment-3")!;

export const metadata: Metadata = {
  title: `Assessment ${assessment.number}`,
  description: assessment.summary,
};

export default function Assessment3Page() {
  return (
    <article className={styles.page}>
      <div className={styles.header}>
        <h1>
          Assessment {assessment.number} — {assessment.title}
        </h1>
      </div>
      <p className={styles.weight}>
        {assessment.weight} of the overall grade ·{" "}
        <span className={styles.status}>{assessment.status}</span>
      </p>

      <p className={styles.summary}>
        <strong>What this assessment is about, in one paragraph:</strong> Assessment 3 is the
        point where the RSS Server stops being code that only works when someone happens to be
        looking at it, and becomes a system that can show its own working — a dashboard reporting
        real usage instead of running silently, alert rules that catch problems without a human
        watching for them, and hard evidence, not just assertions, that each of those claims is
        actually true. The evidence comes from four different tools deliberately covering
        different failure modes: Playwright (does the software do what it's supposed to?),
        JMeter (does it keep doing that under load?), Lighthouse (can everyone actually use it?),
        and OpenTelemetry (when something goes wrong, can you see where?).
      </p>

      <section aria-labelledby="what-heading" className={styles.section}>
        <h2 id="what-heading">What this part adds</h2>
        <ul className={styles.builtList}>
          {assessment.adds.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <p>
          Full details, including the actual test results, live in the repo:{" "}
          <code>docs/load-testing/SUMMARY.md</code> and <code>docs/lighthouse/SUMMARY.md</code>,
          plus <code>api/SCHEMA_RATIONALE.md</code> for the database changes.
        </p>
      </section>

      <section aria-labelledby="labs-heading" className={styles.section}>
        <h2 id="labs-heading">How this maps to Workshop 8 and Workshop 9</h2>
        <p>
          The brief names these two labs as the relevant technique for this stage. The approach
          below follows them directly rather than substituting an equivalent custom build — the
          table is an honest account of where the code matches the lab step for step, and the one
          place it deliberately doesn&apos;t, with the reason why.
        </p>
        <div className={styles.tableWrap}>
          <table className={styles.compareTable}>
            <thead>
              <tr>
                <th>Lab</th>
                <th>What it teaches</th>
                <th>What this project does</th>
                <th>Why</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Workshop 8, Part 1 (Dynamic Blog / Playwright)</td>
                <td>
                  <code>npm init playwright@latest</code>; a spec using{" "}
                  <code>test.describe</code> and all four lifecycle hooks; a UI-driven test that
                  fills a form by placeholder, clicks submit, and asserts the new item renders.
                </td>
                <td>
                  Playwright already present from A1/A2. <code>feed-crud.spec.ts</code> drives the
                  full create/read/update/delete cycle at the request level rather than through a
                  form.
                </td>
                <td>
                  The RSS Server has no dedicated &quot;Createblog&quot;-style page for feeds — new
                  feeds are created inline through the post form. An API-level test proves the same
                  server behaviour without being tied to that UI&apos;s exact shape.{" "}
                  <code>rss-client.spec.ts</code>&apos;s client-use-case test *is* UI-driven,
                  matching the lab&apos;s pattern where a form actually exists.
                </td>
              </tr>
              <tr>
                <td>Workshop 8, Part 2 (JMeter)</td>
                <td>
                  Build a Test Plan in JMeter&apos;s GUI (File → New), add a Thread Group and HTTP
                  Request sampler, add View Results Tree / Summary Report / Graph Results
                  listeners, run with the green button — &quot;keep it under 30 users.&quot;
                </td>
                <td>
                  Same tool, same sampler concept, but the <code>.jmx</code> was authored directly
                  and run in non-GUI (CLI) mode for the x100/x1000/x10000 stages.
                </td>
                <td>
                  This assessment&apos;s brief explicitly requires stages up to x10000 — 300× past
                  the lab&apos;s 30-user guidance. JMeter&apos;s own documentation recommends
                  non-GUI mode for real load generation; 10,000 threads in the interactive GUI
                  would likely have crashed it. The video still opens the GUI for the x100 stage so
                  the visual matches what the lab taught.
                </td>
              </tr>
              <tr>
                <td>Workshop 9 (OpenTelemetry instrumentation)</td>
                <td>
                  Jaeger + Zipkin + an OTel Collector + Prometheus, wired up via{" "}
                  <code>docker-compose</code>; <code>@vercel/otel</code> registered in{" "}
                  <code>instrumentation.ts</code>; traces viewed in Jaeger, metrics in Prometheus.
                </td>
                <td>
                  Implemented directly — <code>otel-collector-config.yaml</code> and{" "}
                  <code>prometheus.yaml</code> are the lab&apos;s own config files, effectively
                  unchanged.
                </td>
                <td>
                  One deliberate deviation: the collector image is{" "}
                  <code>opentelemetry-collector-contrib</code>, not the lab&apos;s core image —
                  the lab&apos;s own config references Zipkin and Jaeger exporters that only ship
                  in the contrib distribution, so the core image can&apos;t actually run it.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="controls-heading" className={styles.section}>
        <h2 id="controls-heading">What controls this covers, and how</h2>
        <p>
          &quot;Does it work&quot; splits into several different questions, and one tool rarely
          answers more than one of them. Each control below exists to catch a specific failure
          mode the others can&apos;t:
        </p>
        <ul className={styles.controlsList}>
          <li className={styles.controlItem}>
            <span className={styles.controlName}>Correctness — Playwright (18 specs)</span>
            <p>
              Catches functional regressions in the server and client use cases before they&apos;re
              merged, not after. Deterministic: seeded data, no arbitrary waits.
            </p>
          </li>
          <li className={styles.controlItem}>
            <span className={styles.controlName}>Capacity — JMeter staged load testing</span>
            <p>
              Quantifies the actual concurrency ceiling (roughly 100 simultaneous users) instead of
              assuming the app scales because it works for one person.
            </p>
          </li>
          <li className={styles.controlItem}>
            <span className={styles.controlName}>Diagnosis — OpenTelemetry tracing</span>
            <p>
              When the JMeter numbers alone weren&apos;t enough to explain *where* the load-testing
              bottleneck was, real Jaeger traces confirmed it — and overturned the first guess
              (a database connection-pool limit) in favour of a more specific, testable one
              (request queuing ahead of the traced code, consistent with dev-mode rather than a
              production build).
            </p>
          </li>
          <li className={styles.controlItem}>
            <span className={styles.controlName}>Accessibility — Lighthouse</span>
            <p>
              Caught three real WCAG contrast failures (as low as 2.8:1 against a 4.5:1 minimum)
              that were invisible just by looking at the screen. Fixed and re-verified: 96 → 100.
            </p>
          </li>
          <li className={styles.controlItem}>
            <span className={styles.controlName}>
              Operational visibility — the dashboard&apos;s alert rules
            </span>
            <p>
              Surfaces failed fetches, invalid data and empty feeds on the page itself, so a
              problem doesn&apos;t require someone to already suspect it and go check logs.
            </p>
          </li>
          <li className={styles.controlItem}>
            <span className={styles.controlName}>Process — one feature branch per concern</span>
            <p>
              Metrics, dashboard, alerts, tests, load testing and instrumentation each landed as
              their own branch with history preserved, so any one change can be reviewed or
              reverted independently of the others.
            </p>
          </li>
        </ul>
      </section>

      <nav className={styles.links} aria-label="Related pages">
        <Link href="/dashboard">See the dashboard</Link>
        <Link href="/assessment-2">Assessment 2</Link>
        <Link href="/feeds">Browse the Feeds library</Link>
      </nav>
    </article>
  );
}
