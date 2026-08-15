# Schema rationale

Why each model and relation exists. The A-band descriptor for the 7-mark schema criterion asks for
models and relationships that are *"sensible and easy to justify"* — this is the justification, and
it is also the script for that part of the video and the Assessment 4 verbal.

## What the brief asks for

> "Create a database schema that represents **RSS feeds**, **who posted them**, **dates**, **blog
> data**, **images and links**, and any other core fields needed for the project." — Details PDF, #1

Each of those maps to something concrete:

| Brief phrase | Where it lives |
|---|---|
| RSS feeds | `Feed` |
| who posted them | `Author` |
| dates | `Post.publishedAt` (plus `createdAt`/`updatedAt` everywhere) |
| blog data | `Post.title`, `summary`, `body`, `category` |
| images | `Post.imageUrl`, `Post.imageAlt` |
| links | `Post.link`, `Citation.href` |
| "other core fields needed" | `Citation`, `RequestLog` |

## The models

**`Feed`** — an RSS source. Assessment 1's content came from two feeds, "Build Journal" and
"Research Notes", so those are the seeded rows. `url` is **nullable on purpose**: those two are
authored in-house and have no upstream feed to fetch, whereas a genuinely external source would
carry one. That nullability is the distinction between a feed the server *publishes* and one it
*ingests*.

**`Author`** — kept separate from `Feed` rather than as a string on `Post`, because the brief names
"who posted them" as its own concept, and because one person can publish to several feeds. `name` is
unique so the seed can upsert idempotently.

**`Post`** — one article. Two field choices worth defending:

- `body` is `String[]`, not a single blob. Assessment 1 already stores paragraphs as an array and
  Postgres supports arrays natively, so there is no join table and nothing to re-split on read. This
  is a place where choosing Postgres (Lab 7b) over SQLite (Lab 7a) buys something real.
- `publishedAt` is distinct from `createdAt`. The date the article was published is content; the
  date the row was inserted is bookkeeping. Conflating them would break ordering as soon as anything
  is re-imported.

Deleting a `Feed` cascades to its posts (`onDelete: Cascade`) — a feed's articles have no meaning
without it. Deleting an `Author` does **not** cascade; that would silently destroy content, so it is
left to fail loudly against the foreign key instead.

**`Citation`** — 7 of the 11 seeded posts cite real sources inline. A related table rather than a
JSON column keeps them queryable ("which sources does this project actually cite?"), which is
exactly the kind of question Assessment 3's reporting will ask.

**`RequestLog`** — persisted request history, written by the API routes. It exists because:

- Instruction #4 asks for `/count` — "number of client requests". Held in memory that resets on every
  container restart, which is not a count of anything meaningful.
- Instruction #9 asks for "a backend architecture that can support later dashboard, alert and
  reporting features in Assessment 3". This table is that foundation: it is what a dashboard reads
  and what an alert rule fires on. `durationMs` is nullable so latency reporting has somewhere to go
  in A3 without a migration.

## Assessment 3 additions

`RequestLog` gained three columns rather than a new table, because every one of them is a property
of a request that was already being logged — adding a table would have meant joining back to
`RequestLog` on every dashboard query for no benefit.

- **`clientId`** — the brief asks for "unique client counts" and "requests per client", but this API
  has no authentication layer (out of scope for the brief), so there is no user id to key on. The
  caller's IP address (`x-forwarded-for`, falling back to the direct socket address) is the closest
  stable identity available. It is intentionally coarse: two people behind the same NAT would count
  as one client. Good enough for an operational dashboard; not a claim of precise user tracking.
- **`feedId`** — nullable, because not every request is about a specific feed (`/api/health`,
  `/api/authors`). Read from whichever query parameter the route already uses (`?feedId=` on
  `/api/posts`, `?id=` on `/api/feeds`) rather than resolved from `?slug=`, which would cost a DB
  lookup on every single request just to populate a metrics column.
- **`outcome`** — derived once from `status` at write time (`< 400` → `"ok"`) instead of re-deriving
  it from a status range on every dashboard read. A denormalisation, but a cheap and obviously
  correct one: it can never disagree with `status` because it is computed from it at the same instant.

All three are populated inside the existing shared `record()` helper in `lib/api.ts`, not in
individual route handlers — the same "instrument once, at the boundary" reasoning `RequestLog`
itself was built on for A2. No route file changed to pick up the new columns.

**`Feed.community-digest`** — a seeded feed with zero posts. Not a schema change, a seed-data
decision: the brief's A-band descriptor for observability wants an empty-feed warning demonstrable
on camera, and a feed that has structurally never had any posts is a more honest way to produce that
state than deleting posts from a real feed at record time.

Existing rows from Assessment 2 needed a backfill migration for the new `outcome` column (`NOT NULL`
with no default, added after existing data existed) — see
`prisma/migrations/20260815010738_request_log_metrics_fields/`, which adds the columns nullable,
backfills `outcome` from `status`, then applies the `NOT NULL` constraint in that order.

## Deviations from the lab, and why

- **Prisma 7 requires a driver adapter.** The lab's `new PrismaClient()` no longer compiles; the
  generated client's own docs specify `new PrismaClient({ adapter: new PrismaPg({ connectionString }) })`.
  `lib/prisma.ts` follows that, with `@prisma/adapter-pg`.
- **`prisma.config.ts`** is new in Prisma 7 and holds the CLI's datasource URL, because Prisma 7 no
  longer auto-loads `.env` for CLI commands (hence the `dotenv` devDependency). `schema.prisma` still
  declares `url = env("DATABASE_URL")` for the runtime client, exactly as the lab does.
- **Generated client output** is `app/generated/prisma` (Prisma's own default here) and is gitignored;
  the Dockerfile regenerates it at build time.

## Verification status

Verified against a **real PostgreSQL 18** instance (installed in WSL2 for local development):

- `prisma validate`, `prisma generate`, `tsc --noEmit`, `eslint`, `next build` — all clean
- `prisma migrate dev --name init` — migration generated and applied, database in sync
- `npm run db:seed` — **2 feeds, 1 author, 11 posts, 10 citations**
- A relational query (`feed → posts ordered by publishedAt desc → author + citations`) returns:
  `build-journal` with 6 posts and `research-notes` with 5, correct ordering, author joined,
  `body` arrays preserved with their original paragraph counts, and images intact

That last check is the one that matters: it proves the ORM, the relations, the array column and
Assessment 1's real content all survive the round trip.

### Prisma 7 gotchas hit along the way

Recorded so they are not rediscovered on EC2:

1. `new PrismaClient()` with no arguments **does not compile** — Prisma 7 requires a driver adapter.
2. `url = env("DATABASE_URL")` in `schema.prisma` is a **hard error** in Prisma 7 (P1012): "the
   datasource property `url` is no longer supported in schema files." It moves to `prisma.config.ts`,
   and the runtime connection comes from the adapter.
3. Neither Prisma 7 nor `tsx` auto-loads `.env`, so `prisma/seed.ts` imports `dotenv/config`
   explicitly. Harmless in Docker, where compose supplies `DATABASE_URL` directly.
