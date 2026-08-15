import { test, expect } from "@playwright/test";

// Assessment 3's testing criterion asks for a Playwright test proving the
// "server use case" — create/read/update/delete a feed. This exercises the
// full lifecycle directly against the API, the same request-level pattern
// rss-client.spec.ts already uses for its server-side checks, since a feed's
// CRUD operations are server behaviour whether or not there happens to be a
// UI form in front of them.
//
// Requires the api package running on :4080 (npm run start in ../api). Skips
// rather than fails when it is not up, matching rss-client.spec.ts.

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

test("full CRUD lifecycle for a feed: create, read, update, delete", async ({ request }) => {
  // A per-run slug avoids colliding with seeded or previous test-run data.
  const slug = `playwright-crud-${Date.now()}`;

  // Create
  const created = await request.post(`${API}/api/feeds`, {
    data: { slug, name: "Playwright CRUD Feed", description: "Created by an automated test." },
  });
  expect(created.status()).toBe(201);
  const createdBody = (await created.json()).data;
  expect(createdBody.slug).toBe(slug);
  const id = createdBody.id as number;

  // Read — both the collection and the single-record lookup
  const read = await request.get(`${API}/api/feeds?id=${id}`);
  expect(read.status()).toBe(200);
  expect((await read.json()).data.name).toBe("Playwright CRUD Feed");

  const readAll = await request.get(`${API}/api/feeds`);
  const allSlugs = ((await readAll.json()).data as { slug: string }[]).map((f) => f.slug);
  expect(allSlugs).toContain(slug);

  // Update
  const updated = await request.patch(`${API}/api/feeds?id=${id}`, {
    data: { name: "Playwright CRUD Feed (renamed)" },
  });
  expect(updated.status()).toBe(200);
  expect((await updated.json()).data.name).toBe("Playwright CRUD Feed (renamed)");

  // Delete
  const deleted = await request.delete(`${API}/api/feeds?id=${id}`);
  expect(deleted.status()).toBe(204);

  // Confirm it is actually gone
  const afterDelete = await request.get(`${API}/api/feeds?id=${id}`);
  expect(afterDelete.status()).toBe(404);
});

test("rejects an incomplete feed and a delete of a nonexistent one", async ({ request }) => {
  const missingName = await request.post(`${API}/api/feeds`, {
    data: { slug: `playwright-invalid-${Date.now()}` },
  });
  expect(missingName.status()).toBe(400);

  const deleteMissing = await request.delete(`${API}/api/feeds?id=999999999`);
  expect(deleteMissing.status()).toBe(404);
});
