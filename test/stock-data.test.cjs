const { test } = require("node:test");
const assert = require("node:assert/strict");
const { retrieveStock } = require("../server/stock-data.cjs");
const now = new Date("2026-11-08T12:00:00Z");
const make = (overrides = {}) => ({ chart: { result: [{ meta: { symbol: "ASML.AS", currency: "EUR", exchangeName: "AMS", instrumentType: "EQUITY", exchangeTimezoneName: "Europe/Amsterdam", ...overrides }, timestamp: [1793952000, 1794124800], indicators: { quote: [{ close: [123, 124] }] } }], error: null } });
const response = (data) => async () => ({ ok: true, json: async () => data });
test("stock retrieval validates listing and excludes an incomplete current-day bar", async () => {
  const data = await retrieveStock("ASML.AS", response(make()), now);
  assert.equal(data.prices.length, 1);
  assert.equal(data.prices[0].date, "2026-11-06");
  assert.equal(data.prices[0].price, 123);
  assert.equal(data.currency, "EUR");
});
test("stock retrieval rejects wrong identity, throttling, unsupported symbols and empty data", async () => {
  for (const meta of [{ symbol: "ASML" }, { currency: "USD" }, { exchangeName: "NMS" }])
    await assert.rejects(retrieveStock("ASML.AS", response(make(meta)), now), /confirm/);
  await assert.rejects(retrieveStock("ASML.AS", async () => ({ ok: false, status: 429 }), now), /429/);
  await assert.rejects(retrieveStock("UNKNOWN", response(make()), now), /Unsupported/);
  const empty = make(); empty.chart.result[0].indicators.quote[0].close = [null, null];
  await assert.rejects(retrieveStock("ASML.AS", response(empty), now), /no completed/);
});
