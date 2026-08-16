# Lighthouse accessibility — before/after

**Tool:** Lighthouse 13.4.1 CLI (`npx lighthouse`), accessibility category only, headless Chromium,
against `http://localhost/dashboard` on the Dockerised stack (the newest page this assessment adds).

| | Score | Failing audits |
|---|---|---|
| **Before** (`before-dashboard.json`) | 96/100 | `color-contrast` — 3 items |
| **After** (`after-dashboard.json`) | 100/100 | none |
| **Assessment 2 page, re-checked later** (`after-assessment-2.json`) | 100/100 | none (see below) |

## What Lighthouse found

All three failures were the same root cause in different places: dashboard status colours (alert
banners, feed-status badges) used a saturated colour as both a light tinted background *and* the
text colour drawn on top of it — a combination that reads fine to sighted testers at a glance but
fails WCAG's 4.5:1 minimum contrast ratio for normal text.

- Alert items (`.alertWarning`, `.alertError`): text `#d97706`/`#dc2626` on their own ~12%-tinted
  background measured **2.8:1** — Lighthouse flagged "Build Journal received invalid data...",
  "Community Digest has no posts.", and the failed-fetch alert by name.
- Feed-status badge (`.badgeOk`, "Healthy"): `#15803d` on `#e6f4ea` measured **4.41:1** — a near
  miss caught only because the badge text is small (12px), where the 4.5:1 threshold applies in
  full (WCAG's relaxed 3:1 tier only kicks in at 18px, or 14px bold).

## What changed

Added theme-aware status tokens to `globals.css` (`--status-{warning,error,ok}-{bg,text}`, defined
for both light and dark themes, following the same pattern the file already uses for `--bg`/
`--surface`/etc.) instead of the ad-hoc `color-mix()` + hardcoded hex pairs. Text colours are
deliberately darker than the originals specifically to clear 4.5:1 against their paired background:

| Status | Old text (light theme) | New text (light theme) |
|---|---|---|
| warning | `#d97706` | `#92400e` |
| error | `#dc2626` | `#991b1b` |
| ok | `#15803d` → `#0d6832` (darkened again after the first pass measured 4.41:1) |

`dashboard.module.css`'s `.alertError`, `.alertWarning`, `.badgeOk`, `.badgeWarning`, `.badgeError`
now reference these tokens. Dark-theme equivalents were added at the same time (lighter text on a
dark tinted background) even though Lighthouse only audited the light theme by default — the same
low-contrast-pair mistake would otherwise just reappear the first time someone tested dark mode.

## The same mistake reappeared on the assessment pages — and the fix this time

Running Lighthouse against `/assessment-2` later turned up the **exact same low-contrast pattern**
on its "IN PROGRESS" status pill: `color: var(--accent)` (`#2563eb`) drawn on
`color-mix(in srgb, var(--accent) 18%, transparent)` — text-on-tint again, same as the original
dashboard bug, just with the site's blue accent colour instead of the status colours. It existed on
`/assessment-1`, `/assessment-2`, `/assessment-3` (each with its own near-identical CSS module) and
in the shared `AssessmentOverview` component's `.statusInProgress`/`.statusComplete` badges (used by
`/assessment-4`) — four separate places with the same bug, because the earlier fix only tokenised
the *dashboard's* colours, not the site's general-purpose accent colour.

**Fix:** added a fourth token pair, `--status-info-{bg,text}` (light theme: `#1e40af` text on
`#dbe6fb`; dark theme: `#93c5fd` on `#1e2a4a`), following the exact same pattern as the
warning/error/ok tokens, and pointed all four "in progress" badges at it instead of `var(--accent)`.
`AssessmentOverview`'s `.statusComplete` (a hardcoded `#2e9e5b` green with the same text-on-tint
shape) was switched to reuse the already-verified `--status-ok-*` tokens rather than inventing a
fifth colour. Re-running Lighthouse against `/assessment-2` confirms `color-contrast` now passes
(`"score": 1` in `after-assessment-2.json`).

**The lesson, worth saying on camera:** a contrast fix scoped to one page can leave the same root
cause live everywhere else that copy-pasted the same CSS pattern — checking Lighthouse against more
than one page after a fix is what caught this, not a one-off audit.

## Reproducing

```bash
docker-compose up -d --build
npx lighthouse http://localhost/dashboard --only-categories=accessibility --output=json \
  --output-path=docs/lighthouse/after-dashboard.json --chrome-flags="--headless=new"
```

Committed as `.json` rather than Lighthouse's self-contained `.html` report viewer — the `.html`
report bundles Lighthouse's own viewer application, whose minified JS harmlessly contains a
console-logging call that trips this repo's no-debug-code commit check. For the video, swap
`--output=json` for `--output=html --view` locally to open the interactive report instead; the
scores and audit data are identical either way.

(`CHROME_PATH` needs to point at a Chromium binary if Lighthouse can't auto-detect one — Playwright's
bundled Chromium under `ms-playwright/` works.)
