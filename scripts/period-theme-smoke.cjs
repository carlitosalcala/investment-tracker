const { chromium } = require("playwright");
const assert = require("node:assert/strict");
(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
    headless: true,
    args: ["--no-sandbox"],
  });
  try {
    const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.route("**/api/prices/*", (route) => {
      const isin = route.request().url().split("/").at(-1);
      return route.fulfill({
        json: {
          isin,
          name: isin,
          type: "Fund",
          currency: "EUR",
          source: "retrieved",
          sourceId: "https://markets.ft.com/",
          seriesType: "raw",
          fetchedAt: "2026-11-08T10:00:00Z",
          prices: [
            { date: "2023-12-29", price: 100 },
            { date: "2024-12-31", price: 110 },
            { date: "2025-12-31", price: 120 },
            { date: "2026-10-30", price: 132 },
          ],
        },
      });
    });
    await page.goto("http://localhost:8080/index.html");
    await page
      .getByText("4 fund(s) updated.", { exact: true })
      .waitFor({ timeout: 60000 });
    assert.equal(
      await page.evaluate(() =>
        sap.ui.require("sap/ui/core/Theming").getTheme(),
      ),
      "sap_horizon_dark",
    );
    await page.getByText("By period", { exact: true }).waitFor();
    await page
      .getByText("Since first available price", { exact: true })
      .first()
      .waitFor();
    await page
      .locator('[id$="--periodTable"]')
      .getByText("2024", { exact: true })
      .first()
      .waitFor();
    await page.locator('[id$="--themeSelect"]').click();
    await page.locator('[role=option]:visible').filter({ hasText: /^Horizon light$/ }).click();
    await page.waitForFunction(
      () => sap.ui.require("sap/ui/core/Theming").getTheme() === "sap_horizon",
    );
    await page.reload();
    await page.waitForFunction(
      () => sap.ui.require("sap/ui/core/Theming")?.getTheme() === "sap_horizon",
    );
    assert.equal(
      (
        await page.evaluate(() =>
          JSON.parse(localStorage.getItem("investment-tracker.v1")),
        )
      ).preferences.theme,
      "sap_horizon",
    );
    assert.deepEqual(errors, []);
    console.log(
      "PASS: automatic retrieval, annual periods, dark default, light theme and persistence",
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
