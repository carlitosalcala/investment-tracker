const { test } = require("node:test");
const assert = require("node:assert/strict");
const F = require("../webapp/model/finance.js");
const a = {
  id: "a",
  name: "Example",
  type: "Fund",
  isin: "IE00BYX5NX33",
  currency: "EUR",
  source: "imported",
  seriesType: "raw",
  prices: [
    { date: "2024-12-31", price: 100 },
    { date: "2025-01-02", price: 110 },
    { date: "2025-01-03", price: 121 },
  ],
};
const buy = (id, date, quantity, fees) => ({
  id,
  assetId: "a",
  date,
  quantity,
  price: 100,
  fees,
  currency: "EUR",
});
test("1D is latest two common valuations, 5D clamps to history", () => {
  assert.equal(F.compare([a], "1D").start, "2025-01-02");
  assert.ok(Math.abs(F.compare([a], "1D").series[0].return - 10) < 1e-9);
  assert.equal(F.compare([a], "5D").start, "2024-12-31");
});
test("YTD uses previous year boundary and calendar months clamp", () => {
  assert.equal(F.boundary("2025-01-03", "YTD"), "2024-12-31");
  assert.equal(F.boundary("2024-08-31", "6M"), "2024-02-29");
  assert.equal(F.compare([a], "YTD").start, "2024-12-31");
});
test("common date alignment and missing observations never zero", () => {
  const b = { ...a, id: "b", prices: [a.prices[1], a.prices[2]] };
  assert.equal(F.compare([a, b], "All").start, "2025-01-02");
  assert.equal(F.compare([{ ...a, prices: [] }], "All").start, null);
});
test("multiple purchases, fees, missing historical value and no future prices", () => {
  const ps = [buy("1", "2024-12-30", 2, 3), buy("2", "2025-01-02", 1, 2)];
  let h = F.portfolio([a], ps, "2024-12-30")[0];
  assert.equal(h.value, null);
  h = F.portfolio([a], ps, "2025-01-02")[0];
  assert.equal(h.cost, 305);
  assert.equal(h.value, 330);
  assert.equal(h.gain, 25);
  assert.equal(F.quantity(205, 100, 5), 2);
  assert.throws(() => F.quantity(5, 100, 5));
});
test("CSV rejects impossible dates, duplicate dates and nonpositive/nonfinite prices", () => {
  for (const s of [
    "date,price\n2025-02-30,1",
    "date,price\n2025-01-01,0",
    "date,price\n2025-01-01,Infinity",
    "date,price\n2025-01-01,1\n2025-01-01,2",
  ])
    assert.throws(() => F.csv(s));
  assert.equal(F.csv("date,price\n2025-01-01,123.456789")[0].price, 123.456789);
});
test("backup round trip validates duplicates and purchase references", () => {
  const d = {
    version: 1,
    assets: [a],
    purchases: [buy("p", "2025-01-02", 1, 2)],
    preferences: { currency: "EUR" },
  };
  assert.deepEqual(F.restore(JSON.stringify(d)), d);
  assert.throws(() => F.restore(JSON.stringify({ ...d, assets: [a, a] })));
  assert.throws(() =>
    F.restore(
      JSON.stringify({
        ...d,
        purchases: [{ ...d.purchases[0], assetId: "missing" }],
      }),
    ),
  );
});
test("year returns require previous boundary", () => {
  assert.equal(F.years(a)[0].return, null);
  assert.ok(Math.abs(F.years(a)[1].return - 21) < 1e-9);
  assert.equal(F.years(a)[1].incomplete, true);
});

test("asset validation preserves metadata and prevents duplicate identity", () => {
  assert.equal(F.validateAsset({ ...a }, []).name, "Example");
  assert.throws(() => F.validateAsset({ ...a, id: "b" }, [a]));
  assert.throws(() => F.validateAsset({ ...a, currency: "EU" }, []));
});
test("foreign holdings retain currency; future purchases are rejected", () => {
  const usd = { ...a, id: "usd", currency: "USD" };
  const p = {
    ...buy("p", "2025-01-02", 1, 2),
    assetId: "usd",
    currency: "USD",
  };
  assert.equal(F.portfolio([usd], [p], "2025-01-03")[0].currency, "USD");
  assert.throws(() => F.validatePurchase({ ...p, date: "2099-01-01" }, [usd]));
});
