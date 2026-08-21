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
