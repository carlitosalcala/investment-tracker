const { fetch, EnvHttpProxyAgent } = require("undici");
const dispatcher = new EnvHttpProxyAgent();
const listings = {
  "ASML.AS": { ticker: "ASML", exchange: "Euronext Amsterdam", currency: "EUR", yahooExchange: "AMS" },
  "IBE.MC": { ticker: "IBE", exchange: "Madrid", currency: "EUR", yahooExchange: "MCE" },
  "NOVN.SW": { ticker: "NOVN", exchange: "SIX Swiss Exchange", currency: "CHF", yahooExchange: "EBS" },
  "ITX.MC": { ticker: "ITX", exchange: "Madrid", currency: "EUR", yahooExchange: "MCE" },
  DIS: { ticker: "DIS", exchange: "NYSE", currency: "USD", yahooExchange: "NYQ" },
  "AIR.PA": { ticker: "AIR", exchange: "Euronext Paris", currency: "EUR", yahooExchange: "PAR" },
};
async function retrieveStock(symbol, request = fetch, now = new Date()) {
  const expected = listings[symbol];
  if (!expected) throw Object.assign(Error("Unsupported stock listing."), { status: 400 });
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?range=5y&interval=1d&events=splits`;
  let response;
  try {
    response = await request(url, { dispatcher, signal: AbortSignal.timeout(20000), headers: { Accept: "application/json" } });
  } catch { throw Error("Cannot reach Yahoo Finance. Saved prices have been retained."); }
  if (!response.ok) throw Error(`Yahoo Finance returned HTTP ${response.status}. Saved prices have been retained.`);
  let chart;
  try { chart = (await response.json()).chart; } catch { throw Error("Yahoo Finance returned invalid data."); }
  const result = chart?.result?.[0], meta = result?.meta;
  if (chart?.error || meta?.symbol !== symbol || meta.currency !== expected.currency || meta.exchangeName !== expected.yahooExchange || meta.instrumentType !== "EQUITY")
    throw Error("Yahoo Finance could not confirm the selected listing and currency.");
  if (!Array.isArray(result.timestamp) || !Array.isArray(result.indicators?.quote?.[0]?.close) || !meta.exchangeTimezoneName)
    throw Error("Yahoo Finance returned incomplete price history.");
  const closes = result.indicators.quote[0].close;
  if (closes.length !== result.timestamp.length) throw Error("Yahoo Finance returned inconsistent price history.");
  const dateInExchange = (value) => new Intl.DateTimeFormat("en-CA", { timeZone: meta.exchangeTimezoneName, year: "numeric", month: "2-digit", day: "2-digit" }).format(value);
  const today = dateInExchange(now), seen = new Set(), prices = [];
  for (let i = 0; i < closes.length; i++) {
    if (closes[i] == null) continue;
    if (!Number.isFinite(closes[i]) || closes[i] <= 0 || !Number.isFinite(result.timestamp[i])) throw Error("Yahoo Finance returned invalid prices.");
    const date = dateInExchange(new Date(result.timestamp[i] * 1000));
    if (date >= today) continue;
    if (seen.has(date)) throw Error("Yahoo Finance returned duplicate dates.");
    seen.add(date);
    prices.push({ date, price: closes[i] });
  }
  if (!prices.length) throw Error("Yahoo Finance returned no completed daily prices.");
  prices.sort((a, b) => a.date.localeCompare(b.date));
  return { symbol, ...expected, source: "retrieved", sourceId: url, seriesType: "raw", fetchedAt: now.toISOString(), prices };
}
module.exports = { listings, retrieveStock };
