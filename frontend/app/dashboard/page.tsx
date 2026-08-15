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

          <div className={styles.columns}>
            <section aria-labelledby="requests-per-feed-heading">
              <h2 id="requests-per-feed-heading" className={styles.sectionHeading}>
                Requests per feed
              </h2>
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
            <ul className={styles.feedGrid}>
              {stats.feedStatus.map((feed) => (
                <li key={feed.slug} className={styles.feedCard}>
                  <div className={styles.feedCardHeader}>
                    <span className={styles.feedName}>{feed.name}</span>
                    <span
                      className={`${styles.badge} ${
                        feed.hasRecentError
                          ? styles.badgeError
                          : feed.isEmpty
                            ? styles.badgeWarning
                            : styles.badgeOk
                      }`}
                    >
                      {feed.hasRecentError ? "Error" : feed.isEmpty ? "Empty" : "Healthy"}
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
