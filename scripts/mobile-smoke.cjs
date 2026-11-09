const { chromium, devices } = require("playwright");
const assert = require("node:assert/strict");
(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH,
    args: ["--no-sandbox"],
  });
  for (const device of ["iPhone 13", "Pixel 7"]) {
    const page = await browser.newPage({ ...devices[device], locale: "en-US" });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.route("**/api/**", (r) =>
      r.fulfill({
        status: 502,
        contentType: "application/json",
        body: '{"error":"test"}',
      }),
    );
    await page.goto(process.env.BASE_URL || "http://localhost:8080/");
    await page
      .getByText("Follow the long view", { exact: true })
      .waitFor({ timeout: 60000 });
    await page.locator('[id$="--themeSelect"]').tap();
    console.log(
      device,
      "theme picker",
      await page.getByRole("dialog").innerText(),
    );
    await page
      .getByRole("option", { name: "Horizon light", exact: true })
      .tap();
    await page.waitForTimeout(1000);
    console.log(
      "stored",
      await page.evaluate(
        () =>
          JSON.parse(localStorage.getItem("investment-tracker.v1")).preferences,
      ),
    );
    const backup = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("investment-tracker.v1")),
    );
    assert.equal(backup.preferences.theme, "sap_horizon");
    backup.assets[0].name = "Mobile restore verified";
    const chooser = page.waitForEvent("filechooser");
    await page
      .getByRole("button", { name: "Restore backup", exact: true })
      .tap();
    await (
      await chooser
    ).setFiles({
      name: "backup.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(backup)),
    });
    await page.getByRole("button", { name: "OK", exact: true }).tap();
    await page.waitForTimeout(500);
    assert.equal(
      await page.evaluate(
        () =>
          JSON.parse(localStorage.getItem("investment-tracker.v1")).assets[0]
            .name,
      ),
      "Mobile restore verified",
    );
    await page.reload();
    await page
      .getByText("Follow the long view", { exact: true })
      .waitFor({ timeout: 60000 });
    assert.equal(
      await page.evaluate(
        () =>
          JSON.parse(localStorage.getItem("investment-tracker.v1")).preferences
            .theme,
      ),
      "sap_horizon",
    );
    assert.deepEqual(errors, []);
    await page.screenshot({
      path: "/tmp/tracker-mobile-fixed-" + device.replaceAll(" ", "-") + ".png",
    });
    console.log(
      "PASS",
      device,
      "theme change, JSON file picker, restore, persistence, no page errors",
    );
    await page.close();
  }
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
