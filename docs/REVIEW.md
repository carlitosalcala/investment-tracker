Implements the first working browser-local OpenUI5 investment tracker with Horizon XML views, controllers, routing, JSON bindings and a responsive reusable Chart.js control.

Includes asset configuration, common-date performance comparison, period and calendar-year tables, CSV import/export, explicitly fictional demo histories, purchase editing with fee-inclusive cost, portfolio valuation/history and currency-separated totals, local persistence and validated backup/confirmed restore.

The four requested ISINs are retained exactly. Identity/share-class/currency verification and real-history discovery were blocked by source-site network denials; no identities or prices were guessed. Coverage and calculation limitations are documented in docs/DATA-SOURCES.md and docs/CALCULATIONS.md. No automatic market-data provider, FX, sales or dividend cash flows yet.

Validation: 9 Node tests pass; full UI5 production build passes. System Chromium verified comparison, navigation, purchases, reload persistence, backup download, asset creation, CSV provenance and confirmed restore. Desktop and mobile screenshots are in docs/screenshots. Static deployment instructions are in README.md; no deployment or merge performed.
