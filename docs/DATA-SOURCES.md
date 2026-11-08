# Data sources and coverage

Verification attempted 2026-11-08. No real market dataset is bundled or claimed.

| Exact ISIN | Identity / exact share class | Currency / distribution policy | Daily history |
|---|---|---|---|
| IE00BYX5NX33 | Unresolved | Unresolved | Unavailable |
| IE00BYX5MD61 | Unresolved | Unresolved | Unavailable |
| IE000QAZP7L2 | Unresolved | Unresolved | Unavailable |
| IE000ZYRH0Q7 | Unresolved | Unresolved | Unavailable |

Attempted discovery URLs: `https://www.justetf.com/en/etf-profile.html?isin=<ISIN>` for each exact identifier above. All requests failed with proxy CONNECT 403; they are attempted sources, **not verified evidence**. The inspiration URL https://trackingfunds.lovable.app/ also returned proxy 403. Its source, assets and branding were not used.

Do not infer a ticker, benchmark, issuer, currency, or accumulating/distributing status from these identifiers. The seed names are the identifiers themselves; Fund and EUR are explicitly unverified editable placeholders. Before importing real data, verify identity and currency using issuer share-class factsheets/KIDs and record the source identifier. No automatic provider is currently configured. This is an intentional fallback rather than a claim of verified coverage. No paid accounts or credentials required.

## Provider boundary

`model/store.js` supplies the unavailable seed and deterministic fictional demo series. `finance.csv` validates user-provided observations. Both produce sorted `{date, price}` series consumed by pure calculation functions independently of UI5. A future provider should return that same shape plus provenance, exact share-class identity, currency, series kind, observation dates and licensing metadata. Use a backend if credentials or CORS require it; do not put tokens in UI files.

Demo activation only replaces unavailable histories. It never supplies real prices for those ISINs. CSV import replaces an asset's history and marks it user-imported, not verified. Select raw, adjusted or totalReturn in asset settings based on source documentation. No benchmarks are seeded. Tracking difference appears only for matching source category, currency and series kind, over shared dates. Compatibility categories are necessary checks, not independent verification of the source's methodology.

Use CSV only when you have the right to use its contents. No market data redistribution license has been obtained. OpenUI5 is Apache-2.0; Chart.js is MIT (its license is retained in the vendored distribution and npm package). Charts are local, with no CDN or market-data calls at runtime.
