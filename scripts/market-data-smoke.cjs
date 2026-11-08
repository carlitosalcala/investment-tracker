const { chromium } = require("playwright");
const assert = require("node:assert/strict");
(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
    headless: true,
    args: ["--no-sandbox"],
  });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("http://localhost:8080/index.html");
    const retrieve = page
      .getByRole("button", { name: "Retrieve real prices", exact: true })
      .first();
    await retrieve.waitFor({ timeout: 60000 });
    // The actual API must return either real observations or an actionable error.
    const actual = await page.request.get(
      "http://localhost:8080/api/prices/IE00BYX5NX33",
    );
    const payload = await actual.json();
    assert.ok(actual.ok() ? payload.prices.length : payload.error.length);
    console.log(
      "Live API:",
      actual.status(),
      payload.error || payload.prices.length + " observations",
    );
    let fail = false;
    await page.route("**/api/prices/*", async (route) => {
      if (fail)
        return route.fulfill({
          status: 502,
          json: { error: "Test provider unavailable" },
        });
      const isin = route.request().url().split("/").at(-1);
      await route.fulfill({
        json: {
          isin,
          name: "Test " + isin,
          type: "Fund",
          currency: "EUR",
          source: "retrieved",
          sourceId:
            "https://markets.ft.com/data/funds/tearsheet/historical?s=" +
            isin +
            ":EUR",
          seriesType: "raw",
          fetchedAt: "2026-11-08T10:00:00Z",
          prices: [
            { date: "2026-11-05", price: 12 },
            { date: "2026-11-06", price: 13 },
          ],
        },
      });
    });
    await retrieve.click();
    await page.getByText("4 fund(s) updated.", { exact: true }).waitFor();
    let saved = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("investment-tracker.v1")),
    );
    assert.ok(
      saved.assets.every(
        (a) => a.source === "retrieved" && a.prices.length === 2 && a.fetchedAt,
      ),
    );
    fail = true;
    await retrieve.click();
    await page
      .getByText(/0 fund\(s\) updated.*Test provider unavailable/)
      .waitFor();
    const after = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("investment-tracker.v1")),
    );
    assert.deepEqual(after, saved);
    await page.reload();
    await retrieve.waitFor();
    saved = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("investment-tracker.v1")),
    );
    assert.equal(saved.assets[0].source, "retrieved");
    await page.evaluate(() => {
      const data = JSON.parse(localStorage.getItem("investment-tracker.v1"));
      data.assets[0].source = "imported";
      data.assets[0].prices = [{ date: "2026-10-01", price: 99 }];
      data.assets[1].prices.unshift({ date: "2026-10-01", price: 10 });
      localStorage.setItem("investment-tracker.v1", JSON.stringify(data));
    });
    fail = false;
    await page.reload();
    await retrieve.click();
    await page.getByText("3 fund(s) updated.", { exact: true }).waitFor();
    saved = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("investment-tracker.v1")),
    );
    assert.equal(saved.assets[0].source, "imported");
    assert.equal(saved.assets[0].prices[0].price, 99);
    assert.equal(saved.assets[1].prices.length, 3);
    assert.deepEqual(errors, []);
    console.log(
      "PASS: browser retrieval, persistence, error reporting, preservation, no page errors",
    );
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
