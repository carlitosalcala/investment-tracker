# Calculation conventions

ISO calendar dates are UTC, compared lexically. Prices are sorted, unique, finite and strictly positive. Missing values remain missing. No FX conversion is performed: totals and allocation are grouped by currency. EUR history excludes foreign holdings explicitly.

Comparison intersects actual observation dates of selected assets. Latest common observation is the end; earliest common observation is the maximum-history start. 1D means one interval and 5D five intervals on this **common** calendar. If there are fewer intervals the displayed dates reveal the shorter period. 30D subtracts 30 calendar days; 6M and 1Y subtract calendar months and clamp month ends. YTD starts at the previous December 31. For calendar/custom boundaries use the last shared valuation on or before the boundary, clamped to available history. Custom end is inclusive. If histories do not overlap, no series is shown. Different currencies are percentage changes in native currency, not FX-adjusted EUR returns. Raw and adjusted price changes are not claimed to include dividends.

Calendar-year price change uses last observation on/before previous year-end versus last observation on/before year-end. If the prior year boundary is missing, the first available observation within the year is used and the result is flagged partial; one observation alone yields no return. No annualisation or money-weighted return is claimed.

Purchases are long-only: cost = quantity × price + fees. Amount input includes fees, so quantity = (amount − fees) / price. All purchase inputs use the asset currency. Holdings use all purchases on/before the valuation date and only the last price on/before that date; no future prices and no zero substitution. Valuation dates disclose staleness. Unrealised gain = value − accumulated cost, including fees. Allocation is within each currency and only available when all holdings in that currency have prices. Portfolio history uses last known prices and shows null for missing valuations. Yearly gain is cumulative unrealised gain at year end, not the year's personal investment return. Current year is partial.

JavaScript IEEE-754 numbers retain input precision until display (up to four decimals displayed). This is a personal analysis tool, not accounting software; binary floating point is not exact decimal arithmetic.

## Monthly investment return

The latest 12 months show absolute value change separately from investment return.
Value change includes new purchases. Monthly gain/loss subtracts purchases including
fees from the change. Investment return uses the Modified Dietz estimate:

`100 * (ending value - opening value - purchases) / (opening value + weighted purchases)`

Each purchase (including fees) is weighted by the fraction of calendar days remaining
in the period after its purchase date, assuming purchase cash flows occur at day end.
The opening value is the previous month-end value. The current month ends today;
completed months end on their last calendar day. Purchases represent external funding
because the app does not track a cash balance. Fees reduce performance. This is an
estimate rather than an exact time-weighted return. Currencies are calculated separately.
Missing opening/ending valuations or nonpositive weighted capital produce an unavailable
percentage. Valuations retain the existing last-known-price convention.

Method reference: [CFA Institute GIPS calculation methodology](https://www.gipsstandards.org/wp-content/uploads/2021/03/gips-handbook-3rd-edition.pdf).
