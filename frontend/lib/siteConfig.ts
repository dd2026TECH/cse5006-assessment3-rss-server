// Single source of truth for identity and navigation.
// Header, Footer, About and metadata all read from here.

export const siteConfig = {
  siteName: "LMS on Cloud — Web Application Build",
  assessmentTitle: "CSE5006 Assessment 3 — Data-Driven Web Application & Reporting",
  studentName: "Xueting Denise Chin",
  studentId: "22663637",
  description:
    "A Learning Management System delivered on the cloud, built as a web application across four assessed parts — documented from a student's perspective so other students can see exactly how it was built. This part (Assessment 3) turns the RSS Server into a system that proves it is working: an operational dashboard, rule-based alerts, and evidence from Playwright, JMeter and Lighthouse testing, plus OpenTelemetry tracing — everything Assessment 2's backend now reports on and is monitored by, instead of running silently.",
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
