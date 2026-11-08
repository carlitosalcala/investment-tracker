const { chromium } = require("playwright");
const assert = require("node:assert/strict");
(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
    headless: true,
    args: ["--no-sandbox"],
  });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  page.on("pageerror", (e) => console.log("PAGE ERROR", e.message));
  page.on("console", (m) => {
    if (m.type() === "error") console.log("CONSOLE", m.text());
  });
  await page.goto("http://localhost:8080/index.html");
  await page
    .getByText("Follow the long view", { exact: true })
    .waitFor({ timeout: 60000 });
  await page
    .getByRole("button", { name: "Load fictional demo", exact: true })
    .click();
  await page.getByRole("button", { name: "OK", exact: true }).click();
  await page.waitForTimeout(1500);
  await page.screenshot({
    path: "docs/screenshots/dashboard.png",
    fullPage: true,
  });
  await page.getByText("Assets", { exact: true }).first().click();
  await page.getByRole("button", { name: "Add asset", exact: true }).click();
  await page.waitForTimeout(300);
  console.log("DIALOG", await page.getByRole("dialog").innerText());
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.screenshot({
    path: "docs/screenshots/assets.png",
    fullPage: true,
  });
  await page.getByText("Portfolio", { exact: true }).first().click();
  await page.getByRole("button", { name: "Add purchase", exact: true }).click();
  const dialog = page.getByRole("dialog");
  const nums = dialog.locator("input[type=number]");
  await nums.nth(0).fill("100");
  await nums.nth(1).fill("2");
  await nums.nth(2).fill("5");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.waitForTimeout(500);
  await page.screenshot({
    path: "docs/screenshots/portfolio.png",
    fullPage: true,
  });
  await page.reload();
  await page
    .getByRole("button", { name: "Add purchase", exact: true })
    .waitFor();
  const stored = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("investment-tracker.v1")),
  );
  assert.equal(stored.purchases.length, 1);
  assert.equal(stored.purchases[0].fees, 5);
  const dl = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Export backup", exact: true })
    .click();
  assert.equal((await dl).suggestedFilename(), "investment-journal.json");
  console.log("PASS: demo, navigation, purchase, persistence, backup");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "docs/screenshots/mobile.png",
    fullPage: true,
  });
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
