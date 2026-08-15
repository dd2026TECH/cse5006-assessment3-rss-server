// Seeds the database with Assessment 1's real published content — the same 11
// posts the site already shows, across the two feeds they were written for.
// Using the real content (rather than lorem ipsum) means the Assessment 2
// frontend renders exactly what Assessment 1 did once it reads from the API,
// which is what makes the migration verifiable.
//
// Idempotent: re-running upserts rather than duplicating, so it is safe to run
// on every container start.
// Prisma 7 no longer auto-loads .env, and tsx does not either — so the seed
// loads it explicitly. In Docker this is a no-op: compose supplies DATABASE_URL
// directly and there is no .env file in the image.
import "dotenv/config";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../app/generated/prisma/client";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set — cannot seed.");
}
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

type SeedPost = {
  slug: string;
  title: string;
  summary: string;
  body: string[];
  imageUrl: string;
  imageAlt: string;
  category: string;
  publishedAt: string;
  author: string;
  feed: string;
  citations: { text: string; href: string }[];
};

const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

const FEED_DESCRIPTIONS: Record<string, string> = {
  "Build Journal":
    "Reflections written while building the app — what was new, what was difficult, and why each decision was made.",
  "Research Notes":
    "Posts where a real source was read and then tied back to a concrete decision in this codebase.",
};

async function main() {
  const posts: SeedPost[] = JSON.parse(
    readFileSync(join(__dirname, "seed-data.json"), "utf8"),
  );

  for (const authorName of new Set(posts.map((p) => p.author))) {
    await prisma.author.upsert({
      where: { name: authorName },
      update: {},
      create: { name: authorName },
    });
  }

  for (const feedName of new Set(posts.map((p) => p.feed))) {
    await prisma.feed.upsert({
      where: { slug: slugify(feedName) },
      update: { name: feedName },
      create: {
        slug: slugify(feedName),
        name: feedName,
        description: FEED_DESCRIPTIONS[feedName] ?? null,
        // Authored in-house rather than ingested, so there is no source URL.
        url: null,
      },
    });
  }

  for (const post of posts) {
    const feed = await prisma.feed.findUniqueOrThrow({
      where: { slug: slugify(post.feed) },
    });
    const author = await prisma.author.findUniqueOrThrow({
      where: { name: post.author },
    });

    const saved = await prisma.post.upsert({
      where: { slug: post.slug },
      update: {
        title: post.title,
        summary: post.summary,
        body: post.body,
        imageUrl: post.imageUrl,
        imageAlt: post.imageAlt,
        category: post.category,
        publishedAt: new Date(post.publishedAt),
        feedId: feed.id,
        authorId: author.id,
      },
      create: {
        slug: post.slug,
        title: post.title,
        summary: post.summary,
        body: post.body,
        imageUrl: post.imageUrl,
        imageAlt: post.imageAlt,
        category: post.category,
        publishedAt: new Date(post.publishedAt),
        feedId: feed.id,
        authorId: author.id,
      },
    });

    // Citations have no natural key, so replace them wholesale rather than
    // trying to match rows — cheap at this size and keeps the seed idempotent.
    await prisma.citation.deleteMany({ where: { postId: saved.id } });
    if (post.citations.length > 0) {
      await prisma.citation.createMany({
        data: post.citations.map((c) => ({
          text: c.text,
          href: c.href,
          postId: saved.id,
        })),
      });
    }
  }

  // --- Assessment 3: an empty feed, and simulated request history ---
  //
  // The brief asks for edge cases in the seed (an empty feed, a failed-fetch
  // record, an invalid item) so the dashboard's alert states are demonstrable
  // on camera, and for metrics spread across a realistic time range rather
  // than all "now". See DEVELOPER_PRACTICES.md §5.
  const emptyFeed = await prisma.feed.upsert({
    where: { slug: "community-digest" },
    update: { name: "Community Digest" },
    create: {
      slug: "community-digest",
      name: "Community Digest",
      description:
        "Reserved for community-submitted posts — none yet, so the dashboard's empty-feed alert has something real to show.",
      url: null,
    },
  });

  // Simulated rows are idempotent by convention: every one carries a
  // "seed-sim-" clientId, so re-running the seed replaces them wholesale
  // without touching RequestLog rows created by real requests.
  await prisma.requestLog.deleteMany({ where: { clientId: { startsWith: "seed-sim-" } } });

  const allFeeds = await prisma.feed.findMany();
  const buildJournal = allFeeds.find((f) => f.slug === "build-journal");
  const researchNotes = allFeeds.find((f) => f.slug === "research-notes");
  const SIM_CLIENTS = [
    "seed-sim-client-1",
    "seed-sim-client-2",
    "seed-sim-client-3",
    "seed-sim-client-4",
    "seed-sim-client-5",
  ];
  const SIM_ROUTES: { path: string; method: string; feedId: number | null }[] = [
    { path: "/api/posts", method: "GET", feedId: null },
    { path: "/api/posts", method: "GET", feedId: buildJournal?.id ?? null },
    { path: "/api/posts", method: "GET", feedId: researchNotes?.id ?? null },
    { path: "/api/feeds", method: "GET", feedId: null },
    { path: "/api/feeds/rss.xml", method: "GET", feedId: buildJournal?.id ?? null },
    { path: "/api/feeds/rss.xml", method: "GET", feedId: researchNotes?.id ?? null },
  ];

  type SimRow = {
    method: string;
    path: string;
    status: number;
    durationMs: number;
    clientId: string;
    feedId: number | null;
    outcome: string;
    createdAt: Date;
  };

  const now = Date.now();
  const DAY_MS = 24 * 60 * 60 * 1000;
  const simRows: SimRow[] = [];

  // 14 days of history with a gently rising trend, so day-over-day charts
  // have real shape instead of a flat line.
  for (let daysAgo = 13; daysAgo >= 0; daysAgo--) {
    const requestsToday = 15 + Math.round(Math.random() * 25) + (13 - daysAgo);
    for (let i = 0; i < requestsToday; i++) {
      const route = SIM_ROUTES[Math.floor(Math.random() * SIM_ROUTES.length)];
      const client = SIM_CLIENTS[Math.floor(Math.random() * SIM_CLIENTS.length)];
      const isError = Math.random() < 0.04; // background noise, distinct from the edge cases below
      simRows.push({
        method: route.method,
        path: route.path,
        status: isError ? 500 : 200,
        durationMs: 20 + Math.round(Math.random() * 180),
        clientId: client,
        feedId: route.feedId,
        outcome: isError ? "error" : "ok",
        createdAt: new Date(now - daysAgo * DAY_MS - Math.random() * DAY_MS),
      });
    }
  }

  // Edge case: a recent failed fetch against the empty feed's RSS output —
  // what the "fetch failure in the last N minutes" alert rule reads.
  simRows.push({
    method: "GET",
    path: "/api/feeds/rss.xml",
    status: 500,
    durationMs: 340,
    clientId: "seed-sim-client-1",
    feedId: emptyFeed.id,
    outcome: "error",
    createdAt: new Date(now - 4 * 60 * 1000),
  });

  // Edge case: a recent invalid submission — the "invalid data" indicator.
  simRows.push({
    method: "POST",
    path: "/api/posts",
    status: 400,
    durationMs: 12,
    clientId: "seed-sim-client-2",
    feedId: buildJournal?.id ?? null,
    outcome: "error",
    createdAt: new Date(now - 7 * 60 * 1000),
  });

  await prisma.requestLog.createMany({ data: simRows });

  const [feeds, authors, postCount, citations, requestLogCount] = await Promise.all([
    prisma.feed.count(),
    prisma.author.count(),
    prisma.post.count(),
    prisma.citation.count(),
    prisma.requestLog.count(),
  ]);
  // Written to the stream directly rather than via console: this is a CLI
  // script whose output is the point, not leftover debug logging.
  process.stdout.write(
    `seeded: ${feeds} feeds, ${authors} authors, ${postCount} posts, ${citations} citations, ` +
      `${requestLogCount} request log rows (${simRows.length} simulated)\n`,
  );
}

main()
  .catch((error: unknown) => {
    process.stderr.write(
      `${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`,
    );
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
