# ETF Relative Value Desk

A relative value desk for the six largest spot **bitcoin** and **gold** ETFs —
**GBTC · BITB · FBTC · IAU · IBIT · ARKB**.

It is a recreation of the [OpenEXA relative value desk](https://yellow-grass-043d0571e.7.azurestaticapps.net/)
(which plots municipal and corporate bonds) rebuilt around exchange-traded funds:
same four-view Plotly desk, same obsidian theme and dataset switcher, with the
bond panels replaced by two ETF arbitrage panels derived from real market data.

| | |
|---|---|
| **Framework** | React 18 + `react-scripts` 5 |
| **Charting** | `plotly.js` via `react-plotly.js` |
| **Data loading** | `d3-dsv` (CSV fetched from `public/plotted_datasets`) |
| **Deployment** | Azure Static Web Apps |

---

## The desk

The dataset selector in the header switches between four views, mirroring the
original app's `Cr&Re Arb 2D / 3D` and `Liquidity Arb 2D / 3D`:

| View | Panel | x — Risk | y — Yield | z — Price |
|---|---|---|---|---|
| Cr&Re Arb 2D | creation / redemption | basket risk | arb yield | — |
| Cr&Re Arb 3D | creation / redemption | basket risk | arb yield | price |
| Liquidity Arb 2D | liquidity | liquidity risk | spread capture | — |
| Liquidity Arb 3D | liquidity | liquidity risk | spread capture | price |

Every fund gets its own Plotly trace, so the legend doubles as a filter — click a
ticker to mute it, double-click to isolate it. Hovering a point shows the fund,
the session date and the underlying metrics behind that point.

### Panel 1 — creation / redemption arbitrage

Models the risk an authorised participant carries when arbitraging a fund
against its creation basket.

- **Basket risk (x)** — 20-day realised volatility of the fund's return
  *residual* against its underlying asset, annualised, then z-scored across the
  panel. The residual comes from a 60-day rolling OLS beta of the fund on its
  benchmark (`BTC-USD` for the bitcoin funds, `GC=F` for IAU), so it isolates
  fund-specific tracking risk from the move in the underlying.
- **Arb yield (y)** — the 5-day cumulative residual in basis points, z-scored.
  Positive means the fund has drifted rich to fair value (redeem), negative
  means it has drifted cheap (create).
- **Price (z)** — closing price.

### Panel 2 — liquidity arbitrage

Models where a fund sits on the liquidity/spread frontier.

- **Liquidity risk (x)** — the Amihud illiquidity ratio, `|return| / dollar
  volume`, averaged over 21 sessions, in log10 and z-scored. Higher means each
  dollar traded moves the price more.
- **Spread capture (y)** — the Corwin–Schultz (2012) high/low bid-ask spread
  estimator in basis points, averaged over 21 sessions and z-scored. The daily
  estimator is clamped at zero by construction, so the rolling average is used
  to recover a usable "typical spread" rather than a floor.
- **Price (z)** — closing price.

Both panels also carry a `Classifications` column — the risk quartile and yield
quartile of each point as `q-q`, retained from the source dataset's schema.

### What the data shows

The panels reproduce the liquidity ordering you would expect from these funds:
IBIT sits alone at the low-liquidity-risk end on roughly **$2.4bn** of average
daily value traded, IAU posts the tightest spreads of the six (~15bps against
~41bps for the bitcoin funds), and BITB and ARKB — the smallest of the cohort —
carry the highest liquidity risk. In the creation/redemption panel IAU clusters
tightly at low basket risk, since gold's tracking error is a fraction of
bitcoin's.

---

## Methodology — how each coordinate is calculated

Every metric is derived from **free daily OHLCV** (open, high, low, close,
volume) pulled from the public Yahoo Finance chart endpoint
(`query1.finance.yahoo.com/v8/finance/chart/{symbol}?range=2y&interval=1d`).
No login, paid feed or third-party library is involved. All symbols are aligned
onto a **common trading calendar** (only sessions where every fund traded), and
the benchmark is forward-filled onto that calendar.

**Symbols pulled:** the six ETFs plus two benchmarks — `BTC-USD` (spot bitcoin)
for the five bitcoin funds and `GC=F` (COMEX gold futures) for IAU.

### Returns

Everything is built on daily **log returns**:

```
r_t = ln(close_t / close_{t-1})     fund
b_t = ln(bench_t / bench_{t-1})     benchmark (BTC or gold)
```

### Basket risk (tracking error) — Cr&Re x-axis

Computed in three steps:

1. **Rolling beta** — a 60-day trailing OLS regression of the fund's returns on
   the benchmark's returns (covariance ÷ variance):

   ```
   beta_t = Cov(r, b) / Var(b)      over the last 60 sessions
   ```

2. **Residual return** — strip out the benchmark move so only the
   fund-specific component (the true tracking error) remains:

   ```
   resid_t = r_t − beta_t · b_t
   ```

3. **Annualised rolling volatility** — the 20-day standard deviation of those
   residuals, annualised and in percent:

   ```
   TrackingError_t = stdev(resid over last 20 sessions) · √252 · 100
   ```

This is what an authorised participant warehouses: they are hedged on the
underlying asset, so their risk is the fund's drift *away* from that asset.

### Arb yield (dislocation) — Cr&Re y-axis

The 5-day cumulative residual, in basis points — a price-based proxy for the
premium/discount to fair value:

```
Dislocation_t = Σ(resid over last 5 sessions) · 10,000
```

Positive → drifted rich (redeem); negative → drifted cheap (create).

### Liquidity risk (Amihud) — Liquidity x-axis

The Amihud (2002) illiquidity ratio — price impact per million dollars traded —
averaged over 21 sessions in log10 space:

```
illiq_t     = |r_t| / (close_t · volume_t / 1e6)
Illiquidity = log10( mean(illiq over last 21 sessions) )
```

### Spread capture (Corwin–Schultz) — Liquidity y-axis

The Corwin & Schultz (2012) high/low bid-ask spread estimator, which recovers a
spread from just the daily high and low of consecutive sessions (no tick data):

```
β = ln(H_{t-1}/L_{t-1})² + ln(H_t/L_t)²
γ = ln( max(H_{t-1},H_t) / min(L_{t-1},L_t) )²
α = (√(2β) − √β) / (3 − 2√2) − √( γ / (3 − 2√2) )
spread_t = 2 · (e^α − 1) / (1 + e^α)          → × 10,000 for bps
```

The daily estimate is clamped at zero by construction, so it is averaged over 21
sessions to recover a usable "typical" spread instead of an artificial floor.

### Normalisation (z-scoring)

Each plotted axis is standardised across **all six funds and all sessions** so
the funds are directly comparable despite very different absolute vol and volume:

```
z = (value − mean_across_panel) / stdev_across_panel
```

A point at x = +2 therefore means "two standard deviations above the two-year
cross-fund average". The first 20 sessions are dropped so no rolling window is
half-populated.

### Caveats

- The premium/discount uses **price, not official NAV** — Yahoo does not publish
  intraday iNAV, so the dislocation is a beta-residual proxy (standard in
  academic literature, but not the issuer's official iNAV).
- The spread is a **high/low estimator**, not quoted top-of-book. Swapping in a
  TAQ/Bloomberg feed only touches `corwin_schultz` in the pipeline; the rest of
  the app is unchanged.

---

## Data pipeline

`scripts/build_datasets.py` pulls daily OHLCV for the six funds plus their two
benchmark assets from the public Yahoo Finance chart endpoint, derives the
metrics above, and writes the two CSVs the app reads. It uses the Python
standard library only — no third-party packages.

```bash
python scripts/build_datasets.py   # or: npm run data
```

It writes:

```
public/plotted_datasets/etf_crre_arb.csv
public/plotted_datasets/etf_liquidity_arb.csv
```

Each file holds one row per fund per session — currently **2,886 rows**
(6 funds × 481 sessions). The first 20 sessions of the window are dropped so
every rolling statistic is fully populated before the first plotted point.

Tunable constants live at the top of the script (`RANGE`, `BETA_WINDOW`,
`TE_WINDOW`, `DISLOCATION_LAG`, `ILLIQ_WINDOW`, `WARMUP`). Adding or swapping a
fund is a matter of editing the `ETFS` dictionary there and the matching entry
in [`src/etfUniverse.js`](src/etfUniverse.js).

---

## Running it

```bash
npm install
npm start      # dev server on http://localhost:3000
npm test       # unit tests
npm run build  # production bundle in build/
```

## Project layout

```
scripts/build_datasets.py   market data -> the two CSV panels
public/plotted_datasets/    generated datasets, served statically
src/App.js                  header, dataset selector, view switching
src/RelValPlot.js           builds the Plotly traces + dark layout
src/datasets.js             the two panel definitions (axes, hover fields)
src/etfUniverse.js          the six funds, their metadata and colours
src/EtfData.js              CSV column-access helpers
```

## Deployment

[`.github/workflows/azure-static-web-apps.yml`](.github/workflows/azure-static-web-apps.yml)
builds and deploys to Azure Static Web Apps on push to `main`. It expects an
`AZURE_STATIC_WEB_APPS_API_TOKEN` repository secret; add it (or delete the
workflow) before enabling Actions. The build is a plain static bundle, so it
also deploys as-is to Netlify, Vercel, GitHub Pages or any static host.

## Notes

Market data comes from a public, unauthenticated endpoint and is provided
as-is. The metrics here are estimators computed from daily OHLCV — the
premium/discount is a beta-residual proxy rather than official published NAV,
and the spread is a high/low estimator rather than quoted top-of-book. This is
a data-visualisation project, not investment advice.
