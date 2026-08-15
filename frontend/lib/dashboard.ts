// Types for the RSS Server's /api/stats and /api/health responses, and the
// fetch helpers the dashboard page uses. Kept separate from posts.ts since
// this is operational data, not content.

import { serverApiBaseUrl } from "./apiConfig";

export type HealthStatus = {
  status: "ok" | "degraded";
  database: "connected" | "unreachable";
  uptimeSeconds: number;
  latencyMs?: number;
  timestamp: string;
};

export type FeedStatus = {
  slug: string;
  name: string;
  posts: number;
  isEmpty: boolean;
  lastRequestAt: string | null;
  hasRecentFetchFailure: boolean;
  hasRecentInvalidData: boolean;
};

export type Alert = {
  severity: "error" | "warning" | "info";
  message: string;
};

export type Stats = {
  content: {
    feeds: number;
    authors: number;
    posts: number;
    citations: number;
    latestPost: { title: string; slug: string; publishedAt: string } | null;
    postsPerFeed: { slug: string; name: string; posts: number }[];
  };
  usage: {
    totalRequests: number;
    uniqueClients: number;
    requestsByPath: { path: string; requests: number }[];
    requestsPerFeed: { slug: string; name: string; requests: number }[];
    requestsPerClient: { clientId: string; requests: number }[];
    responsesByStatus: { status: number; count: number }[];
    averageDurationMs: number | null;
    slowestDurationMs: number | null;
  };
  feedStatus: FeedStatus[];
  alerts: Alert[];
};

/**
 * Both requests run with `cache: "no-store"` — this page exists to show
 * current operational state, so a cached snapshot would defeat the point.
 */
export async function getDashboardData(): Promise<{
  health: HealthStatus | null;
  stats: Stats | null;
}> {
  const base = serverApiBaseUrl();
  const [healthRes, statsRes] = await Promise.allSettled([
    fetch(`${base}/api/health`, { cache: "no-store" }),
    fetch(`${base}/api/stats`, { cache: "no-store" }),
  ]);

  const health =
    healthRes.status === "fulfilled" && healthRes.value.ok
      ? ((await healthRes.value.json()).data as HealthStatus)
      : null;
  const stats =
    statsRes.status === "fulfilled" && statsRes.value.ok
      ? ((await statsRes.value.json()).data as Stats)
      : null;

  return { health, stats };
}

/** "3 min ago" / "2 hours ago" / "5 days ago" — coarse is fine for a dashboard. */
export function formatRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}
