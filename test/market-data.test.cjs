const { test } = require("node:test");
const assert = require("node:assert/strict");
const { parseHistory, retrieve } = require("../server/market-data.cjs");
const isin = "IE00BYX5NX33";
const html = (rows, symbol = isin + ":EUR") =>
  `<body><h1>${symbol}</h1><table><thead><tr><th>Date</th><th>Open</th><th>Close</th></tr></thead><tbody>${rows}</tbody></table></body>`;
const row = (day, price) =>
  `<tr><td><span>Friday, October ${day}, 2026</span><span>Oct ${day} 2026</span></td><td>999</td><td>${price}</td></tr>`;
test("extracts closing observations, sorts dates and deduplicates responsive rows", () => {
  assert.deepEqual(
    parseHistory(
      html(row("30", "1,234.50") + row("29", "12.25") + row("29", "12.25")),
      isin,
    ),
    [
      { date: "2026-10-29", price: 12.25 },
      { date: "2026-10-30", price: 1234.5 },
    ],
  );
});
test("rejects wrong share class, currency, empty pages, future and invalid prices", () => {
  for (const content of [
    html(row("30", "12"), "IE00BYX5MD61:EUR"),
    html(row("30", "12"), isin + ":USD"),
    html(""),
    html(row("30", "NaN")),
    html(row("30", "0")),
    html(row("30", "12") + row("30", "13")),
  ])
    assert.throws(() => parseHistory(content, isin));
  assert.throws(() => parseHistory(html(row("30", "12")), isin, "2026-10-01"));
});
test("retrieval retains provenance and never substitutes synthetic values", async () => {
  const result = await retrieve(isin, async (url) => {
    assert.match(url, /IE00BYX5NX33%3AEUR$/);
    return { ok: true, text: async () => html(row("30", "12")) };
  });
  assert.equal(result.currency, "EUR");
  assert.equal(result.source, "retrieved");
  assert.equal(result.prices[0].price, 12);
  await assert.rejects(retrieve("US0000000000"), /four configured/);
  await assert.rejects(
    retrieve(isin, async () => ({ ok: false, status: 403 })),
    /HTTP 403/,
  );
  await assert.rejects(
    retrieve(isin, async () => {
      throw Error("proxy");
    }),
    /network settings/,
  );
});
