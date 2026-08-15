import type { Metadata } from "next";
import Link from "next/link";
import VideoEmbed from "@/components/VideoEmbed";
import { getAssessment } from "@/lib/assessments";
import styles from "./assessment-1.module.css";

const assessment = getAssessment("assessment-1")!;

export const metadata: Metadata = {
  title: `Assessment ${assessment.number}`,
  description: assessment.summary,
};

export default function Assessment1Page() {
  return (
    <article className={styles.page}>
      <div className={styles.header}>
        <h1>
          Assessment {assessment.number} — {assessment.title}
        </h1>
      </div>
      <p className={styles.weight}>
        {assessment.weight} of the overall grade ·{" "}
        <span
          className={`${styles.status} ${assessment.status === "complete" ? styles.statusComplete : ""}`}
        >
          {assessment.status}
        </span>
      </p>

      <section aria-labelledby="what-heading" className={styles.section}>
        <h2 id="what-heading">What this part is about</h2>
        <p>{assessment.summary}</p>
        <p>
          Nothing here talks to a real server yet — that arrives in
          Assessment 2 — so this part is entirely about the interface: how it
          looks, how it behaves, and how well it holds up on a small screen
          with a keyboard instead of a mouse.
        </p>
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
        <h2 id="labs-heading">How this maps to the labs</h2>
        <p>
          Same approach as later assessments: follow the taught technique directly rather than
          building an equivalent from scratch, and note honestly where the code goes further than
          the lab or leaves a lab technique out.
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
                <td>Workshop 2 (Apache/cloud VM, cookies)</td>
                <td>
                  A vanilla <code>document.cookie</code> / <code>setCookie</code> /{" "}
                  <code>getCookie</code> script that remembers scroll position via a cookie, served
                  from Apache on an Azure VM.
                </td>
                <td>
                  Theme preference is persisted the same way — a hand-rolled{" "}
                  <code>document.cookie</code> string write, read back via a regex in an inline
                  script to prevent a flash of the wrong theme on load.
                </td>
                <td>
                  Matches the lab&apos;s plain-cookie mechanic directly, extended with a React
                  Context wrapper and a parallel <code>localStorage</code> write. The Apache/VM half
                  doesn&apos;t apply here — this runs as a Next.js app, not static HTML behind
                  Apache.
                </td>
              </tr>
              <tr>
                <td>Workshop 3a (Hamburger menu)</td>
                <td>
                  <code>useState</code> open/close toggle, <code>HamburgerMenu.module.css</code>,
                  animated bars via CSS transforms.
                </td>
                <td>
                  Same mechanism, same file names —{" "}
                  <code>components/HamburgerMenu.tsx</code> /{" "}
                  <code>HamburgerMenu.module.css</code>.
                </td>
                <td>
                  Close match, extended with route-change auto-close, Escape-to-close with focus
                  return, and <code>aria-expanded</code>/<code>aria-controls</code> — needed for
                  this assessment&apos;s accessibility criterion, which the lab doesn&apos;t cover.
                </td>
              </tr>
              <tr>
                <td>Workshop 3b (Carousel)</td>
                <td>
                  A Bootstrap carousel adapted from GeeksForGeeks, with prev/next controls and
                  data-bs-* attributes.
                </td>
                <td>No carousel exists anywhere in this codebase.</td>
                <td>
                  The brief asks for one only &quot;where appropriate.&quot; An RSS reader&apos;s
                  actual content — chronological article cards — has no natural rotating-slideshow
                  use case, so it was deliberately left out rather than added just to tick the lab
                  off.
                </td>
              </tr>
              <tr>
                <td>Workshop 4a (React to-do list)</td>
                <td>
                  <code>useState&lt;TodoItem[]&gt;</code>, add/edit/delete via{" "}
                  <code>.map()</code>/<code>.filter()</code>, inline styles.
                </td>
                <td>
                  The closest match is the &quot;My feeds&quot; list (
                  <code>FeedsView</code>/<code>AddFeedDialog</code>) — same array
                  add/remove pattern, but persisted via a <code>useLocalStorage</code> hook instead
                  of plain <code>useState</code>, styled with CSS Modules instead of inline styles.
                </td>
                <td>
                  Persisting the list (rather than losing it on refresh, as the lab&apos;s plain{" "}
                  <code>useState</code> does) matches the brief&apos;s emphasis on real
                  interactivity that survives navigation. CSS Modules instead of inline styles
                  follows this project&apos;s own established styling convention rather than the
                  lab&apos;s inline-style shortcut, which doesn&apos;t scale to a full app.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="video-heading" className={styles.section}>
        <h2 id="video-heading">Demo video</h2>
        <p>The submitted walkthrough of Assessment 1, in full.</p>
        <VideoEmbed
          src="https://www.youtube.com/embed/oe_mQ0RZq4k"
          title="Assessment 1 demonstration video"
          href="https://youtu.be/oe_mQ0RZq4k"
        />
      </section>

      <nav className={styles.links} aria-label="Related pages">
        <Link href="/feeds">Browse the Feeds library</Link>
        <Link href="/about">About the project</Link>
      </nav>
    </article>
  );
}
