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
    await page.addInitScript(() => {
      const assets = ["Alpha", "Beta"].map((name, i) => ({
        id: name,
        name,
        type: "Fund",
        isin: ["IE00BYX5NX33", "IE00BYX5MD61"][i],
        currency: "EUR",
        source: "imported",
        sourceId: "",
        seriesType: "raw",
        archived: false,
        benchmark: "",
        prices: [{ date: "2025-04-01", price: 100 }],
      }));
      const purchases = [
        ["p1", "Alpha", "2025-01-01"],
        ["p2", "Beta", "2025-03-01"],
        ["p3", "Alpha", "2025-02-01"],
      ].map(([id, assetId, date]) => ({
        id,
        assetId,
        date,
        price: 100,
        quantity: 1,
        fees: 0,
        currency: "EUR",
      }));
      localStorage.setItem(
        "investment-tracker.v1",
        JSON.stringify({
          version: 1,
          preferences: { currency: "EUR", theme: "sap_horizon_dark" },
          assets,
          purchases,
        }),
      );
    });
    await page.goto(
      (process.env.BASE_URL || "http://localhost:8080/") + "#/portfolio",
    );
    const table = page.locator('[id$="--purchaseTable"]');
    await table.waitFor({ timeout: 60000 });
    const months = await page.locator('[id$="--portfolioMonths"]').evaluate((el) =>
      sap.ui.require("sap/ui/core/Element").getElementById(el.id).getItems()
        .map((item) => item.getBindingContext("vm").getObject()));
    assert.equal(months.length, 12);
    assert.equal(months[0].month.slice(0, 7), new Date().toISOString().slice(0, 7));
    assert.equal(months[0].currency, "EUR");
    assert.equal(months[0].value, "300");
    assert.equal(months[0].changePercent, "0%");
    const rows = () =>
      table.evaluate((el) =>
        sap.ui
          .require("sap/ui/core/Element")
          .getElementById(el.id)
          .getItems()
          .map((item) => item.getBindingContext("vm").getObject()),
      );
    assert.deepEqual(
      (await rows()).map((p) => p.id),
      ["p2", "p3", "p1"],
    );
    const totals = await page.locator(".totals").innerText();
    const select = page.locator('[id$="--purchaseAssetFilter"]');
    await select.click();
    await page.getByRole("option", { name: "Alpha", exact: true }).and(page.locator("li")).click();
    assert.deepEqual(
      (await rows()).map((p) => p.id),
      ["p3", "p1"],
    );
    assert.equal(await page.locator(".totals").innerText(), totals);
    await select.click();
    await page.getByRole("option", { name: "All assets", exact: true }).click();
    assert.deepEqual(
      (await rows()).map((p) => p.id),
      ["p2", "p3", "p1"],
    );
    assert.equal(
      await page.evaluate(
        () =>
          JSON.parse(localStorage.getItem("investment-tracker.v1")).purchases
            .length,
      ),
      3,
    );
    assert.deepEqual(errors, []);
    console.log(
      "PASS",
      device || "desktop",
      "newest-first purchases, asset filter, reset, totals and saved purchases preserved",
    );
    await page.close();
  }
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
