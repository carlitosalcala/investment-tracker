const { chromium } = require("playwright");
const assert = require("node:assert/strict");
(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
    args: ["--no-sandbox"],
  });
  const page = await browser.newPage();
  page.setDefaultTimeout(15000);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("http://localhost:8080/index.html");
  await page.getByText("Follow the long view", { exact: true }).waitFor();
  await page.getByText("Assets", { exact: true }).first().click();
  await page.getByRole("button", { name: "Add asset", exact: true }).click();
  let dialog = page.getByRole("dialog");
  await dialog.getByLabel("Name", { exact: true }).fill("My test stock");
  await dialog.getByLabel("Ticker", { exact: true }).fill("TEST");
  await dialog.getByRole("button", { name: "Save", exact: true }).click();
  await page.getByText("My test stock", { exact: true }).waitFor();
  console.log("asset saved");
  const listItem = page
    .locator(".sapMLIB")
    .filter({ has: page.getByText("My test stock", { exact: true }) });
  await listItem
    .getByRole("button", { name: "Import prices CSV", exact: true })
    .click();
  const chooser = page.waitForEvent("filechooser");
  console.log("import help open");
  await page.getByRole("button", { name: "OK", exact: true }).click();
  await (
    await chooser
  ).setFiles({
    name: "prices.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("date,price\n2025-01-02,100\n2025-01-03,110"),
  });
  await page.getByRole("button", { name: "OK", exact: true }).click();
  await page.waitForTimeout(300);
  console.log("import saved");
  const stored = await page.evaluate(() =>
    localStorage.getItem("investment-tracker.v1"),
  );
  const data = JSON.parse(stored);
  assert.equal(data.assets.at(-1).source, "imported");
  assert.equal(data.assets.at(-1).prices.length, 2);
  const restore = page.waitForEvent("filechooser");
  await page
    .getByRole("button", { name: "Restore backup", exact: true })
    .click();
  await (
    await restore
  ).setFiles({
    name: "backup.json",
    mimeType: "application/json",
    buffer: Buffer.from(stored),
  });
  await page.getByRole("button", { name: "OK", exact: true }).click();
  await page.waitForTimeout(300);
  assert.deepEqual(
    JSON.parse(
      await page.evaluate(() => localStorage.getItem("investment-tracker.v1")),
    ),
    data,
  );
  assert.deepEqual(errors, []);
  console.log(
    "PASS: asset creation, CSV import provenance, confirmed backup restore; no page errors",
  );
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
