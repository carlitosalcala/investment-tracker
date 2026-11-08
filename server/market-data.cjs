const cheerio = require("cheerio");
const { fetch, EnvHttpProxyAgent } = require("undici");
const dispatcher = new EnvHttpProxyAgent();
const catalog = {
  IE00BYX5NX33: {
    name: "Fidelity MSCI World Index Fund P EUR Acc",
    identityUrl:
      "https://www.fidelityinternational.com/FILPS/Documents/en/current/ret.en.xx.IE00BYX5NX33.pdf",
  },
  IE00BYX5MD61: {
    name: "Fidelity MSCI Europe Index Fund P EUR Acc",
    identityUrl:
      "https://www.fidelityinternational.com/FILPS/Documents/fr/current/ret.fr.xx.IE00BYX5MD61.pdf",
  },
  IE000QAZP7L2: {
    name: "iShares Emerging Markets Index Fund (IE) S EUR Acc",
    identityUrl: "https://www.ishares.com/uk/individual/en/products/345276/",
  },
  IE000ZYRH0Q7: {
    name: "iShares Developed World Index Fund (IE) S EUR Acc",
    identityUrl: "https://www.ishares.com/uk/individual/en/products/345277/",
  },
};
const months = {
  Jan: 1,
  Feb: 2,
  Mar: 3,
  Apr: 4,
  May: 5,
  Jun: 6,
  Jul: 7,
  Aug: 8,
  Sep: 9,
  Oct: 10,
  Nov: 11,
  Dec: 12,
};
function parseHistory(
  html,
  isin,
  today = new Date().toISOString().slice(0, 10),
) {
  const $ = cheerio.load(html);
  // Require the exact instrument and denomination; never fall back to a similarly named fund.
  if (!$("body").text().includes(`${isin}:EUR`))
    throw Error(
      "Provider did not confirm the requested ISIN and EUR share class.",
    );
  const table = $("table")
    .filter((_, el) => {
      const headings = $(el)
        .find("thead th")
        .map((_, th) => $(th).text().trim())
        .get();
      return headings[0] === "Date" && headings.includes("Close");
    })
    .first();
  const headings = table
    .find("thead th")
    .map((_, th) => $(th).text().trim())
    .get();
  const closeIndex = headings.indexOf("Close");
  const prices = new Map();
  table.find("tbody tr").each((_, row) => {
    const cells = $(row).find("td");
    // FT renders both a long and a responsive date in the same cell.
    const text = cells.first().text();
    const match = text.match(/\b([A-Z][a-z]{2})[a-z]*\s+(\d{1,2}),?\s+(\d{4})/);
    const raw = cells.eq(closeIndex).text().trim();
    if (!match || !months[match[1]] || !/^\d[\d,]*(\.\d+)?$/.test(raw))
      throw Error("Provider returned an invalid price row.");
    const date = `${match[3]}-${String(months[match[1]]).padStart(2, "0")}-${match[2].padStart(2, "0")}`;
    const price = Number(raw.replaceAll(",", ""));
    if (
      new Date(date).toISOString().slice(0, 10) !== date ||
      date > today ||
      !Number.isFinite(price) ||
      price <= 0
    )
      throw Error("Provider returned an invalid observation.");
    if (prices.has(date) && prices.get(date) !== price)
      throw Error("Provider returned conflicting observations.");
    prices.set(date, price);
  });
  if (!prices.size)
    throw Error(
      "No daily prices were returned. Existing history has been retained.",
    );
  return [...prices]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, price]) => ({ date, price }));
}
async function retrieve(isin, request = fetch) {
  if (!Object.hasOwn(catalog, isin))
    throw Object.assign(
      Error("Automatic retrieval supports only the four configured ISINs."),
      { status: 400 },
    );
  const url = `https://markets.ft.com/data/funds/tearsheet/historical?s=${isin}%3AEUR`;
  let response;
  try {
    response = await request(url, {
      dispatcher,
      signal: AbortSignal.timeout(20000),
      headers: { "User-Agent": "InvestmentJournal/1.0", Accept: "text/html" },
    });
  } catch {
    throw Error(
      "Cannot reach the price provider. Check internet access and allow markets.ft.com in the server network settings.",
    );
  }
  if (!response.ok)
    throw Error(
      `Price provider returned HTTP ${response.status}. Existing history has been retained.`,
    );
  const html = await response.text();
  if (html.length > 5_000_000) throw Error("Provider response is too large.");
  return {
    ...catalog[isin],
    isin,
    currency: "EUR",
    distribution: "Accumulating",
    type: "Fund",
    source: "retrieved",
    sourceId: url,
    seriesType: "raw",
    fetchedAt: new Date().toISOString(),
    prices: parseHistory(html, isin),
    note: "FT daily closing NAV/price; recent provider window only. No interpolation or total-return adjustment.",
  };
}
module.exports = { catalog, parseHistory, retrieve };
