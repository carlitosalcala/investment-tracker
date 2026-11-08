const cheerio = require("cheerio");
const { fetch, EnvHttpProxyAgent } = require("undici");
const dispatcher = new EnvHttpProxyAgent();
const catalog = {
  IE00BYX5NX33: {
    name: "Fidelity MSCI World Index Fund P EUR Acc",
    inception: "2018-03-20",
    identityUrl:
      "https://www.fidelityinternational.com/FILPS/Documents/en/current/ret.en.xx.IE00BYX5NX33.pdf",
  },
  IE00BYX5MD61: {
    name: "Fidelity MSCI Europe Index Fund P EUR Acc",
    inception: "2018-03-20",
    identityUrl:
      "https://www.fidelityinternational.com/FILPS/Documents/fr/current/ret.fr.xx.IE00BYX5MD61.pdf",
  },
  IE000QAZP7L2: {
    name: "iShares Emerging Markets Index Fund (IE) S EUR Acc",
    inception: "2025-08-21",
    identityUrl: "https://www.ishares.com/uk/individual/en/products/345276/",
  },
  IE000ZYRH0Q7: {
    name: "iShares Developed World Index Fund (IE) S EUR Acc",
    inception: "2025-08-21",
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
  const initialPrices = parseHistory(html, isin);
  const $ = cheerio.load(html);
  let xid;
  $("section.mod-tearsheet-add-to-watchlist[data-mod-config]").each(
    (_, element) => {
      try {
        const config = JSON.parse($(element).attr("data-mod-config"));
        if (/^\d+$/.test(String(config.xid))) xid = String(config.xid);
      } catch {
        /* Ignore unrelated invalid configuration. */
      }
    },
  );
  if (!xid)
    throw Error(
      "The provider did not supply a history identifier. Existing history has been retained.",
    );
  const currentYear = new Date().getUTCFullYear();
  const startYear = Number(catalog[isin].inception.slice(0, 4));
  const histories = await Promise.all(
    Array.from({ length: currentYear - startYear + 1 }, async (_, offset) => {
      const year = startYear + offset;
      const end =
        year === currentYear
          ? new Date().toISOString().slice(0, 10).replaceAll("-", "/")
          : `${year}/12/31`;
      const query = new URLSearchParams({
        startDate: `${year}/01/01`,
        endDate: end,
        symbol: xid,
      });
      let result;
      try {
        result = await request(
          `https://markets.ft.com/data/equities/ajax/get-historical-prices?${query}`,
          {
            dispatcher,
            signal: AbortSignal.timeout(20000),
            headers: {
              "User-Agent": "InvestmentJournal/1.0",
              Accept: "application/json",
            },
          },
        );
      } catch {
        throw Error(
          `Could not retrieve history for ${year}. Existing history has been retained.`,
        );
      }
      if (!result.ok)
        throw Error(
          `Price provider returned HTTP ${result.status} for ${year}. Existing history has been retained.`,
        );
      let data;
      try {
        data = JSON.parse(await result.text());
      } catch {
        throw Error(`Invalid history response for ${year}.`);
      }
      if (typeof data.html !== "string" || data.html.length > 5_000_000)
        throw Error(`Invalid history response for ${year}.`);
      // The endpoint returns table rows without the instrument label or headings.
      const fragment = cheerio.load(`<table>${data.html}</table>`);
      if (!fragment("tr").length)
        throw Error(
          `No history returned for ${year}. Existing history has been retained.`,
        );
      const table = /<table\b/i.test(data.html)
        ? data.html
        : `<table><thead><tr><th>Date</th><th>Open</th><th>High</th><th>Low</th><th>Close</th><th>Volume</th></tr></thead><tbody>${data.html}</tbody></table>`;
      const points = parseHistory(
        `<body><div>${isin}:EUR</div>${table}</body>`,
        isin,
      );
      if (points.some((point) => !point.date.startsWith(String(year))))
        throw Error(`Unexpected date in ${year} history.`);
      return points;
    }),
  );
  const merged = new Map(
    initialPrices.map((point) => [point.date, point.price]),
  );
  histories.flat().forEach((point) => {
    if (merged.has(point.date) && merged.get(point.date) !== point.price)
      throw Error("Provider returned conflicting observations.");
    merged.set(point.date, point.price);
  });
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
    prices: [...merged]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, price]) => ({ date, price })),
    note: "FT daily closing NAV/price, requested from share-class inception. Coverage depends on provider availability. No interpolation or total-return adjustment.",
  };
}
module.exports = { catalog, parseHistory, retrieve };
