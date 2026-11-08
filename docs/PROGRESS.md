# Progress

- Stage 1: OpenUI5 application, original Horizon dashboard, hash navigation, asset add/edit/archive/remove with validation, deterministic explicitly fictional demo, comparison periods/custom boundaries, reusable responsive Chart.js control, summary, calendar years and daily observations.
- Stage 2: isolated data/calculate modules, validated CSV history replacement, provenance, CSV export. Network policy prevented identity/history verification; automatic provider intentionally unavailable. All four requested identifiers retained exactly. Data source document records unresolved coverage.
- Stage 3: purchase create/edit/delete, fees and amount entry, holdings, allocation, currency-separated totals, historical EUR value and outlay, yearly summaries, local persistence, validated JSON backup/confirmed restore.

Remaining: verify all share classes and source licensing; real daily provider and dated FX; multi-device sync; sales, dividends and transfers; exact decimal accounting; internationalisation beyond English. Demo and imported price provenance must never be promoted to verified automatically. Performance chart comparisons use shared observation dates and may shorten sparse periods.

Validation results and screenshots are recorded alongside delivery. No public deployment or merge is authorised.

## Verified in this workspace

Nine Node tests cover interval/calendar boundaries, sparse histories, fee-inclusive cost, multiple purchases, missing historical prices, amount-to-quantity, CSV failures, backup round-trip/reference validation, duplicate assets and currency separation. Headless system Chromium exercised demo comparison, routing, purchase entry, reload persistence, backup download, asset creation, CSV import and confirmed restore with no page exceptions. Screenshots: `docs/screenshots/dashboard.png`, `assets.png`, `portfolio.png`, `mobile.png`. Browser scripts use isolated contexts; test purchases are not inserted into the user's browser.
