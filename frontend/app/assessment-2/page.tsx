import type { Metadata } from "next";
import Link from "next/link";
import VideoEmbed from "@/components/VideoEmbed";
import { getAssessment } from "@/lib/assessments";
import styles from "./assessment-2.module.css";

const assessment = getAssessment("assessment-2")!;

export const metadata: Metadata = {
  title: `Assessment ${assessment.number}`,
  description: assessment.summary,
};

export default function Assessment2Page() {
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

      <section aria-labelledby="what-heading" className={styles.section}>
        <h2 id="what-heading">What this part is about</h2>
        <p>{assessment.summary}</p>
      </section>

      <section aria-labelledby="built-heading" className={styles.section}>
        <h2 id="built-heading">What was built</h2>
        <ul className={styles.builtList}>
          {assessment.adds.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="labs-heading" className={styles.section}>
        <h2 id="labs-heading">How this maps to Workshop 7b</h2>
        <p>
          Same approach as later assessments: follow the taught technique directly, and note
          honestly where real breaking changes forced a deviation.
        </p>
        <div className={styles.tableWrap}>
          <table className={styles.compareTable}>
            <thead>
              <tr>
                <th>What the lab teaches</th>
                <th>What this project does</th>
                <th>Why</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  Two Next.js projects (UI-only <code>frontend</code>, API-only <code>api</code>)
                  plus Postgres, <code>docker-compose.yml</code> with <code>frontend</code> on{" "}
                  <code>80:3000</code>, <code>api</code> on <code>4080:3000</code>, matching
                  Postgres credentials.
                </td>
                <td>
                  Identical service split and port mapping, verbatim from the lab&apos;s{" "}
                  <code>docker-compose.yml</code>.
                </td>
                <td>Direct match — this is the one place the project follows the lab exactly.</td>
              </tr>
              <tr>
                <td>
                  <code>schema.prisma</code> with{" "}
                  <code>generator client {"{"} provider = &quot;prisma-client-js&quot; {"}"}</code>
                  , <code>url = env(&quot;DATABASE_URL&quot;)</code> directly in the datasource
                  block, and <code>new PrismaClient()</code> with no arguments.
                </td>
                <td>
                  <code>url</code> moved to <code>prisma.config.ts</code>; the client requires a
                  driver adapter (<code>new PrismaClient({"{"} adapter: new PrismaPg(...) {"}"})</code>
                  ); generator provider is <code>&quot;prisma-client&quot;</code>, not{" "}
                  <code>&quot;prisma-client-js&quot;</code>.
                </td>
                <td>
                  Not a stylistic choice — Prisma 7 breaking changes. <code>url</code> in the
                  schema file is a hard error (P1012); the no-argument client doesn&apos;t compile.
                  Verified and documented in <code>api/SCHEMA_RATIONALE.md</code>, not guessed.
                </td>
              </tr>
              <tr>
                <td>
                  Each route handler repeats its own <code>corsHeaders</code> object, an{" "}
                  <code>OPTIONS</code> preflight, and try/catch error handling — for the
                  lab&apos;s one resource (users).
                </td>
                <td>
                  <code>lib/api.ts</code> centralises <code>corsHeaders</code>,{" "}
                  <code>preflight()</code>, and <code>ok()</code>/<code>fail()</code> envelope
                  helpers, reused across three resources (feeds, posts, authors).
                </td>
                <td>
                  The lab&apos;s per-handler boilerplate doesn&apos;t scale past one resource;
                  extracting it once was a DRY improvement in behaviour-preserving structure, not a
                  deviation from what the lab actually does.
                </td>
              </tr>
              <tr>
                <td>
                  <code>entrypoint.sh</code>: wait for Postgres, <code>prisma generate</code> +{" "}
                  <code>migrate deploy</code>, then <code>npm run dev</code>.
                </td>
                <td>Same three-step entrypoint, plus a seed step before serving.</td>
                <td>
                  Structurally identical; the added seed step loads Assessment 1&apos;s real
                  content, since this brief needs real data in the database, not the lab&apos;s
                  empty placeholder table.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="video-heading" className={styles.section}>
        <h2 id="video-heading">Demo video</h2>
        <p>The submitted walkthrough of Assessment 2, in full.</p>
        <VideoEmbed
          src="https://www.youtube.com/embed/4h8JMfINKFI"
          title="Assessment 2 demonstration video"
          href="https://youtu.be/4h8JMfINKFI"
        />
      </section>

      <nav className={styles.links} aria-label="Related pages">
        <Link href="/assessment-1">Assessment 1</Link>
        <Link href="/feeds">Browse the Feeds library</Link>
      </nav>
    </article>
  );
}
