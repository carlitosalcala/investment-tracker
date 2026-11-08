const { chromium } = require("playwright");
const assert = require("node:assert/strict");
(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
    headless: true,
    args: ["--no-sandbox"],
  });
  try {
    const page = await browser.newPage({
      viewport: { width: 1600, height: 1000 },
    });
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
    await page.goto(
      (process.env.TRACKER_URL || "http://localhost:8080") + "/index.html",
    );
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
    const periods = page.locator('[id$="--periodTable"]');
    const history = page.locator('[id$="--history"]');
    const periodRows = periods.locator("tbody tr.sapMLIB");
    const historyRows = history.locator("tbody tr.sapMLIB");
    await page.waitForFunction(
      () =>
        document.querySelectorAll('[id$="--periodTable"] tbody tr.sapMLIB')
          .length === 14,
    );
    assert.equal(await historyRows.count(), 7);
    for (const row of await periodRows.all().then((rows) => rows.slice(0, 4)))
      assert.match(await row.innerText(), /1M/);
    await page.locator('[id$="--history-trigger"]').click();
    await page.waitForFunction(
      () =>
        document.querySelectorAll('[id$="--history"] tbody tr.sapMLIB')
          .length === 14,
    );
    await page.locator('[id$="--periodTable-trigger"]').click();
    await page.waitForFunction(
      () =>
        document.querySelectorAll('[id$="--periodTable"] tbody tr.sapMLIB')
          .length === 28,
    );
    await page.locator('[id$="--periodSort"]').click();
    await page
      .locator("[role=option]:visible")
      .filter({ hasText: /^Fund$/ })
      .click();
    await page.waitForTimeout(300);
    assert.equal(
      (await periodRows.nth(0).innerText()).match(/IE[A-Z0-9]{10}/)[0],
      (await periodRows.nth(1).innerText()).match(/IE[A-Z0-9]{10}/)[0],
    );
    const years = page.locator('[id$="--years"] tbody tr.sapMLIB');
    assert.equal(
      (await years.nth(0).innerText()).match(/20\d{2}/)[0],
      (await years.nth(1).innerText()).match(/20\d{2}/)[0],
    );
    await page.locator('[id$="--yearSort"]').click();
    await page
      .locator("[role=option]:visible")
      .filter({ hasText: /^Fund$/ })
      .click();
    await page.waitForTimeout(200);
    assert.equal(
      (await years.nth(0).innerText()).match(/IE[A-Z0-9]{10}/)[0],
      (await years.nth(1).innerText()).match(/IE[A-Z0-9]{10}/)[0],
    );
    await page.locator('[id$="--historySort"]').click();
    await page
      .locator("[role=option]:visible")
      .filter({ hasText: /^Fund$/ })
      .click();
    await page.waitForTimeout(200);
    assert.equal(
      (await historyRows.nth(0).innerText()).match(/IE[A-Z0-9]{10}/)[0],
      (await historyRows.nth(1).innerText()).match(/IE[A-Z0-9]{10}/)[0],
    );
    for (const [label, theme] of [
      ["Quartz Light", "sap_fiori_3"],
      ["Quartz Dark", "sap_fiori_3_dark"],
    ]) {
      await page.locator('[id$="--themeSelect"]').click();
      await page
        .locator("[role=option]:visible")
        .filter({ hasText: label })
        .click();
      await page.waitForFunction(
        (value) => sap.ui.require("sap/ui/core/Theming").getTheme() === value,
        theme,
      );
      const css = await page.request.get(
        (process.env.TRACKER_URL || "http://localhost:8080") +
          `/resources/sap/m/themes/${theme}/library.css`,
      );
      assert.equal(css.status(), 200, `${theme} stylesheet`);
    }
    await page.locator('[id$="--themeSelect"]').click();
    await page
      .locator("[role=option]:visible")
      .filter({ hasText: /^Horizon light$/ })
      .click();
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
      "PASS: table limits, all sorting controls, Quartz themes, automatic retrieval and theme persistence",
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
