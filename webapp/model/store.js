sap.ui.define(["./finance"], function (F) {
  "use strict";
  const key = "investment-tracker.v1";
  function seed() {
    const isins = [
      "IE00BYX5NX33",
      "IE00BYX5MD61",
      "IE000QAZP7L2",
      "IE000ZYRH0Q7",
    ];
    return {
      version: 1,
      preferences: { currency: "EUR", theme: "sap_horizon_dark" },
      purchases: [],
      assets: isins.map((isin, i) => ({
        id: isin,
        isin,
        name: [
          "Fidelity MSCI World Index Fund P EUR Acc",
          "Fidelity MSCI Europe Index Fund P EUR Acc",
          "iShares Emerging Markets Index Fund (IE) S EUR Acc",
          "iShares Developed World Index Fund (IE) S EUR Acc",
        ][i],
        type: "Fund",
        ticker: "",
        exchange: "",
        currency: "EUR",
        source: "unavailable",
        sourceId: isin,
        seriesType: "raw",
        benchmark: "",
        archived: false,
        prices: [],
        note: "EUR accumulating share class; retrieve prices to populate history",
      })),
    };
  }
  return {
    seed,
    load() {
      const raw = localStorage.getItem(key);
      return raw ? F.restore(raw) : seed();
    },
    save(d) {
      localStorage.setItem(key, JSON.stringify(d));
    },
    demo(d) {
      d.assets.forEach((a, i) => {
        if (a.source !== "unavailable") return;
        a.source = "demo";
        a.prices = [];
        for (let n = 0; n < 540; n++) {
          const day = new Date(Date.UTC(2025, 0, 1 + n));
          if ([0, 6].includes(day.getUTCDay())) continue;
          a.prices.push({
            date: day.toISOString().slice(0, 10),
            price:
              100 *
              Math.exp(
                n * (0.0002 + i * 0.00008) + Math.sin(n / 23 + i) * 0.035,
              ),
          });
        }
      });
      return d;
    },
  };
});
