sap.ui.define(
  [
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/ui/core/Theming",
    "sap/m/MessageBox",
    "sap/m/MessageToast",
    "sap/m/Dialog",
    "sap/m/Button",
    "sap/m/Input",
    "sap/m/Label",
    "sap/m/VBox",
    "sap/m/Select",
    "sap/ui/core/Item",
    "sap/m/DatePicker",
    "tracker/model/finance",
    "tracker/model/store",
  ],
  function (
    Controller,
    JSONModel,
    Theming,
    MessageBox,
    Toast,
    Dialog,
    Button,
    Input,
    Label,
    VBox,
    Select,
    Item,
    DatePicker,
    F,
    Store,
  ) {
    "use strict";
    const fmt = (n) =>
      n === null || n === undefined
        ? "—"
        : new Intl.NumberFormat("en", { maximumFractionDigits: 4 }).format(n);
    return Controller.extend("tracker.controller.Main", {
      onInit() {
        this.vm = new JSONModel({
          section: "dashboard",
          theme: this.data().preferences.theme || "sap_horizon_dark",
          period: "All",
          periodSort: "period",
          yearSort: "year",
          historySort: "date",
          portfolioFrom: "",
          portfolioTo: "",
          purchaseAsset: "",
          periods: F.periods.map((key) => ({ key })),
          from: "2025-01-01",
          to: new Date().toISOString().slice(0, 10),
        });
        this.vm.setSizeLimit(1000000);
        this.getView().setModel(this.vm, "vm");
        Theming.setTheme(this.vm.getProperty("/theme"));
        this.getOwnerComponent()
          .getRouter()
          .attachRouteMatched((e) => {
            const s = e.getParameter("arguments").section || "dashboard";
            this.vm.setProperty(
              "/section",
              ["assets", "portfolio"].includes(s) ? s : "dashboard",
            );
          });
        this.refresh();
        if (this.data().loadError) MessageBox.error(this.t("loadError"));
        else this.onRetrievePrices(null, true);
      },
      t(k) {
        return this.getOwnerComponent()
          .getModel("i18n")
          .getResourceBundle()
          .getText(k);
      },
      data() {
        return this.getOwnerComponent().getModel().getData();
      },
      save() {
        try {
          Store.save(this.data());
          this.getOwnerComponent().getModel().refresh(true);
          this.refresh();
        } catch (e) {
          MessageBox.error(this.t("saveError"));
        }
      },
      onThemeChange(e) {
        const theme = e.getSource().getSelectedKey();
        this.data().preferences.theme = theme;
        Theming.setTheme(theme);
        this.vm.setProperty("/theme", theme);
        this.save();
        this.byId("returnsChart").invalidate();
        this.byId("differenceChart").invalidate();
      },
      onNavigate(e) {
        this.getOwnerComponent()
          .getRouter()
          .navTo("section", { section: e.getParameter("item").getKey() });
      },
      onSelection() {
        this.refresh();
      },
      onPortfolioSelection(e) {
        this.portfolioSelected = new Set(e.getSource().getSelectedKeys());
        this.refresh();
      },
      onPortfolioRangeChange(e) {
        this.vm.setProperty(
          e.getSource() === this.byId("portfolioFrom") ? "/portfolioFromInvalid" : "/portfolioToInvalid",
          !e.getParameter("valid"),
        );
        this.refresh();
      },
      onPortfolioRangeReset() {
        for (const key of ["portfolioFrom", "portfolioTo"]) {
          this.vm.setProperty("/" + key, "");
          this.vm.setProperty("/" + key + "Invalid", false);
          this.byId(key).setValue("");
        }
        this.refresh();
      },
      onPortfolioQuickRange(e) {
        const period = e.getSource().data("period");
        const today = new Date().toISOString().slice(0, 10);
        const week = new Date(today + "T00:00:00Z");
        week.setUTCDate(week.getUTCDate() - 7);
        const from = period === "1W"
          ? week.toISOString().slice(0, 10)
          : F.boundary(today, period);
        for (const [key, value] of [["portfolioFrom", from], ["portfolioTo", today]]) {
          this.vm.setProperty("/" + key, value);
          this.vm.setProperty("/" + key + "Invalid", false);
          this.byId(key).setValue(value);
        }
        this.refresh();
      },
      refresh() {
        const d = this.data(),
          v = this.vm;
        const active = d.assets.filter((a) => !a.archived);
        v.setProperty("/activeAssets", active);
        const years = [
          ...new Set(
            active.flatMap((a) => a.prices.map((p) => p.date.slice(0, 4))),
          ),
        ]
          .sort()
          .reverse();
        v.setProperty(
          "/periods",
          [...F.periods, ...years].map((key) => ({ key })),
        );
        const keys = this.byId("selection").getSelectedKeys();
        const selected = active.filter((a) => keys.includes(a.id));
        const p = v.getProperty("/period");
        let result = F.compare(
          selected,
          p,
          p === "Custom" ? v.getProperty("/from") : null,
          p === "Custom" ? v.getProperty("/to") : null,
        );
        v.setProperty("/chart", result);
        v.setProperty(
          "/comparisonDates",
          result.start ? result.start + " → " + result.end : this.t("noData"),
        );
        const sources = new Set(
          selected.filter((a) => a.prices.length).map((a) => a.source),
        );
        v.setProperty(
          "/comparisonStatus",
          sources.has("demo")
            ? this.t("demoWarning")
            : this.t("comparisonRule"),
        );
        v.setProperty(
          "/summary",
          selected.map((a) => {
            const last = a.prices.at(-1),
              s = result.series.find((s) => s.id === a.id);
            let b = this.t("benchmarkUnavailable");
            if (a.benchmark) {
              const target = d.assets.find((x) => x.id === a.benchmark);
              if (
                target &&
                target.source === a.source &&
                target.currency === a.currency &&
                target.seriesType === a.seriesType
              ) {
                const c = F.compare(
                  [a, target],
                  p,
                  p === "Custom" ? v.getProperty("/from") : null,
                  p === "Custom" ? v.getProperty("/to") : null,
                );
                if (c.dates.length > 1)
                  b =
                    fmt(c.series[0].return - c.series[1].return) +
                    " pp (" +
                    c.start +
                    " → " +
                    c.end +
                    ")";
              }
            }
            return {
              name: a.name,
              price: fmt(last?.price),
              currency: a.currency,
              date: last?.date || "—",
              performance:
                s && result.dates.length > 1 ? fmt(s.return) + "%" : "—",
              status: this.t(a.source),
              benchmark: b,
            };
          }),
        );
        const validBenchmark = (a) => {
          const b = d.assets.find((asset) => asset.id === a.benchmark);
          return b &&
            b.prices.length &&
            b.source === a.source &&
            b.currency === a.currency &&
            b.seriesType === a.seriesType
            ? b
            : null;
        };
        const pair = selected
          .map((a) => [a, validBenchmark(a)])
          .find(([a, b]) => a.prices.length && b);
        const difference = pair
          ? F.compare(
              pair,
              p,
              p === "Custom" ? v.getProperty("/from") : null,
              p === "Custom" ? v.getProperty("/to") : null,
            )
          : null;
        v.setProperty(
          "/differenceChart",
          difference && difference.series.length === 2
            ? {
                dates: difference.dates,
                series: [
                  {
                    label: pair[0].name + " − " + pair[1].name,
                    values: difference.series[0].values.map(
                      (value, i) => value - difference.series[1].values[i],
                    ),
                  },
                ],
              }
            : { dates: [], series: [] },
        );
        v.setProperty("/differenceAvailable", !!difference?.dates.length);
        const periodRows = selected.flatMap((a) => {
          if (!a.prices.length) return [];
          const benchmark = validBenchmark(a);
          const years = F.years(a).reverse();
          const periods = [
            { key: "1M", label: "1M" },
            { key: "3M", label: "3M" },
            { key: "6M", label: "6M" },
            { key: "YTD", label: "YTD" },
            { key: "1Y", label: "1Y" },
            { key: "All", label: this.t("sinceFirst") },
          ].concat(
            years.map((y) => ({
              key: y.year,
              label: y.year,
              partial: y.incomplete,
            })),
          );
          return periods.map((period) => {
            const comparison = F.compare(
              benchmark ? [a, benchmark] : [a],
              period.key,
            );
            const enough = comparison.dates.length > 1;
            const fund = enough ? comparison.series[0].return : null;
            const index =
              enough && benchmark ? comparison.series[1].return : null;
            const earliest = benchmark
              ? [a.prices[0].date, benchmark.prices[0].date].sort().at(-1)
              : a.prices[0].date;
            const target =
              period.key === "All"
                ? null
                : /^\d{4}$/.test(period.key)
                  ? +period.key - 1 + "-12-31"
                  : F.boundary(
                      comparison.end || a.prices.at(-1).date,
                      period.key,
                    );
            const partial = period.partial || (target && target < earliest);
            return {
              name: a.name,
              periodKey: period.key,
              period: period.label + (partial ? " *" : ""),
              fund: fund === null ? "—" : fmt(fund) + "%",
              index: index === null ? "—" : fmt(index) + "%",
              difference:
                fund === null || index === null
                  ? "—"
                  : fmt(fund - index) + " pp",
              dates: comparison.start
                ? comparison.start + " → " + comparison.end
                : "—",
            };
          });
        });
        const periodRank = (key) => {
          const standard = ["1M", "3M", "6M", "YTD", "1Y", "All"];
          const index = standard.indexOf(key);
          return index >= 0 ? index : standard.length + 9999 - Number(key);
        };
        const byPeriod = (a, b) =>
          periodRank(a.periodKey) - periodRank(b.periodKey);
        const byName = (a, b) => a.name.localeCompare(b.name);
        periodRows.sort(
          v.getProperty("/periodSort") === "asset"
            ? (a, b) => byName(a, b) || byPeriod(a, b)
            : (a, b) => byPeriod(a, b) || byName(a, b),
        );
        v.setProperty("/periodRows", periodRows);
        v.setProperty(
          "/years",
          selected
            .flatMap((a) =>
              F.years(a).map((y) => ({
                name: a.name,
                year: y.year,
                performance: y.return === null ? "—" : fmt(y.return) + "%",
                coverage: this.t(y.incomplete ? "incomplete" : "complete"),
              })),
            )
            .sort((a, b) => {
              const byYear = b.year.localeCompare(a.year);
              const byAsset = a.name.localeCompare(b.name);
              return v.getProperty("/yearSort") === "asset"
                ? byAsset || byYear
                : byYear || byAsset;
            }),
        );
        v.setProperty(
          "/history",
          selected
            .flatMap((a) =>
              a.prices.map((r) => ({
                name: a.name,
                date: r.date,
                price: r.price,
                status: this.t(a.source),
              })),
            )
            .sort((a, b) => {
              const byDate = b.date.localeCompare(a.date);
              const byAsset = a.name.localeCompare(b.name);
              return v.getProperty("/historySort") === "asset"
                ? byAsset || byDate
                : byDate || byAsset;
            }),
        );
        const portfolioOptions = d.assets.filter((a) => d.purchases.some((p) => p.assetId === a.id));
        const currentIds = new Set(portfolioOptions.map((a) => a.id));
        if (!this.portfolioSelected) this.portfolioSelected = new Set(currentIds);
        else for (const id of currentIds) if (!this.portfolioKnown?.has(id)) this.portfolioSelected.add(id);
        this.portfolioSelected = new Set([...this.portfolioSelected].filter((id) => currentIds.has(id)));
        this.portfolioKnown = currentIds;
        v.setProperty("/portfolioAssets", portfolioOptions);
        this.byId("portfolioSelection").setSelectedKeys([...this.portfolioSelected]);
        const portfolioAssets = d.assets.filter((a) => this.portfolioSelected.has(a.id));
        const portfolioPurchases = d.purchases.filter((p) => this.portfolioSelected.has(p.assetId));
        v.setProperty("/portfolioPurchases", portfolioPurchases);
        const purchaseAssets = portfolioOptions
          .filter((a) => this.portfolioSelected.has(a.id))
          .map((a) => ({ key: a.id, name: a.name }))
          .sort((a, b) => a.name.localeCompare(b.name));
        let purchaseAsset = v.getProperty("/purchaseAsset");
        if (purchaseAsset && !purchaseAssets.some((a) => a.key === purchaseAsset)) {
          purchaseAsset = "";
          v.setProperty("/purchaseAsset", "");
        }
        v.setProperty("/purchaseAssetOptions", [
          { key: "", name: this.t("allPurchaseAssets") },
          ...purchaseAssets,
        ]);
        v.setProperty("/purchaseRows", portfolioPurchases
          .filter((p) => !purchaseAsset || p.assetId === purchaseAsset)
          .sort((a, b) => b.date.localeCompare(a.date)));
        const hs = F.portfolio(portfolioAssets, portfolioPurchases),
          currencies = [...new Set(hs.map((h) => h.currency))];
        const totals = currencies.map((c) => {
          const rows = hs.filter((h) => h.currency === c),
            cost = rows.reduce((s, h) => s + h.cost, 0),
            complete = rows.every((h) => h.value !== null),
            value = rows.reduce((s, h) => s + (h.value || 0), 0);
          return (
            c +
            ": " +
            this.t("outlay") +
            " " +
            fmt(cost) +
            " · " +
            this.t("value") +
            " " +
            (complete ? fmt(value) : this.t("incomplete")) +
            " · " +
            this.t("gain") +
            " " +
            (complete ? fmt(value - cost) : "—")
          );
        });
        v.setProperty("/totals", totals.join(" | ") || this.t("noPurchases"));
        v.setProperty(
          "/holdings",
          hs.map((h) => {
            const group = hs.filter((x) => x.currency === h.currency),
              total = group.reduce((s, x) => s + (x.value || 0), 0);
            return {
              ...h,
              quantity: fmt(h.quantity),
              cost: fmt(h.cost),
              averagePrice: fmt(h.cost / h.quantity),
              value: fmt(h.value),
              gain: fmt(h.gain),
              source: this.t(h.source),
              allocation:
                group.every((x) => x.value !== null) && total
                  ? fmt((h.value / total) * 100) + "%"
                  : "—",
            };
          }),
        );
        const portfolioFrom = v.getProperty("/portfolioFrom"),
          portfolioTo = v.getProperty("/portfolioTo");
        const invalidRange = v.getProperty("/portfolioFromInvalid") ||
          v.getProperty("/portfolioToInvalid") ||
          (portfolioFrom && !F.date(portfolioFrom)) ||
          (portfolioTo && !F.date(portfolioTo)) ||
          (portfolioFrom && portfolioTo && portfolioFrom > portfolioTo);
        const dates = [
          ...new Set([
            ...portfolioPurchases.map((p) => p.date),
            ...portfolioAssets.flatMap((a) =>
              a.currency === "EUR" ? a.prices.map((p) => p.date) : [],
            ),
          ]),
        ]
          .filter(
            (day) =>
              day <= new Date().toISOString().slice(0, 10) &&
              !invalidRange &&
              (!portfolioFrom || day >= portfolioFrom) &&
              (!portfolioTo || day <= portfolioTo) &&
              portfolioPurchases.some((p) => p.date <= day),
          )
          .sort();
        v.setProperty("/portfolioRangeStatus", invalidRange
          ? this.t("portfolioRangeInvalid")
          : dates.length ? "" : this.t("portfolioRangeEmpty"));
        const eurAssets = portfolioAssets.filter((a) => a.currency === "EUR");
        v.setProperty("/portfolioChart", {
          dates,
          series: [
            {
              label: this.t("valueEUR"),
              values: dates.map((day) => {
                const h = F.portfolio(eurAssets, portfolioPurchases, day);
                return h.some((x) => x.value === null)
                  ? null
                  : h.reduce((s, x) => s + x.value, 0);
              }),
            },
            {
              label: this.t("outlayEUR"),
              values: dates.map((day) =>
                F.portfolio(eurAssets, portfolioPurchases, day).reduce(
                  (s, x) => s + x.cost,
                  0,
                ),
              ),
            },
          ],
        });
        const ys = [...new Set(portfolioPurchases.map((p) => p.date.slice(0, 4)))];
        for (
          let y = +(ys.sort()[0] || new Date().getUTCFullYear());
          y <= new Date().getUTCFullYear();
          y++
        ) {
          if (!ys.includes(String(y))) ys.push(String(y));
        }
        v.setProperty(
          "/portfolioYears",
          ys.sort().flatMap((year) => {
            const day = year + "-12-31",
              hold = F.portfolio(
                portfolioAssets,
                portfolioPurchases,
                day > new Date().toISOString().slice(0, 10)
                  ? new Date().toISOString().slice(0, 10)
                  : day,
              );
            return [...new Set(hold.map((h) => h.currency))].map((currency) => {
              const group = hold.filter((h) => h.currency === currency),
                valid = group.every((h) => h.value !== null),
                value = group.reduce((s, h) => s + (h.value || 0), 0);
              return {
                year:
                  year + (+year === new Date().getUTCFullYear() ? " *" : ""),
                currency,
                purchases: fmt(
                  portfolioPurchases
                    .filter(
                      (p) => p.date.startsWith(year) && p.currency === currency,
                    )
                    .reduce((s, p) => s + p.price * p.quantity + p.fees, 0),
                ),
                value: valid ? fmt(value) : "—",
                gain: valid
                  ? fmt(value - group.reduce((s, h) => s + h.cost, 0))
                  : "—",
              };
            });
          }),
        );
        v.setProperty("/portfolioMonths", F.portfolioMonths(portfolioAssets, portfolioPurchases).map((row) => ({
          month: row.month + (row.partial ? " *" : ""),
          currency: row.currency,
          purchases: fmt(row.purchases),
          value: fmt(row.value),
          change: fmt(row.change),
          changePercent: row.changePercent === null ? "—" : fmt(row.changePercent) + "%",
          gain: fmt(row.gain),
        })));
      },
      confirm(k, fn) {
        MessageBox.confirm(this.t(k), {
          onClose: (a) => {
            if (a === MessageBox.Action.OK) fn();
          },
        });
      },
      async onRetrievePrices(e, automatic = false) {
        if (this.vm.getProperty("/retrieving")) return;
        const row = e?.getSource().getBindingContext()?.getObject();
        const assets = row
          ? [row]
          : this.data().assets.filter(
              (a) =>
                !a.archived &&
                (automatic
                  ? ["unavailable", "retrieved"].includes(a.source)
                  : a.source !== "imported"),
            );
        this.vm.setProperty("/retrieving", true);
        this.vm.setProperty("/retrievalStatus", this.t("retrievingPrices"));
        let count = 0;
        const failures = [];
        try {
          for (const asset of assets) {
            const stockSymbols = { "ASML|Euronext Amsterdam": "ASML.AS", "IBE|Madrid": "IBE.MC", "NOVN|SIX Swiss Exchange": "NOVN.SW", "ITX|Madrid": "ITX.MC", "DIS|NYSE": "DIS", "AIR|Euronext Paris": "AIR.PA" };
            const isStock = asset.type === "Stock";
            const symbol = isStock ? stockSymbols[`${asset.ticker}|${asset.exchange}`] : null;
            if (isStock && !symbol) continue;
            if (!isStock && !asset.isin) continue;
            const initialSource = asset.source;
            const initialIdentity = [asset.type, asset.isin, asset.ticker, asset.exchange, asset.currency].join("|");
            try {
              const response = await fetch(
                (isStock ? "/api/stocks/" + encodeURIComponent(symbol) : "/api/prices/" + encodeURIComponent(asset.isin)),
                { signal: AbortSignal.timeout(60000) },
              );
              const result = await response.json();
              if (!response.ok)
                throw Error(result.error || "Price request failed");
              if (
                (isStock ? result.symbol !== symbol || result.ticker !== asset.ticker || result.exchange !== asset.exchange : result.isin !== asset.isin) ||
                result.currency !== asset.currency ||
                result.source !== "retrieved" ||
                result.seriesType !== "raw"
              )
                throw Error(
                  "Provider identity or currency differs from asset settings.",
                );
              const prices = F.observations(result.prices);
              if (!prices.length) throw Error("Provider returned no prices.");
              // Do not apply a response after a restore, removal, edit or CSV import.
              if (
                !this.data().assets.includes(asset) ||
                [asset.type, asset.isin, asset.ticker, asset.exchange, asset.currency].join("|") !== initialIdentity ||
                asset.source === "imported" ||
                asset.source !== initialSource
              )
                continue;
              const prior =
                asset.source === "retrieved" &&
                asset.sourceId === result.sourceId &&
                asset.seriesType === "raw"
                  ? asset.prices
                  : [];
              const merged = new Map(prior.map((p) => [p.date, p]));
              prices.forEach((p) => merged.set(p.date, p));
              const { symbol: ignoredSymbol, yahooExchange: ignoredExchange, ...marketResult } = result;
              Object.assign(asset, marketResult, {
                prices: F.observations([...merged.values()]),
              });
              count++;
            } catch (error) {
              failures.push((symbol || asset.isin) + ": " + error.message);
            }
          }
          if (count) {
            this.save();
            if (!this.byId("selection").getSelectedKeys().length)
              this.byId("selection").setSelectedKeys(
                assets.filter((a) => a.source === "retrieved").map((a) => a.id),
              );
            this.refresh();
          }
          this.vm.setProperty(
            "/retrievalStatus",
            count +
              " asset(s) updated." +
              (failures.length ? " " + failures.join(" · ") : ""),
          );
        } finally {
          this.vm.setProperty("/retrieving", false);
        }
      },
      onDemo() {
        this.confirm("demoConfirm", () => {
          Store.demo(this.data());
          this.save();
          this.byId("selection").setSelectedKeys(
            this.data()
              .assets.filter((a) => !a.archived)
              .map((a) => a.id),
          );
          this.refresh();
        });
      },
      onClearDemo() {
        this.data()
          .assets.filter((a) => a.source === "demo")
          .forEach((a) => {
            a.prices = [];
            a.source = "unavailable";
          });
        this.save();
      },
      asset(e) {
        return e.getSource().getBindingContext().getObject();
      },
      onAddAsset() {
        this.assetDialog();
      },
      onAddStocks() {
        const listings = [
          ["ASML", "ASML", "Euronext Amsterdam", "EUR"],
          ["Iberdrola", "IBE", "Madrid", "EUR"],
          ["Novartis", "NOVN", "SIX Swiss Exchange", "CHF"],
          ["Inditex", "ITX", "Madrid", "EUR"],
          ["The Walt Disney Company", "DIS", "NYSE", "USD"],
          ["Airbus", "AIR", "Euronext Paris", "EUR"],
        ];
        const assets = this.data().assets;
        let added = 0;
        for (const [name, ticker, exchange, currency] of listings) {
          if (assets.some((a) => a.name.toLowerCase() === name.toLowerCase() || (a.ticker?.toUpperCase() === ticker && (a.exchange || "").toLowerCase() === exchange.toLowerCase()))) continue;
          const asset = { id: F.newId(), name, type: "Stock", isin: "", ticker, exchange, currency, source: "unavailable", sourceId: "", seriesType: "raw", benchmark: "", archived: false, prices: [] };
          F.validateAsset(asset, assets);
          assets.push(asset);
          added++;
        }
        if (added) this.save();
        MessageBox.information(this.t("stockAdded").replace("{0}", added));
      },
      onEditAsset(e) {
        this.assetDialog(this.asset(e));
      },
      assetDialog(old) {
        const a = old || {
          id: F.newId(),
          name: "",
          type: "Fund",
          isin: "",
          ticker: "",
          exchange: "",
          currency: "EUR",
          sourceId: "",
          benchmark: "",
          seriesType: "raw",
          source: "unavailable",
          prices: [],
          archived: false,
        };
        const fields = {};
        const box = new VBox({ width: "100%" }).addStyleClass(
          "sapUiSmallMargin",
        );
        for (const k of [
          "name",
          "type",
          "isin",
          "ticker",
          "exchange",
          "currency",
          "sourceId",
          "seriesType",
          "benchmark",
        ]) {
          const label = new Label({ text: this.t(k) });
          box.addItem(label);
          let input;
          if (k === "type" || k === "seriesType" || k === "benchmark") {
            const options =
              k === "type"
                ? ["Fund", "ETF", "Stock"]
                : k === "seriesType"
                  ? ["raw", "adjusted", "totalReturn"]
                  : [
                      "",
                      ...this.data()
                        .assets.filter((b) => b.id !== a.id)
                        .map((b) => b.id),
                    ];
            input = new Select({
              width: "100%",
              selectedKey: a[k],
              items: options.map(
                (key) => new Item({ key, text: key || this.t("none") }),
              ),
            });
          } else input = new Input({ value: a[k] || "" });
          label.setLabelFor(input);
          fields[k] = input;
          box.addItem(input);
        }
        const dialog = new Dialog({
          title: this.t(old ? "editAsset" : "addAsset"),
          contentWidth: "30rem",
          content: [box],
          beginButton: new Button({
            text: this.t("save"),
            type: "Emphasized",
            press: () => {
              try {
                const next = { ...a };
                for (const k in fields)
                  next[k] =
                    fields[k] instanceof Select
                      ? fields[k].getSelectedKey()
                      : fields[k].getValue().trim();
                next.currency = next.currency.toUpperCase();
                next.isin = next.isin.toUpperCase();
                F.validateAsset(next, this.data().assets);
                if (old) Object.assign(old, next);
                else this.data().assets.push(next);
                this.save();
                dialog.close();
              } catch (e) {
                MessageBox.error(this.t(e.message));
              }
            },
          }),
          endButton: new Button({
            text: this.t("cancel"),
            press: () => dialog.close(),
          }),
          afterClose: () => dialog.destroy(),
        });
        this.getView().addDependent(dialog);
        dialog.open();
      },
      onArchive(e) {
        const a = this.asset(e);
        a.archived = !a.archived;
        this.save();
      },
      onRemoveAsset(e) {
        const a = this.asset(e);
        if (this.data().purchases.some((p) => p.assetId === a.id)) {
          MessageBox.error(this.t("assetHasPurchases"));
          return;
        }
        this.confirm("removeConfirm", () => {
          this.data().assets = this.data().assets.filter((b) => b.id !== a.id);
          this.save();
        });
      },
      file(accept, fn) {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = accept;
        input.hidden = true;
        document.body.appendChild(input);
        input.oncancel = () => input.remove();
        input.onchange = async () => {
          try {
            if (!input.files?.length) return;
            if (input.files[0].size > 10000000) throw Error("invalidBackup");
            await fn(await input.files[0].text());
          } catch (e) {
            MessageBox.error(this.t(e.message) || this.t("invalidBackup"));
          } finally {
            input.remove();
          }
        };
        input.click();
      },
      onImportCSV(e) {
        const a = this.asset(e);
        MessageBox.information(this.t("csvHelp"), {
          onClose: () =>
            this.file(".csv", (text) => {
              const prices = F.csv(text);
              if (!prices.length) throw Error("invalidCSV");
              this.confirm("replacePrices", () => {
                a.prices = prices;
                a.source = "imported";
                this.save();
              });
            }),
        });
      },
      onAddPurchase() {
        this.purchaseDialog();
      },
      purchaseAssetName(id) {
        return this.data().assets.find((a) => a.id === id)?.name || id;
      },
      purchaseAmount(price, quantity, fees) {
        return (price * quantity + fees).toFixed(2);
      },
      purchaseQuantity(quantity) {
        return Number(quantity).toFixed(2);
      },
      onEditPurchase(e) {
        this.purchaseDialog(e.getSource().getBindingContext("vm").getObject());
      },
      purchaseDialog(old) {
        const assets = this.data().assets;
        if (!assets.length) return;
        const p = old || {
          id: F.newId(),
          assetId: assets[0].id,
          date: new Date().toISOString().slice(0, 10),
          price: 0,
          quantity: 0,
          fees: 0,
        };
        const box = new VBox().addStyleClass("sapUiSmallMargin"),
          fields = {};
        for (const k of [
          "asset",
          "date",
          "price",
          "quantity",
          "fees",
          "amount",
        ]) {
          const label = new Label({ text: this.t(k) });
          box.addItem(label);
          const input =
            k === "asset"
              ? new Select({
                  width: "100%",
                  selectedKey: p.assetId,
                  items: assets.map(
                    (a) =>
                      new Item({
                        key: a.id,
                        text: a.name + " (" + a.currency + ")",
                      }),
                  ),
                })
              : k === "date"
                ? new DatePicker({
                    value: p.date,
                    valueFormat: "yyyy-MM-dd",
                    displayFormat: "yyyy-MM-dd",
                  })
                : new Input({
                    type: "Number",
                    value: k === "amount" || (!old && (k === "price" || k === "quantity")) ? "" : String(p[k]),
                  });
          label.setLabelFor(input);
          fields[k] = input;
          box.addItem(input);
        }
        if (old) {
          fields.amount.setValue((p.price * p.quantity + p.fees).toFixed(2));
        }
        const initialAmount = fields.amount.getValue();
        box.addItem(new Label({ text: this.t("amountHelp"), wrapping: true }));
        const dialog = new Dialog({
          title: this.t("purchase"),
          contentWidth: "28rem",
          content: [box],
          beginButton: new Button({
            text: this.t("save"),
            type: "Emphasized",
            press: () => {
              try {
                const next = {
                  ...p,
                  assetId: fields.asset.getSelectedKey(),
                  date: fields.date.getValue(),
                  price: Number(fields.price.getValue()),
                  quantity: Number(fields.quantity.getValue()),
                  fees: Number(fields.fees.getValue()),
                };
                next.currency = assets.find(
                  (a) => a.id === next.assetId,
                ).currency;
                if (fields.amount.getValue() !== "" && (!old || fields.amount.getValue() !== initialAmount)) {
                  if (!fields.price.getValue()) {
                    const observation = assets.find((a) => a.id === next.assetId).prices.find((r) => r.date === next.date);
                    if (!observation) throw Error("purchasePriceMissing");
                    next.price = observation.price;
                  }
                  next.quantity = F.quantity(
                    Number(fields.amount.getValue()),
                    next.price,
                    next.fees,
                  );
                }
                F.validatePurchase(next, assets);
                if (old) Object.assign(old, next);
                else this.data().purchases.push(next);
                this.save();
                dialog.close();
              } catch (e) {
                MessageBox.error(this.t(e.message === "purchasePriceMissing" ? "purchasePriceMissing" : "invalidPurchase"));
              }
            },
          }),
          endButton: new Button({
            text: this.t("cancel"),
            press: () => dialog.close(),
          }),
          afterClose: () => dialog.destroy(),
        });
        this.getView().addDependent(dialog);
        dialog.open();
      },
      onDeletePurchase(e) {
        const p = e.getSource().getBindingContext("vm").getObject();
        this.confirm("deletePurchaseConfirm", () => {
          this.data().purchases = this.data().purchases.filter(
            (x) => x.id !== p.id,
          );
          this.save();
        });
      },
      download(name, text, type) {
        const url = URL.createObjectURL(new Blob([text], { type })),
          a = document.createElement("a");
        a.href = url;
        a.download = name;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      },
      onBackup() {
        this.download(
          "investment-journal.json",
          JSON.stringify(this.data(), null, 2),
          "application/json",
        );
      },
      onRestore() {
        this.file(".json", (text) => {
          const d = F.restore(text);
          this.confirm("restoreConfirm", () => {
            this.getOwnerComponent().getModel().setData(d);
            this.vm.setProperty(
              "/theme",
              d.preferences.theme || "sap_horizon_dark",
            );
            Theming.setTheme(this.vm.getProperty("/theme"));
            this.save();
          });
        });
      },
      onExportCSV() {
        const keys = this.byId("selection").getSelectedKeys();
        const rows = this.data()
          .assets.filter((a) => keys.includes(a.id))
          .flatMap((a) =>
            a.prices.map((r) => [a.id, r.date, r.price, a.currency, a.source]),
          );
        this.download(
          "price-history.csv",
          "asset_id,date,price,currency,source\n" +
            rows
              .map((r) =>
                r
                  .map((x) => '"' + String(x).replaceAll('"', '""') + '"')
                  .join(","),
              )
              .join("\n"),
          "text/csv",
        );
      },
    });
  },
);
