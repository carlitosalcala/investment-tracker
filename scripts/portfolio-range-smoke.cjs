const { chromium, devices } = require("playwright");
const assert = require("node:assert/strict");
(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH,
    args: ["--no-sandbox"],
  });
  for (const device of [null, "iPhone 13"]) {
    const page = await browser.newPage({
      ...(device
        ? devices[device]
        : { viewport: { width: 1440, height: 1000 } }),
      locale: "en-US",
    });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.route("**/api/**", (r) =>
      r.fulfill({
        status: 502,
        contentType: "application/json",
        body: '{"error":"test"}',
      }),
    );
    await page.addInitScript(() =>
      localStorage.setItem(
        "investment-tracker.v1",
        JSON.stringify({
          version: 1,
          preferences: { currency: "EUR", theme: "sap_horizon_dark" },
          assets: [
            {
              id: "a",
              name: "Range test",
              type: "Fund",
              isin: "IE00BYX5NX33",
              currency: "EUR",
              source: "imported",
              sourceId: "",
              seriesType: "raw",
              archived: false,
              benchmark: "",
              prices: [
                { date: "2025-01-01", price: 100 },
                { date: "2025-02-01", price: 120 },
                { date: "2025-03-01", price: 130 },
              ],
            },
          ],
          purchases: [
            {
              id: "p",
              assetId: "a",
              date: "2025-01-01",
              price: 100,
              quantity: 1,
              fees: 0,
              currency: "EUR",
            },
          ],
        }),
      ),
    );
    await page.goto(
      (process.env.BASE_URL || "http://localhost:8080/") + "#/portfolio",
    );
    const chart = page.locator('[id$="--portfolioHistoryChart"]');
    await chart.waitFor({ timeout: 60000 });
    const data = () =>
      chart.evaluate((el) =>
        sap.ui
          .require("sap/ui/core/Element")
          .getElementById(el.id)
          .getChartData(),
      );
    assert.equal((await data()).dates.length, 3);
    const totals = await page.locator(".totals").innerText();
    const set = async (name, value) => {
      const input = page.locator('[id$="--' + name + '-inner"]');
      await input.fill(value);
      await input.press("Tab");
    };
    await set("portfolioFrom", "2025-02-01");
    await set("portfolioTo", "2025-02-01");
    assert.deepEqual((await data()).dates, ["2025-02-01"]);
    assert.equal((await data()).series[0].values[0], 120);
    assert.equal((await data()).series[1].values[0], 100);
    assert.equal(await page.locator(".totals").innerText(), totals);
    await set("portfolioFrom", "2025-03-01");
    assert.equal((await data()).dates.length, 0);
    await page
      .getByText("Enter valid dates with From on or before To.", {
        exact: true,
      })
      .waitFor();
    await page.getByRole("button", { name: "Show all", exact: true }).click();
    assert.equal((await data()).dates.length, 3);
    await set("portfolioFrom", "2025-04-01");
    assert.equal((await data()).dates.length, 0);
    await page
      .getByText("No portfolio observations in this date range.", {
        exact: true,
      })
      .waitFor();
    const today = new Date().toISOString().slice(0, 10);
    const week = new Date(today + "T00:00:00Z");
    week.setUTCDate(week.getUTCDate() - 7);
    const F = require("../webapp/model/finance.js");
    for (const [name, from] of [
      ["Last week", week.toISOString().slice(0, 10)],
      ["Last 1 month", F.boundary(today, "1M")],
      ["Last 3 months", F.boundary(today, "3M")],
    ]) {
      await page.getByRole("button", { name, exact: true }).click();
      assert.equal(await page.locator('[id$="--portfolioFrom-inner"]').inputValue(), from);
      assert.equal(await page.locator('[id$="--portfolioTo-inner"]').inputValue(), today);
      assert.equal(await page.locator(".totals").innerText(), totals);
    }
    await page.getByRole("button", { name: "Show all", exact: true }).click();
    assert.equal((await data()).dates.length, 3);
    assert.deepEqual(errors, []);
    console.log(
      "PASS",
      device || "desktop",
      "range, boundary inclusion, historical cost, unchanged totals, invalid/empty range, quick ranges, reset",
    );
    await page.close();
  }
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
