import type { Metadata } from "next";
import Breadcrumbs from "@/components/Breadcrumbs";
import { getDashboardData, formatRelativeTime } from "@/lib/dashboard";
import styles from "./dashboard.module.css";

export const metadata: Metadata = {
  title: "Dashboard",
  description:
    "Operational metrics for the RSS Server: health, traffic and feed status.",
};

// A server component reading Prisma-backed aggregates through /api/stats and
// /api/health — see DEVELOPER_PRACTICES.md §2: every tile here answers a
// question a maintainer would actually ask (is it up? is traffic arriving?
// which feeds are active? are errors happening?).
export default async function DashboardPage() {
  const { health, stats } = await getDashboardData();

  return (
    <section>
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Dashboard" }]} />
      <h1>Dashboard</h1>
      <p className={styles.lede}>
        Live operational metrics for the RSS Server, read from the database
        on every request.
      </p>

      <div
        className={`${styles.healthBanner} ${
          health?.status === "ok" ? styles.healthOk : styles.healthDown
        }`}
        role="status"
      >
        <span className={styles.healthDot} aria-hidden="true" />
        {health === null && "Health check unreachable"}
        {health?.status === "ok" && (
          <>
            System healthy · database connected · {health.latencyMs}ms latency ·
            up {Math.floor(health.uptimeSeconds / 60)} min
          </>
        )}
        {health?.status === "degraded" && "System degraded · database unreachable"}
      </div>

      {stats === null ? (
        <p className={styles.empty}>Could not load statistics from the RSS Server.</p>
      ) : (
        <>
          <section aria-labelledby="alerts-heading" className={styles.alertsSection}>
            <h2 id="alerts-heading" className={styles.sectionHeading}>
              Alerts
            </h2>
            <p className={styles.caption}>
              Rule-based warnings, recomputed on every page load — not a log of everything that
              has ever gone wrong, only what&apos;s true right now.
            </p>
            {stats.alerts.length === 0 ? (
              <p className={styles.noAlerts}>No active alerts — every rule is passing.</p>
            ) : (
              <ul className={styles.alertList}>
                {stats.alerts.map((alert, index) => (
                  <li
                    key={`${alert.severity}-${index}`}
                    className={`${styles.alertItem} ${
                      alert.severity === "error"
                        ? styles.alertError
                        : alert.severity === "warning"
                          ? styles.alertWarning
                          : styles.alertInfo
                    }`}
                  >
                    {alert.message}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <ul className={styles.tileGrid}>
            <li className={styles.tile}>
              <span className={styles.tileValue}>{stats.usage.totalRequests}</span>
              <span className={styles.tileLabel}>Total requests</span>
            </li>
            <li className={styles.tile}>
              <span className={styles.tileValue}>{stats.usage.uniqueClients}</span>
              <span className={styles.tileLabel}>Unique clients</span>
            </li>
            <li className={styles.tile}>
              <span className={styles.tileValue}>{stats.content.feeds}</span>
              <span className={styles.tileLabel}>RSS feeds</span>
            </li>
            <li className={styles.tile}>
              <span className={styles.tileValue}>{stats.content.posts}</span>
              <span className={styles.tileLabel}>Posts</span>
            </li>
            <li className={styles.tile}>
              <span className={styles.tileValue}>
                {stats.usage.averageDurationMs !== null
                  ? `${Math.round(stats.usage.averageDurationMs)}ms`
                  : "—"}
              </span>
              <span className={styles.tileLabel}>Avg response time</span>
            </li>
          </ul>
          <p className={styles.caption}>
            All-time counts since the database was last seeded, not a live rate. Unique clients is
            IP-address-based, since there&apos;s no login system on this API.
          </p>

          <section aria-labelledby="requests-by-endpoint-heading">
            <h2 id="requests-by-endpoint-heading" className={styles.sectionHeading}>
              Requests by endpoint
            </h2>
            <p className={styles.caption}>
              Which API routes are actually getting hit, and how often — the same breakdown Jaeger
              and Zipkin show per individual request, aggregated here across all of them. Top 10.
            </p>
            <ul className={styles.barList}>
              {stats.usage.requestsByPath.map((row) => (
                <li key={row.path} className={styles.barRow}>
                  <span className={styles.barLabel}>{row.path}</span>
                  <span className={styles.barTrack}>
                    <span
                      className={styles.barFill}
                      style={{
                        width: `${maxScale(row.requests, stats.usage.requestsByPath)}%`,
                      }}
                    />
                  </span>
                  <span className={styles.barValue}>{row.requests}</span>
                </li>
              ))}
            </ul>
          </section>

          <div className={styles.columns}>
            <section aria-labelledby="requests-per-feed-heading">
              <h2 id="requests-per-feed-heading" className={styles.sectionHeading}>
                Requests per feed
              </h2>
              <p className={styles.caption}>
                How much total traffic each feed has generated — not when it happened, just how
                much.
              </p>
              <ul className={styles.barList}>
                {stats.usage.requestsPerFeed.map((row) => (
                  <li key={row.slug} className={styles.barRow}>
                    <span className={styles.barLabel}>{row.name}</span>
                    <span className={styles.barTrack}>
                      <span
                        className={styles.barFill}
                        style={{
                          width: `${maxScale(row.requests, stats.usage.requestsPerFeed)}%`,
                        }}
                      />
                    </span>
                    <span className={styles.barValue}>{row.requests}</span>
                  </li>
                ))}
              </ul>
            </section>

            <section aria-labelledby="requests-per-client-heading">
              <h2 id="requests-per-client-heading" className={styles.sectionHeading}>
                Requests per client
              </h2>
              <p className={styles.caption}>
                Same idea, grouped by requester instead of by feed — which clients are actually
                using the RSS server.
              </p>
              <ul className={styles.barList}>
                {stats.usage.requestsPerClient.map((row) => (
                  <li key={row.clientId} className={styles.barRow}>
                    <span className={styles.barLabel}>{row.clientId}</span>
                    <span className={styles.barTrack}>
                      <span
                        className={styles.barFill}
                        style={{
                          width: `${maxScale(row.requests, stats.usage.requestsPerClient)}%`,
                        }}
                      />
                    </span>
                    <span className={styles.barValue}>{row.requests}</span>
                  </li>
                ))}
                {stats.usage.requestsPerClient.length === 0 && (
                  <li className={styles.empty}>No client-identified traffic yet.</li>
                )}
              </ul>
            </section>
          </div>

          <section aria-labelledby="feed-status-heading">
            <h2 id="feed-status-heading" className={styles.sectionHeading}>
              Feed status
            </h2>
            <p className={styles.caption}>
              One card per feed, badge showing its most urgent current problem — fetch failure
              beats invalid data beats empty, since that&apos;s the order a maintainer would want
              to fix them in.
            </p>
            <ul className={styles.feedGrid}>
              {stats.feedStatus.map((feed) => (
                <li key={feed.slug} className={styles.feedCard}>
                  <div className={styles.feedCardHeader}>
                    <span className={styles.feedName}>{feed.name}</span>
                    <span
                      className={`${styles.badge} ${
                        feed.hasRecentFetchFailure
                          ? styles.badgeError
                          : feed.hasRecentInvalidData || feed.isEmpty
                            ? styles.badgeWarning
                            : styles.badgeOk
                      }`}
                    >
                      {feed.hasRecentFetchFailure
                        ? "Fetch failure"
                        : feed.hasRecentInvalidData
                          ? "Invalid data"
                          : feed.isEmpty
                            ? "Empty"
                            : "Healthy"}
                    </span>
                  </div>
                  <p className={styles.feedMeta}>
                    {feed.posts} {feed.posts === 1 ? "post" : "posts"}
                    {feed.lastRequestAt && (
                      <>
                        {" "}
                        · last request {formatRelativeTime(feed.lastRequestAt)}
                      </>
                    )}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </section>
  );
}

/** Bar width as a percentage of the largest value in the group, floored at 4% so a nonzero row is still visible. */
function maxScale(value: number, rows: { requests: number }[]): number {
  const max = Math.max(1, ...rows.map((r) => r.requests));
  return Math.max(4, Math.round((value / max) * 100));
}
