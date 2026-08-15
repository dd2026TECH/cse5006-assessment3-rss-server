// One entry per assessed part of the LMS on Cloud build. Drives the
// assessment-N pages, the Home explore grid, and the About page's
// "the four parts" section — a single place to update as later parts land.

export type AssessmentStatus = "complete" | "in progress" | "upcoming";

export interface Assessment {
  number: 1 | 2 | 3 | 4;
  slug: string;
  title: string;
  weight: string;
  status: AssessmentStatus;
  summary: string;
  adds: string[];
}

export const assessments: Assessment[] = [
  {
    number: 1,
    slug: "assessment-1",
    title: "Frontend design & usability",
    weight: "20%",
    status: "complete",
    summary:
      "Designs and builds the LMS frontend itself: the pages, the light/dark theme system, the responsive navigation and hamburger menu, and the interactive feeds library — all written up here so another student could follow the same build.",
    adds: [
      "Header, footer, navigation and the four core pages",
      "Light/dark theming with cookie + localStorage persistence",
      "The Feeds library: search, layout toggle, expand/collapse, dynamic post pages",
      "Accessibility polish: keyboard operability, ARIA, WCAG AA contrast",
    ],
  },
  {
    number: 2,
    slug: "assessment-2",
    title: "Backend, API & database",
    weight: "25%",
    status: "in progress",
    summary:
      "Introduces the real RSS Server: a database-backed API that the frontend built in Assessment 1 reads through, plus an RSS Client that receives the feeds it serves.",
    adds: [
      "Prisma models and migrations for feeds, authors and posts",
      "CRUD APIs with validation, status codes and a health endpoint",
      "An RSS Client page that visibly receives server-sent feeds",
      "Dockerized so the whole server runs from a clean checkout",
    ],
  },
  {
    number: 3,
    slug: "assessment-3",
    title: "Data-driven app & reporting",
    weight: "25%",
    status: "in progress",
    summary:
      "Turns the running RSS Server into a data-driven app: dashboards summarising real usage, simulated records across a time range, and evidence from automated and load testing.",
    adds: [
      "A /dashboard reporting real usage: health status, request totals, requests per feed and per client, and feed status summaries, backed by the database rather than kept in memory",
      "Rule-based alerts (empty feed, failed fetch, invalid data, idle) that surface problems on the dashboard itself, without anyone needing to check logs",
      "Playwright coverage of the server use case (feed CRUD) and the client use case (RSS retrieval)",
      "JMeter staged load testing (x1 through x10000) against the Dockerised app, with the results interpreted, not just reported",
      "A Lighthouse accessibility pass that found and fixed a real WCAG contrast bug (96 -> 100), with before/after evidence kept",
      "OpenTelemetry distributed tracing (Jaeger, Zipkin, Prometheus) that let the load-testing bottleneck be confirmed from real request traces instead of just guessed at",
    ],
  },
  {
    number: 4,
    slug: "assessment-4",
    title: "Live demonstration",
    weight: "30%",
    status: "upcoming",
    summary:
      "Every earlier part folds into one system, deployed to the cloud and demonstrated live: the frontend, the API and database, and the reporting dashboards running together end to end.",
    adds: [
      "Cloud deployment on AWS Academy or Azure for Students",
      "Performance refinements measured before/after with JMeter",
      "A rehearsed 15-minute live walkthrough plus Q&A",
    ],
  },
];

export function getAssessment(slug: string): Assessment | undefined {
  return assessments.find((a) => a.slug === slug);
}
