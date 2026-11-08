# Investment journal

A browser-local personal investment tracker built with **OpenUI5 1.154.0**, Horizon, XML views, controllers, JSON binding and hash routing. Reusable UI5 Chart.js control owns responsive chart creation and disposal. No React, Web Components or SAPUI5-only libraries.

## Install and run

Node.js **24** (tested 24.22.1), npm 11. From this checkout:

```sh
npm ci
npm run vendor
npm start
```

Open `http://localhost:8080/index.html`. UI5's root URL shows a directory listing. UI5 CLI downloads the pinned OpenUI5 libraries on first run. Its cache defaults to `.ui5` in this checkout; set `UI5_DATA_DIR` to override. In restricted shell environments use `npm_config_cache=/tmp/npm-cache npm ci` if the home npm cache is unwritable. Keep inherited TLS trust and proxies.

```sh
npm test
npm run build
# With the dev server running, system Chromium installed:
node scripts/smoke.cjs
```

`npm run build` vendors Chart.js and builds all UI5 runtime dependencies to `dist/`. Serve `dist/` with any static HTTP host. A preview can be deployed by uploading that directory to a private static preview host (e.g. a draft Netlify deploy). No deployment is performed by this project. No server secrets or environment file are needed.

## First use

The four requested ISINs are seeded **without verified identities or market prices**. EUR and Fund are editable placeholders. Load the explicitly fictional demo to explore the chart, or import your own daily prices. Select assets on Compare. Manage metadata and benchmark references on Assets; archive hides an asset from comparison while retaining purchases. Remove requires no associated purchases.

CSV import on an asset accepts UTF-8 `date,price` with ISO dates and positive decimal prices. It replaces history only after confirmation. Configure currency and series kind first. History export includes asset identifier, currency and provenance; this multi-asset export is not the single-asset import schema.

On Portfolio enter unit price, quantity and fees; optionally enter a total investment amount inclusive of fees to calculate quantity. Multiple purchases are supported. Sales, transfers and dividend cash flows are not supported. Values use latest known prices; missing data stays unavailable. Native currency totals remain separate with no fabricated FX conversion.

Everything stays in this browser's localStorage; it does not sync. Export JSON backups regularly. Restore validates the schema and asks for confirmation before replacement. Do not use demo valuations for investment decisions.

See [data coverage](docs/DATA-SOURCES.md), [calculation rules](docs/CALCULATIONS.md), and [progress](docs/PROGRESS.md). No source, branding or assets were copied from the inaccessible inspiration site.

Additional browser import/restore coverage: `node scripts/workflows.cjs` (same running server). The scripts use the system Chromium at `/usr/bin/chromium`; adjust the executable path for other platforms. [Dashboard screenshot](docs/screenshots/dashboard.png), [assets](docs/screenshots/assets.png), [portfolio](docs/screenshots/portfolio.png), [mobile](docs/screenshots/mobile.png).
