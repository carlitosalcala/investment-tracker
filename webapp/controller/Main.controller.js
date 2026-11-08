sap.ui.define(
  [
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
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
          period: "All",
          periods: F.periods.map((key) => ({ key })),
          from: "2025-01-01",
          to: new Date().toISOString().slice(0, 10),
        });
        this.getView().setModel(this.vm, "vm");
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
      onNavigate(e) {
        this.getOwnerComponent()
          .getRouter()
          .navTo("section", { section: e.getParameter("item").getKey() });
      },
      onSelection() {
        this.refresh();
      },
      refresh() {
        const d = this.data(),
          v = this.vm;
        const active = d.assets.filter((a) => !a.archived);
        v.setProperty("/activeAssets", active);
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
        v.setProperty(
          "/years",
          selected.flatMap((a) =>
            F.years(a).map((y) => ({
              name: a.name,
              year: y.year,
              performance: y.return === null ? "—" : fmt(y.return) + "%",
              coverage: this.t(y.incomplete ? "incomplete" : "complete"),
            })),
          ),
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
            .sort((a, b) => b.date.localeCompare(a.date)),
        );
        const hs = F.portfolio(d.assets, d.purchases),
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
        const dates = [
          ...new Set([
            ...d.purchases.map((p) => p.date),
            ...d.assets.flatMap((a) =>
              a.currency === "EUR" ? a.prices.map((p) => p.date) : [],
            ),
          ]),
        ]
          .filter(
            (day) =>
              day <= new Date().toISOString().slice(0, 10) &&
              d.purchases.some((p) => p.date <= day),
          )
          .sort();
        const eurAssets = d.assets.filter((a) => a.currency === "EUR");
        v.setProperty("/portfolioChart", {
          dates,
          series: [
            {
              label: this.t("valueEUR"),
              values: dates.map((day) => {
                const h = F.portfolio(eurAssets, d.purchases, day);
                return h.some((x) => x.value === null)
                  ? null
                  : h.reduce((s, x) => s + x.value, 0);
              }),
            },
            {
              label: this.t("outlayEUR"),
              values: dates.map((day) =>
                F.portfolio(eurAssets, d.purchases, day).reduce(
                  (s, x) => s + x.cost,
                  0,
                ),
              ),
            },
          ],
        });
        const ys = [...new Set(d.purchases.map((p) => p.date.slice(0, 4)))];
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
                d.assets,
                d.purchases,
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
                  d.purchases
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
      },
      confirm(k, fn) {
        MessageBox.confirm(this.t(k), {
          onClose: (a) => {
            if (a === MessageBox.Action.OK) fn();
          },
        });
      },
      async onRetrievePrices(e) {
        if (this.vm.getProperty("/retrieving")) return;
        const row = e?.getSource().getBindingContext()?.getObject();
        const assets = row
          ? [row]
          : this.data().assets.filter(
              (a) => !a.archived && a.source !== "imported",
            );
        this.vm.setProperty("/retrieving", true);
        this.vm.setProperty("/retrievalStatus", this.t("retrievingPrices"));
        let count = 0;
        const failures = [];
        try {
          for (const asset of assets) {
            if (!asset.isin) continue;
            try {
              const response = await fetch(
                "/api/prices/" + encodeURIComponent(asset.isin),
                { signal: AbortSignal.timeout(25000) },
              );
              const result = await response.json();
              if (!response.ok)
                throw Error(result.error || "Price request failed");
              if (
                result.isin !== asset.isin ||
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
                asset.source === "imported"
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
              Object.assign(asset, result, {
                prices: F.observations([...merged.values()]),
              });
              count++;
            } catch (error) {
              failures.push(asset.isin + ": " + error.message);
            }
          }
          if (count) {
            this.save();
            this.byId("selection").setSelectedKeys(
              assets.filter((a) => a.source === "retrieved").map((a) => a.id),
            );
            this.refresh();
          }
          this.vm.setProperty(
            "/retrievalStatus",
            count +
              " fund(s) updated." +
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
      onEditAsset(e) {
        this.assetDialog(this.asset(e));
      },
      assetDialog(old) {
        const a = old || {
          id: crypto.randomUUID(),
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
        input.onchange = async () => {
          try {
            if (input.files[0].size > 10000000) throw Error("invalidBackup");
            await fn(await input.files[0].text());
          } catch (e) {
            MessageBox.error(this.t(e.message) || this.t("invalidBackup"));
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
      onEditPurchase(e) {
        this.purchaseDialog(this.asset(e));
      },
      purchaseDialog(old) {
        const assets = this.data().assets;
        if (!assets.length) return;
        const p = old || {
          id: crypto.randomUUID(),
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
                    value: k === "amount" ? "" : String(p[k]),
                  });
          label.setLabelFor(input);
          fields[k] = input;
          box.addItem(input);
        }
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
                if (fields.amount.getValue() !== "")
                  next.quantity = F.quantity(
                    Number(fields.amount.getValue()),
                    next.price,
                    next.fees,
                  );
                F.validatePurchase(next, assets);
                if (old) Object.assign(old, next);
                else this.data().purchases.push(next);
                this.save();
                dialog.close();
              } catch (e) {
                MessageBox.error(this.t("invalidPurchase"));
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
        const p = this.asset(e);
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
