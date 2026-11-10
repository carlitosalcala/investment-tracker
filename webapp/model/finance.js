/* Shared pure calculations. Dates are ISO calendar dates, never local instants. */
(function (factory) {
  if (typeof module === "object") module.exports = factory();
  else sap.ui.define([], factory);
})(function () {
  "use strict";
  function newId() {
    if (typeof globalThis.crypto.randomUUID === "function")
      return globalThis.crypto.randomUUID();
    // getRandomValues is also available on HTTP LAN origins.
    const bytes = globalThis.crypto.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0"));
    return [
      hex.slice(0, 4),
      hex.slice(4, 6),
      hex.slice(6, 8),
      hex.slice(8, 10),
      hex.slice(10),
    ]
      .map((part) => part.join(""))
      .join("-");
  }
  const periods = ["1D", "5D", "30D", "6M", "YTD", "1Y", "All", "Custom"];
  const iso = (d) => d.toISOString().slice(0, 10);
  function date(s) {
    return (
      typeof s === "string" &&
      /^\d{4}-\d{2}-\d{2}$/.test(s) &&
      Number.isFinite(Date.parse(s)) &&
      iso(new Date(s)) === s
    );
  }
  function positive(n) {
    return typeof n === "number" && Number.isFinite(n) && n > 0;
  }
  function observations(rows) {
    if (!Array.isArray(rows)) throw Error("invalidPrices");
    const seen = new Set();
    return rows
      .map((r) => {
        if (!date(r.date) || !positive(r.price) || seen.has(r.date))
          throw Error("invalidPrices");
        seen.add(r.date);
        return { date: r.date, price: r.price };
      })
      .sort((a, b) => a.date.localeCompare(b.date));
  }
  function at(rows, d) {
    return rows.filter((r) => r.date <= d).at(-1);
  }
  function boundary(end, p) {
    const d = new Date(end + "T00:00:00Z");
    if (p === "YTD") return d.getUTCFullYear() - 1 + "-12-31";
    if (p === "30D") d.setUTCDate(d.getUTCDate() - 30);
    if (["1M", "3M", "6M", "1Y"].includes(p)) {
      const day = d.getUTCDate();
      d.setUTCDate(1);
      d.setUTCMonth(
        d.getUTCMonth() - { "1M": 1, "3M": 3, "6M": 6, "1Y": 12 }[p],
      );
      const last = new Date(
        Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0),
      ).getUTCDate();
      d.setUTCDate(Math.min(day, last));
    }
    return iso(d);
  }
  function compare(assets, period, from, to) {
    const usable = assets.filter((a) => a.prices.length);
    if (!usable.length)
      return { dates: [], series: [], start: null, end: null };
    const today = iso(new Date());
    const requestedEnd =
      (/^\d{4}$/.test(period) ? period + "-12-31" : to) ||
      usable.map((a) => a.prices.at(-1).date).sort()[0];
    const end = requestedEnd > today ? today : requestedEnd;
    const common = usable
      .map((a) => a.prices[0].date)
      .sort()
      .at(-1);
    const calendars = usable.map(
      (a) =>
        new Set(
          a.prices
            .filter((r) => r.date <= end && r.date >= common)
            .map((r) => r.date),
        ),
    );
    const shared = [...calendars[0]]
      .filter((d) => calendars.every((s) => s.has(d)))
      .sort();
    if (!shared.length)
      return { dates: [], series: [], start: null, end: null };
    let start;
    if (period === "1D" || period === "5D")
      start =
        shared[Math.max(0, shared.length - 1 - (period === "1D" ? 1 : 5))];
    else if (period === "All") start = shared[0];
    else if (/^\d{4}$/.test(period))
      start =
        shared.filter((d) => d <= +period - 1 + "-12-31").at(-1) || shared[0];
    else {
      const target = period === "Custom" ? from : boundary(end, period);
      start = shared.filter((d) => d <= target).at(-1) || shared[0];
    }
    const dates = shared.filter((d) => d >= start);
    return {
      start,
      end: dates.at(-1),
      dates,
      series: usable.map((a) => {
        const base = at(a.prices, start);
        const values = dates.map(
          (d) => (at(a.prices, d).price / base.price - 1) * 100,
        );
        return { id: a.id, label: a.name, values, return: values.at(-1) };
      }),
    };
  }
  function validateAsset(a, others = []) {
    if (
      !a ||
      typeof a.id !== "string" ||
      typeof a.name !== "string" ||
      !a.id ||
      !a.name?.trim() ||
      !["Fund", "ETF", "Stock"].includes(a.type) ||
      !/^[A-Z]{3}$/.test(a.currency) ||
      (!a.isin && !a.ticker)
    )
      throw Error("invalidAsset");
    if (a.isin && !/^[A-Z]{2}[A-Z0-9]{9}\d$/.test(a.isin))
      throw Error("invalidAsset");
    if (
      others.some(
        (b) =>
          b.id !== a.id &&
          ((a.isin && b.isin === a.isin) ||
            (a.ticker &&
              b.ticker?.toUpperCase() === a.ticker.toUpperCase() &&
              (b.exchange || "").toUpperCase() ===
                (a.exchange || "").toUpperCase())),
      )
    )
      throw Error("duplicateAsset");
    if (
      !["demo", "imported", "unavailable", "verified", "retrieved"].includes(
        a.source,
      ) ||
      !["raw", "adjusted", "totalReturn"].includes(a.seriesType)
    )
      throw Error("invalidAsset");
    a.prices = observations(a.prices || []);
    return a;
  }
  function validatePurchase(p, assets) {
    const a = assets.find((a) => a.id === p.assetId);
    if (
      !p.id ||
      !a ||
      !date(p.date) ||
      p.date > iso(new Date()) ||
      !positive(p.price) ||
      !positive(p.quantity) ||
      !Number.isFinite(p.fees) ||
      p.fees < 0 ||
      p.currency !== a.currency
    )
      throw Error("invalidPurchase");
    return p;
  }
  function quantity(amount, price, fees) {
    if (
      !positive(amount) ||
      !positive(price) ||
      !Number.isFinite(fees) ||
      fees < 0 ||
      amount <= fees
    )
      throw Error("invalidPurchase");
    return (amount - fees) / price;
  }
  function portfolio(assets, purchases, day = iso(new Date())) {
    return assets
      .map((a) => {
        const ps = purchases.filter((p) => p.assetId === a.id && p.date <= day);
        const quantity = ps.reduce((s, p) => s + p.quantity, 0),
          cost = ps.reduce((s, p) => s + p.price * p.quantity + p.fees, 0);
        const nav = at(a.prices, day);
        const value = quantity ? (nav ? quantity * nav.price : null) : 0;
        return {
          id: a.id,
          name: a.name,
          currency: a.currency,
          quantity,
          cost,
          value,
          gain: value === null ? null : value - cost,
          valuationDate: nav?.date || "",
          source: a.source,
        };
      })
      .filter((h) => h.quantity > 0);
  }
  function years(a) {
    const ys = [...new Set(a.prices.map((r) => r.date.slice(0, 4)))];
    return ys.map((y) => {
      const boundaryPrice = at(a.prices, +y - 1 + "-12-31"),
        first = boundaryPrice || a.prices.find((r) => r.date.startsWith(y)),
        last = at(a.prices, y + "-12-31");
      return {
        year: y,
        return:
          first && last && first.date !== last.date
            ? (last.price / first.price - 1) * 100
            : null,
        incomplete:
          !boundaryPrice ||
          !last ||
          (last.date !== y + "-12-31" &&
            a.prices.at(-1).date < +y + 1 + "-01-01"),
      };
    });
  }
  function portfolioMonths(assets, purchases, today = iso(new Date())) {
    const eligible = purchases.filter((p) => p.date <= today && assets.some((a) => a.id === p.assetId));
    const currencies = [...new Set(eligible.map((p) => p.currency))].sort();
    const total = (currency, day) => {
      const rows = portfolio(assets, eligible, day).filter((h) => h.currency === currency);
      return rows.some((h) => h.value === null) ? null : rows.reduce((sum, h) => sum + h.value, 0);
    };
    const now = new Date(today + "T00:00:00Z");
    return Array.from({ length: 12 }, (_, i) => {
      const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
      const month = iso(start).slice(0, 7);
      const end = iso(new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0)));
      const previous = iso(new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 0)));
      return currencies.map((currency) => {
        const value = total(currency, end > today ? today : end);
        const opening = total(currency, previous);
        const contributed = eligible.filter((p) => p.currency === currency && p.date.startsWith(month))
          .reduce((sum, p) => sum + p.price * p.quantity + p.fees, 0);
        const change = value === null || opening === null ? null : value - opening;
        return { month, currency, partial: end > today, purchases: contributed, value, change,
          gain: change === null ? null : change - contributed };
      });
    }).flat();
  }
  function csv(text) {
    const lines = text
      .replace(/^\uFEFF/, "")
      .trim()
      .split(/\r?\n/);
    if (lines.shift()?.trim() !== "date,price") throw Error("invalidCSV");
    return observations(
      lines
        .filter((l) => l.trim())
        .map((l) => {
          const c = l.split(",");
          if (c.length !== 2) throw Error("invalidCSV");
          return { date: c[0].trim(), price: Number(c[1]) };
        }),
    );
  }
  function restore(text) {
    const d = JSON.parse(text);
    if (
      d.version !== 1 ||
      !Array.isArray(d.assets) ||
      !Array.isArray(d.purchases) ||
      !d.preferences ||
      d.preferences.currency !== "EUR"
    )
      throw Error("invalidBackup");
    const ids = new Set();
    d.assets.forEach((a) => {
      if (ids.has(a.id)) throw Error("invalidBackup");
      ids.add(a.id);
      validateAsset(a, d.assets);
    });
    const ps = new Set();
    d.purchases.forEach((p) => {
      if (ps.has(p.id)) throw Error("invalidBackup");
      ps.add(p.id);
      validatePurchase(p, d.assets);
    });
    return d;
  }
  return {
    newId,
    periods,
    date,
    observations,
    at,
    boundary,
    compare,
    validateAsset,
    validatePurchase,
    quantity,
    portfolio,
    portfolioMonths,
    years,
    csv,
    restore,
  };
});
