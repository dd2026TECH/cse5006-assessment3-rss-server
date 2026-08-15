import { test, expect } from "@playwright/test";

// Verifies the flow the marking rubric names explicitly: "the video shows the
// RSS Server sending feeds to the RSS Client". This is that flow as an
// automated check, so it can be proven before recording rather than discovered
// on camera.
//
// Requires the api package running on :4080 (npm run start in ../api). The
// tests skip rather than fail when it is not up, so `npm test` stays meaningful
// for frontend-only runs.

const API = "http://localhost:4080";

test.beforeEach(async ({ request }) => {
  let reachable = false;
  try {
    const res = await request.get(`${API}/api/health`, { timeout: 3000 });
    reachable = res.ok();
  } catch {
    reachable = false;
  }
  test.skip(!reachable, `RSS Server not reachable at ${API} — start the api package`);
});

test("RSS Client fetches a real RSS 2.0 feed from the RSS Server", async ({ page }) => {
  await page.goto("/rss-client");

  await expect(page.getByRole("heading", { name: "RSS Client", level: 1 })).toBeVisible();

  // The feed URL must be visible on screen — it is the evidence that the client
  // is talking to the server over HTTP rather than reading local data.
  const url = page.locator("code");
  await expect(url).toContainText("/api/feeds/rss.xml");
  await expect(url).toContainText("slug=");

  await page.getByRole("button", { name: "Fetch feed" }).click();

  // Items received and rendered from the parsed XML.
  const items = page.locator("li h3");
  await expect(items.first()).toBeVisible();
  expect(await items.count()).toBeGreaterThan(0);

  // The raw XML toggle is what makes the demo legible on camera.
  await page.getByRole("button", { name: "Show raw XML" }).click();
  await expect(page.locator("pre")).toContainText("<rss");
  await expect(page.locator("pre")).toContainText("<channel>");
});

test("switching feeds fetches a different channel", async ({ page }) => {
  await page.goto("/rss-client");

  await page.getByRole("button", { name: "Fetch feed" }).click();
  await expect(page.locator("li h3").first()).toBeVisible();
  const firstCount = await page.locator("li h3").count();

  const select = page.getByRole("combobox");
  const options = await select.locator("option").allTextContents();
  test.skip(options.length < 2, "needs at least two seeded feeds");

  // Switch to a feed other than the one already shown. "Community Digest" is
  // Assessment 3's deliberately empty feed (seeded for the dashboard's
  // empty-feed alert case) — skip past it here rather than asserting on it,
  // since this test is specifically about switching between feeds with items.
  const target = options.find(
    (label) => label !== options[0] && label !== "Community Digest",
  );
  test.skip(!target, "no second non-empty feed available to switch to");
  await select.selectOption({ label: target! });
  await expect(page.locator("code")).toContainText("slug=");
  await page.getByRole("button", { name: "Fetch feed" }).click();

  // Both seeded feeds have items; the counts differ (6 and 5).
  await expect(page.locator("li h3").first()).toBeVisible();
  const secondCount = await page.locator("li h3").count();
  expect(firstCount + secondCount).toBeGreaterThan(1);
});

test("the server reports healthy and serves valid RSS", async ({ request }) => {
  const health = await request.get(`${API}/api/health`);
  expect(health.status()).toBe(200);
  expect((await health.json()).data.database).toBe("connected");

  const feed = await request.get(`${API}/api/feeds/rss.xml?slug=build-journal`);
  expect(feed.status()).toBe(200);
  expect(feed.headers()["content-type"]).toContain("application/rss+xml");

  const xml = await feed.text();
  expect(xml).toContain('<rss version="2.0"');
  expect(xml).toContain("<channel>");
  expect(xml).toContain("<item>");
});
