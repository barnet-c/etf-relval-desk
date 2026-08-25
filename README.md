# Gold ETF Desk

A relative value desk for the **gold ETF universe** &mdash; the 38 funds listed
by [etf.com/topics/gold](https://www.etf.com/topics/gold) from GLD through NUGY,
covering bullion trusts, miner equity, leveraged and inverse products, and
option-income strategies.

Recreated from the [OpenEXA relative value desk](https://yellow-grass-043d0571e.7.azurestaticapps.net/):
the same Plotly desk and obsidian theme, rebuilt around a cohort that is far
more heterogeneous than the bonds it originally plotted.

| | |
|---|---|
| **Framework** | React 18 + `react-scripts` 5 |
| **Charting** | `plotly.js` via `react-plotly.js` (WebGL scatter) |
| **Data loading** | `d3-dsv` (CSV from `public/plotted_datasets`) |
| **Data pipeline** | Python standard library only |
| **Deployment** | Azure Static Web Apps, or any static host |

---

## The universe

The source page states **40 US-listed gold ETFs**. NUGY is the 38th; the two
rows below it are inverse Deutsche Bank notes under $1.2m. Of those 38, **GLDY**
launched too recently to support any rolling statistic, leaving **37 funds** and
**12,022 fund-sessions** on the desk.

They are not comparable instruments, so every point is coloured by structure:

| Structure | n | Median beta to gold | Median round trip |
|---|---|---|---|
| Physical gold | 9 | 0.86 | 16 bps |
| Gold miners | 8 | 1.80 | 122 bps |
| Leveraged gold | 3 | 1.74 | 74 bps |
| Leveraged miners | 3 | 3.76 | 129 bps |
| Inverse | 5 | &minus;3.48 | 148 bps |
| Option income | 9 | 0.90 | 196 bps |

Those betas are a validity check on the whole pipeline: leveraged miners print
near 2&times; the miner beta, and the inverse cohort prints near its stated
negative multiple. Nothing tells the desk what leverage a fund carries &mdash;
it is recovered from price.

The strip above the chart filters by structure: click to mute, double-click to
isolate.

---

## The panels

| Panel | x | y | z |
|---|---|---|---|
| Cost of Ownership | round-trip cost (bps, log) | realised holding drag (bps/yr, log-modulus) | &mdash; |
| Liquidity | daily turnover ($mm, log) | estimated spread (bps, log) | &mdash; |
| Exposure | beta to gold | realised volatility (% ann, log) | &mdash; |
| Three-way 3D | beta to gold | turnover (log) | round trip (log) |

### Real units, not z-scores

An earlier version standardised every axis. That fails on this cohort: a
z-score reports a 3&times; product as "2.4 standard deviations above average"
when the useful fact is that it is **3&times;**. Every axis here is in the unit
it was measured in, and where a span crosses orders of magnitude the axis is
logarithmic rather than the data being squashed. **Every tick label is a real
number you could quote.**

Holding drag runs from &minus;3,000 to &#43;18,000 bps/yr and takes both signs,
so it uses a **log-modulus** scale, `sign(x) &times; log10(1 + |x|)`, with ticks
written back in real bps/yr.

### Palette

Deliberately neutral &mdash; champagne, dusty blue, bronze, dusty lavender,
slate and sand. No green and no red anywhere, so no point on the chart reads as
an implied verdict. A unit test enforces this by hue: any colour saturated
enough to signal must not fall in the red or green sector.

---

## Methodology

The **Methodology** tab explains every formula in plain English alongside the
maths. In short:

| # | Quantity | Formula |
|---|---|---|
| 1 | Log return | `r_t = ln(close_t / close_{t-1})` |
| 2 | Bid&ndash;ask spread | Corwin&ndash;Schultz (2012) high/low estimator, 21d mean |
| 3 | Round-trip cost | `spread + median(Amihud) x $1mm x 10,000` |
| 4 | Realised holding drag | `-mean(r - beta.b over 126d) x 252 x 10,000` |
| 5 | Daily turnover | `mean(close x volume over 21d) / 1e6` |
| 6 | Beta to gold | `Cov(r, gold) / Var(gold)` over 60 sessions |

Two choices worth flagging:

- **Drag is measured, not quoted.** Rather than repeat the stated expense ratio,
  the desk fits what the fund actually cost its holder &mdash; which captures
  fees, roll, tracking slippage and leveraged compounding decay together.
- **Amihud uses a median, not a mean.** Turnover sits in its denominator, so one
  near-dead session sends an average to infinity. Using the mean pinned five of
  the thinnest funds against the impact cap; the median removed the artefact.

Fund assets and stated fees are quoted from etf.com and shown in tooltips as
context. **They are never plotted** &mdash; every axis is derived from price.

---

## Data pipeline

`scripts/build_datasets.py` pulls daily OHLCV for the cohort plus two benchmarks
(`GC=F` for gold-linked funds, `GDX` for miner-linked) from the public Yahoo
Finance chart endpoint, and writes the CSVs the app reads. Standard library only.

```bash
python scripts/build_datasets.py   # or: npm run data
```

```
public/plotted_datasets/etf_cost.csv        cost of ownership
public/plotted_datasets/etf_liquidity.csv   liquidity
public/plotted_datasets/etf_exposure.csv    exposure quality
public/plotted_datasets/etf_latest.csv      one row per fund, latest session
```

Each fund is measured on **its own history**, not a cohort-wide common calendar
&mdash; the newest fund has about nine months, and intersecting on it would have
discarded more than half of GLD's history for no gain. The script prints
real-unit percentiles and per-family medians on every run; the plot axis ranges
in [`src/datasets.js`](src/datasets.js) are sized from that output.

The roster lives in [`scripts/gold_roster.py`](scripts/gold_roster.py) with its
source and capture date recorded.

---

## Running it

```bash
npm install
npm start      # dev server on http://localhost:3000
npm test       # 12 unit tests
npm run build  # production bundle in build/
```

The tests cover more than wiring: they assert the palette contains no saturated
green or red, that no axis is a z-score, and that every log axis gives its
tickvals in **data** units. That last one is a real trap &mdash; Plotly reads a
log axis `range` in log10 units but `tickvals` in data units, and getting it
backwards renders a single mislabelled tick with no error.

## Project layout

```
scripts/gold_roster.py      the 38-fund universe, with source and date
scripts/build_datasets.py   market data -> the CSV panels
public/plotted_datasets/    generated datasets, served statically
src/App.js                  header, tabs, structure filter, view switching
src/AboutPage.js            the Methodology page
src/RelValPlot.js           Plotly traces, log axes, neutral 3D styling
src/datasets.js             panel definitions (axes, ranges, tick maps)
src/etfUniverse.js          the six structures and their colours
src/EtfData.js              CSV column-access helpers
```

## Limitations

- **Spreads are estimated, not quoted.** Corwin&ndash;Schultz infers a spread
  from the daily high and low and reads high on volatile instruments, so the
  leveraged funds' spreads are likely overstated against the bullion trusts.
- **Daily bars, not intraday.** This describes structure over months, not when
  to send an order.
- **Drag is backward-looking.** Leveraged decay depends on the volatility path
  and will differ in another regime.
- **A $1mm clip is large for the smallest funds.** For the thinnest names on the
  desk that clip is a meaningful share of a day's volume, and the cost shown
  says so.
- **Not investment advice**, and not affiliated with any issuer named.
