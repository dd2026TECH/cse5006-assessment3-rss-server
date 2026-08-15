// Single source of truth for identity and navigation.
// Header, Footer, About and metadata all read from here.

export const siteConfig = {
  siteName: "LMS on Cloud — Web Application Build",
  assessmentTitle: "CSE5006 Assessment 2 — Backend, API & Database",
  studentName: "Xueting Denise Chin",
  studentId: "22663637",
  description:
    "A Learning Management System delivered on the cloud, built as a web application across four assessed parts — documented from a student's perspective so other students can see exactly how it was built. This part (Assessment 2) is the RSS Server: a Postgres database behind Prisma, CRUD and operational APIs, and an RSS Client — everything the Assessment 1 frontend now runs against instead of hardcoded sample data.",
  nav: [
    { href: "/", label: "Home" },
    { href: "/about", label: "About" },
    { href: "/assessment-1", label: "Assessment 1" },
    { href: "/assessment-2", label: "Assessment 2" },
    { href: "/assessment-3", label: "Assessment 3" },
    { href: "/assessment-4", label: "Assessment 4" },
    { href: "/feeds", label: "Feeds" },
    { href: "/rss-client", label: "RSS Client" },
    { href: "/dashboard", label: "Dashboard" },
    { href: "/settings", label: "Settings" },
  ],
} as const;

export type NavItem = (typeof siteConfig.nav)[number];
