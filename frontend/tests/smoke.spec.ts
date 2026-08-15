import { test, expect } from "@playwright/test";
import { siteConfig } from "../lib/siteConfig";

test.describe("shell", () => {
  test("home renders header title, footer identity and workflow", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page.getByRole("banner")).toContainText("LMS on Cloud");
    await expect(page.getByRole("banner")).toContainText(
      siteConfig.assessmentTitle,
    );
    await expect(page.getByRole("contentinfo")).toContainText(
      siteConfig.studentName,
    );
    await expect(
      page.getByRole("heading", { name: "How the RSS Server works" }),
    ).toBeVisible();
  });

  test("primary nav reaches Feeds with breadcrumb and active state", async ({
    page,
  }) => {
    await page.goto("/");
    const nav = page.getByRole("navigation", { name: "Primary" });
    await nav.getByRole("link", { name: "Feeds" }).click();
    await expect(page).toHaveURL("/feeds");
    await expect(
      nav.getByRole("link", { name: "Feeds" }),
    ).toHaveAttribute("aria-current", "page");
    await expect(
      page.getByRole("navigation", { name: "Breadcrumb" }),
    ).toBeVisible();
  });

  test("primary nav lists all four assessment pages", async ({ page }) => {
    await page.goto("/");
    const nav = page.getByRole("navigation", { name: "Primary" });
    for (let n = 1; n <= 4; n++) {
      await expect(
        nav.getByRole("link", { name: `Assessment ${n}`, exact: true }),
      ).toBeVisible();
    }
  });
});

test.describe("assessment pages", () => {
  test("Assessment 1 page renders its heading", async ({ page }) => {
    await page.goto("/assessment-1");
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: /Assessment 1 — Frontend design & usability/,
      }),
    ).toBeVisible();
  });

  test("Assessment 3 page reflects work in progress, not a placeholder", async ({
    page,
  }) => {
    await page.goto("/assessment-3");
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: /Assessment 3 — Data-driven app & reporting/,
      }),
    ).toBeVisible();
    await expect(page.getByText("in progress")).toBeVisible();
    await expect(
      page.getByText("This part hasn't been built yet"),
    ).not.toBeVisible();
  });
});

test.describe("hamburger menu (mobile)", () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test("opens, navigates, and closes on Escape with focus restored", async ({
    page,
  }) => {
    await page.goto("/");
    // The button's accessible name flips between "Open menu"/"Close menu",
    // so locate it by its stable aria-controls attribute.
    const button = page.locator('button[aria-controls="mobile-menu"]');
    await expect(button).toHaveAccessibleName("Open menu");
    await expect(button).toHaveAttribute("aria-expanded", "false");

    await button.click();
    await expect(button).toHaveAttribute("aria-expanded", "true");
    const mobileNav = page.getByRole("navigation", { name: "Mobile" });
    await mobileNav.getByRole("link", { name: "About" }).click();
    await expect(page).toHaveURL("/about");
    await expect(button).toHaveAttribute("aria-expanded", "false");

    await button.click();
    await expect(button).toHaveAttribute("aria-expanded", "true");
    await page.keyboard.press("Escape");
    await expect(button).toHaveAttribute("aria-expanded", "false");
    await expect(button).toBeFocused();
  });
});

test.describe("themes", () => {
  test("header toggle switches to dark and persists across reload", async ({
    page,
  }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /theme/i }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

    await page.reload();
    // The inline script in <head> must re-apply the cookie's theme before
    // the browser paints — no flash.
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  });

  test("settings radios change the theme", async ({ page }) => {
    await page.goto("/settings");
    // The radio inputs are visually hidden behind styled label cards, so
    // click the labels the way a user would.
    await page.locator('label:has(input[name="theme"][value="dark"])').click();
    await expect(
      page.locator('input[name="theme"][value="dark"]'),
    ).toBeChecked();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await page
      .locator('label:has(input[name="theme"][value="light"])')
      .click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  });
});

test.describe("feeds interactivity", () => {
  test("search narrows results and announces the count", async ({ page }) => {
    await page.goto("/feeds");
    await expect(page.getByRole("status")).toHaveText("11 posts");
    await page.getByRole("searchbox", { name: "Search posts" }).fill("dark");
    await expect(page.getByRole("status")).toHaveText("1 of 11 posts match");
    await expect(
      page.getByRole("link", {
        name: "Solving the theme flash: cookies and localStorage",
        exact: true,
      }),
    ).toBeVisible();
  });

  test("layout toggle persists after reload via localStorage", async ({
    page,
  }) => {
    await page.goto("/feeds");
    const listButton = page.getByRole("button", { name: "List", exact: true });
    await expect(listButton).toHaveAttribute("aria-pressed", "false");
    await listButton.click();
    await expect(listButton).toHaveAttribute("aria-pressed", "true");

    await page.reload();
    await expect(
      page.getByRole("button", { name: "List", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
  });

  test("summary expand/collapse toggles aria-expanded", async ({ page }) => {
    await page.goto("/feeds");
    const showMore = page
      .getByRole("button", { name: /Show more/ })
      .first();
    await expect(showMore).toHaveAttribute("aria-expanded", "false");
    await showMore.click();
    await expect(
      page.getByRole("button", { name: /Show less/ }).first(),
    ).toHaveAttribute("aria-expanded", "true");
  });
});

test.describe("dynamic post pages", () => {
  test("read-more opens the post with body and breadcrumbs", async ({
    page,
  }) => {
    await page.goto("/feeds");
    await page
      .getByRole("link", { name: /Read more.*New concepts I met/ })
      .click();
    await expect(page).toHaveURL(
      /\/feeds\/new-concepts-i-met-building-my-first-app/,
    );
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: "New concepts I met building my first app",
      }),
    ).toBeVisible();
    const crumbs = page.getByRole("navigation", { name: "Breadcrumb" });
    await expect(crumbs).toContainText("Feeds");
    await crumbs.getByRole("link", { name: "Feeds" }).click();
    await expect(page).toHaveURL("/feeds");
  });

  test("unknown slug returns a branded 404 with a way back", async ({
    page,
  }) => {
    const response = await page.goto("/feeds/does-not-exist");
    expect(response?.status()).toBe(404);
    // Branded not-found page, not the unstyled framework default: it keeps the
    // shell (nav) and offers navigation back.
    await expect(
      page.getByRole("heading", { name: "This page could not be found" }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Back to home" })).toBeVisible();
    await expect(page.getByRole("navigation").first()).toBeVisible();
  });
});
