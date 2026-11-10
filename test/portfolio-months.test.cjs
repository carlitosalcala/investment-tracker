const { test } = require("node:test");
const assert = require("node:assert/strict");
const F = require("../webapp/model/finance.js");

test("monthly snapshots span 12 months, separate currencies, and distinguish contributions from gains", () => {
  const assets = [
    { id: "eur", currency: "EUR", prices: [
      { date: "2025-11-28", price: 100 },
      { date: "2025-12-31", price: 110 },
      { date: "2026-01-14", price: 120 },
      { date: "2026-01-16", price: 999 },
    ] },
    { id: "usd", currency: "USD", prices: [{ date: "2025-12-31", price: 50 }] },
  ];
  const purchases = [
    { assetId: "eur", currency: "EUR", date: "2025-11-01", price: 100, quantity: 1, fees: 0 },
    { assetId: "eur", currency: "EUR", date: "2026-01-05", price: 115, quantity: 1, fees: 2 },
    { assetId: "usd", currency: "USD", date: "2025-12-01", price: 45, quantity: 1, fees: 0 },
    { assetId: "eur", currency: "EUR", date: "2026-01-20", price: 120, quantity: 100, fees: 0 },
  ];
  const rows = F.portfolioMonths(assets, purchases, "2026-01-15");
  assert.equal(rows.length, 24);
  assert.equal(rows.at(-1).month, "2025-02");
  assert.deepEqual(rows[0], { month: "2026-01", currency: "EUR", partial: true, purchases: 117, value: 240, change: 130, gain: 13 });
  assert.deepEqual(rows[1], { month: "2026-01", currency: "USD", partial: true, purchases: 0, value: 50, change: 0, gain: 0 });
  assert.equal(rows[2].partial, false);
  assert.equal(rows[2].change, 10);
  assert.deepEqual(F.portfolioMonths([], purchases, "2026-01-15"), []);
});

test("missing current or opening valuations remain unavailable", () => {
  const asset = { id: "a", currency: "EUR", prices: [{ date: "2026-01-02", price: 20 }] };
  const purchase = { assetId: "a", currency: "EUR", date: "2025-12-01", price: 10, quantity: 1, fees: 0 };
  const rows = F.portfolioMonths([asset], [purchase], "2026-01-31");
  assert.equal(rows[0].value, 20);
  assert.equal(rows[0].change, null);
  assert.equal(rows[0].gain, null);
  assert.equal(rows[0].partial, false);
  assert.equal(rows[1].value, null);
  assert.equal(rows[1].change, null);
  assert.equal(rows[2].value, 0);
});
