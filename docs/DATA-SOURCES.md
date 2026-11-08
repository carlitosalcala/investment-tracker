# Real data retrieval

## Stocks

The six suggested listings use Yahoo Finance's unofficial chart endpoint for up to five years of daily close data. The server checks the symbol, exchange and currency, excludes the current exchange-local day, and retains saved data on errors or rate limits. Availability, history and Yahoo's response format can change; confirm Yahoo's terms for the intended use. CSV-imported histories are not overwritten. There is no Alpha Vantage fallback. Stock splits and dividend cash flows are not modeled, so portfolio history and returns spanning corporate actions may be inaccurate. Yahoo close history may reflect split adjustments and should not be treated as a verified execution price.

The four configured ISINs identify EUR accumulating mutual-fund share classes, not exchange tickers:

| ISIN | Share class | Identity reference |
|---|---|---|
| IE00BYX5NX33 | Fidelity MSCI World Index Fund P EUR Acc | [Fidelity factsheet](https://www.fidelityinternational.com/FILPS/Documents/en/current/ret.en.xx.IE00BYX5NX33.pdf) |
| IE00BYX5MD61 | Fidelity MSCI Europe Index Fund P EUR Acc | [Fidelity factsheet](https://www.fidelityinternational.com/FILPS/Documents/fr/current/ret.fr.xx.IE00BYX5MD61.pdf) |
| IE000QAZP7L2 | iShares Emerging Markets Index Fund (IE) S EUR Acc | [Issuer](https://www.ishares.com/uk/individual/en/products/345276/) |
| IE000ZYRH0Q7 | iShares Developed World Index Fund (IE) S EUR Acc | [Issuer](https://www.ishares.com/uk/individual/en/products/345277/) |

Identity references were researched on 2026-11-08 using web search and issuer documents. Existing browser metadata is not silently rewritten; successful retrieval updates the fund name. A currency mismatch blocks updates.

## Runtime provider

`GET /api/prices/<ISIN>` retrieves the Financial Times historical-price HTML table at `https://markets.ft.com/data/funds/tearsheet/historical?s=<ISIN>:EUR`. The server uses inherited HTTP(S) proxies and TLS trust through Undici. Only the four configured identifiers are accepted; clients cannot supply arbitrary URLs. Successful responses are cached for 15 minutes, concurrent identical requests share a request, and upstream requests time out after 20 seconds.

The parser requires the exact ISIN/EUR instrument label, a Date/Close table, valid dated positive observations and no conflicting duplicates. Empty, blocked or changed pages fail explicitly. There is no synthetic fallback. The response records price-source URL, retrieval timestamp, currency and raw series kind. A retrieved label means provider-sourced observations, not an independently audited dataset or real-time quote.

The server reads the instrument identifier from the matched share-class page and requests each calendar year from the share-class launch date through the historical-price endpoint. Provider availability or restrictions may prevent complete history. If any year fails, the request fails without replacing saved history. Refresh merges overlapping observations from the same provider and keeps previously retrieved dates. It replaces demo prices only after successful retrieval. It never overwrites CSV-imported histories. Charts and period calculations continue to use actual available dates. Price changes are not a separate total-return index; no FX conversion, interpolation or dividend adjustment is performed. Daily NAVs can be delayed.

## Network limitation in this managed workspace

Web search connectivity and application-server connectivity are separate. On 2026-11-08 the server's actual request to markets.ft.com was denied by the managed proxy with CONNECT 403. Only package/development hosts are permitted by this environment. Add `markets.ft.com` (and any provider redirect host if needed) to the environment's allowed domains and restart/retry retrieval, or run the app on a server with access. Live table compatibility and coverage must be verified once access is available. Parser and UI tests use explicitly constructed test responses; they do not establish live provider availability.

The app must run with its Node server for automatic retrieval. A static-only deployment supports demo/CSV but needs a same-origin `/api/prices/` backend for provider calls. No API key is required. Provider access conditions and redistribution terms still apply; this change does not grant a market-data redistribution license.
