"""
Build the relative-value datasets for the gold ETF desk.

Universe: the 38 gold ETFs listed by etf.com/topics/gold from GLD through NUGY
(see scripts/gold_roster.py). They span physically backed trusts, miner equity,
leveraged and inverse products, and option-income funds -- so every axis here is
chosen to stay meaningful across all six structures.

Axes are in REAL UNITS, not z-scores. The cohort runs from a $154bn trust to a
$6m ETN and from -3x to +3x leverage; standardising that away would hide the
only differences that matter. Where a span crosses orders of magnitude the plot
uses a log axis instead.

    etf_cost.csv       cost of ownership   round-trip cost (bps) vs holding drag (bps/yr)
    etf_liquidity.csv  liquidity           average daily value ($mm) vs spread (bps)
    etf_exposure.csv   exposure quality    beta to gold vs tracking error (% ann)
    etf_arbitrage.csv  create/redeem arb   total execution cost (bps) vs net spread (bps)
    etf_latest.csv     one row per fund, latest session

Standard library only.  Usage:  python scripts/build_datasets.py
"""

import csv
import json
import math
import os
import ssl
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from gold_roster import GOLD_ROSTER, FAMILIES, SOURCE  # noqa: E402

BENCHMARKS = ["GC=F", "GDX"]

RANGE = "2y"
INTERVAL = "1d"

BETA_WINDOW = 60      # rolling window for beta to the benchmark
TE_WINDOW = 60        # rolling window for tracking-error vol
ILLIQ_WINDOW = 21     # rolling window for spread / turnover
DRAG_WINDOW = 126     # ~6 months, the window realised holding drag is fitted on
WARMUP = 130          # sessions dropped so every rolling window is populated
MIN_BARS = WARMUP + 40  # a fund needs this much history to be plottable

# Round-trip cost = cross the spread twice, plus the price impact of the trade.
# Impact is scaled off the fund's own Amihud measure for a nominal clip size.
CLIP_USD_MM = 1.0       # the notional the impact estimate is quoted for
IMPACT_CAP_BPS = 3000.0 # a guard against pathological days, not a working limit

# --------------------------------------------------------------------------
# creation / redemption arbitrage
#
# The textbook calculation prices the basket constituent by constituent off
# executable quotes. Daily bars carry neither a basket file nor a quote, so the
# basket is proxied by the fund's own benchmark rolled forward on its fitted
# beta, and the two cash legs -- the creation fee and the financing on the
# settlement gap -- are stated desk assumptions rather than measurements. Both
# are documented on the Methodology page.
# --------------------------------------------------------------------------

FV_WINDOW = 21          # sessions the basket fair value is rolled forward over
HL_WINDOW = 60          # sessions the convergence regression is fitted on

COMMISSION_BPS = 0.5    # institutional ETF commission, one side
FINANCING_RATE = 0.043  # overnight funding, annualised
SETTLE_DAYS = 1         # T+1 on both legs
FINANCING_BPS = FINANCING_RATE / 360.0 * SETTLE_DAYS * 10000.0

# Creation/redemption fee in bps of the basket. These are PLACEHOLDER desk
# conventions of the right order of magnitude -- they were not read off any
# prospectus, and no issuer's actual fee schedule was consulted. The swap-backed
# products are set higher on the reasoning that the AP is unwinding a reset
# rather than delivering securities. Replace them with real fee data before
# quoting any number off this panel.
CREATE_FEE_BPS = {
    "physical": 1.5,
    "miners": 1.0,
    "income": 2.0,
    "lev_gold": 3.0,
    "lev_miners": 3.0,
    "inverse": 3.0,
}

# Market impact of the BASKET leg. Yahoo reports GC=F volume in contracts, and
# unreliably, so an Amihud measure on it would be meaningless -- basket depth is
# assumed here, not measured. Gold futures are far deeper than the miner basket.
BASKET_MI_BPS = {"GC=F": 0.5, "GDX": 1.5}


def logmod(x):
    """
    Log-modulus transform: sign(x) * log10(1 + |x|).

    Holding drag runs from about -130 bps/yr on a physical trust to +17,000 on a
    -3x ETN, and it takes both signs, so neither a linear nor a log axis can
    show the cohort at once. This keeps the sign, compresses the decay tail, and
    the plot labels its ticks back in real bps/yr.
    """
    if x != x:
        return None
    return math.copysign(math.log10(1.0 + abs(x)), x)

OUT_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                       "public", "plotted_datasets")

_UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
       "(KHTML, like Gecko) Chrome/122.0 Safari/537.36")


# --------------------------------------------------------------------------
# download
# --------------------------------------------------------------------------

def fetch_series(symbol, attempts=4):
    """Return {date: {open, high, low, close, volume}} for a Yahoo symbol."""
    url = ("https://query1.finance.yahoo.com/v8/finance/chart/"
           f"{urllib.parse.quote(symbol)}?range={RANGE}&interval={INTERVAL}")
    ctx = ssl.create_default_context()
    last_err = None
    for i in range(attempts):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": _UA})
            with urllib.request.urlopen(req, timeout=45, context=ctx) as resp:
                payload = json.loads(resp.read().decode("utf-8"))
            break
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as exc:
            last_err = exc
            time.sleep(1.5 * (i + 1))
    else:
        raise RuntimeError(f"failed to download {symbol}: {last_err}")

    result = payload["chart"]["result"][0]
    stamps = result["timestamp"]
    quote = result["indicators"]["quote"][0]

    rows = {}
    for i, ts in enumerate(stamps):
        o, h, l = quote["open"][i], quote["high"][i], quote["low"][i]
        c, v = quote["close"][i], quote["volume"][i]
        if None in (o, h, l, c) or c <= 0 or h <= 0 or l <= 0:
            continue
        day = time.strftime("%Y-%m-%d", time.gmtime(ts))
        rows[day] = {"open": o, "high": h, "low": l, "close": c,
                     "volume": float(v or 0)}
    return rows


# --------------------------------------------------------------------------
# statistics
# --------------------------------------------------------------------------

def mean(xs):
    return sum(xs) / len(xs) if xs else 0.0


def stdev(xs):
    if len(xs) < 2:
        return 0.0
    m = mean(xs)
    return math.sqrt(sum((x - m) ** 2 for x in xs) / (len(xs) - 1))


def rolling_beta(a_rets, b_rets, window):
    """Rolling OLS beta of asset on benchmark."""
    out = []
    for i in range(len(a_rets)):
        lo = max(0, i - window + 1)
        a, b = a_rets[lo:i + 1], b_rets[lo:i + 1]
        if len(a) < 10:
            out.append(float("nan"))
            continue
        mb = mean(b)
        var = sum((x - mb) ** 2 for x in b)
        if var == 0:
            out.append(float("nan"))
            continue
        ma = mean(a)
        cov = sum((a[j] - ma) * (b[j] - mb) for j in range(len(a)))
        out.append(cov / var)
    return out


def ols_slope(xs, ys):
    """Plain OLS slope of y on x. NaN when the fit is not identified."""
    n = len(xs)
    if n < 10:
        return float("nan")
    mx, my = mean(xs), mean(ys)
    var = sum((x - mx) ** 2 for x in xs)
    if var == 0:
        return float("nan")
    return sum((xs[j] - mx) * (ys[j] - my) for j in range(n)) / var


def corwin_schultz(highs, lows):
    """High-low bid/ask spread estimator (Corwin & Schultz 2012), in bps."""
    n = len(highs)
    out = [0.0] * n
    k = 3 - 2 * math.sqrt(2)
    for t in range(1, n):
        h1, l1 = highs[t - 1], lows[t - 1]
        h2, l2 = highs[t], lows[t]
        if min(h1, l1, h2, l2) <= 0:
            continue
        beta = math.log(h1 / l1) ** 2 + math.log(h2 / l2) ** 2
        gamma = math.log(max(h1, h2) / min(l1, l2)) ** 2
        alpha = (math.sqrt(2 * beta) - math.sqrt(beta)) / k - math.sqrt(gamma / k)
        spread = 2 * (math.exp(alpha) - 1) / (1 + math.exp(alpha))
        out[t] = max(spread, 0.0) * 10000.0
    if n > 1:
        out[0] = out[1]
    return out


# --------------------------------------------------------------------------
# panel construction
# --------------------------------------------------------------------------

def build_panel():
    print(f"universe: {len(GOLD_ROSTER)} funds  ({SOURCE})")

    print("downloading benchmarks ...")
    bench = {}
    for symbol in BENCHMARKS:
        bench[symbol] = fetch_series(symbol)
        print(f"  {symbol:<6} {len(bench[symbol])} bars")

    print("downloading funds ...")
    series, dropped = {}, []
    for ticker in GOLD_ROSTER:
        try:
            rows = fetch_series(ticker)
        except RuntimeError:
            dropped.append((ticker, "no data"))
            continue
        if len(rows) < MIN_BARS:
            dropped.append((ticker, f"{len(rows)} bars"))
            continue
        series[ticker] = rows
    print(f"  {len(series)} funds with usable history")
    for tk, why in dropped:
        print(f"  dropped {tk:<6} ({why}, needs {MIN_BARS})")

    # Each fund is measured on ITS OWN history rather than a cohort-wide common
    # calendar: the newest fund here has 192 sessions, and intersecting on it
    # would throw away 60% of GLD's history for no analytical gain.
    panel = {}
    for ticker, rows in series.items():
        name, issuer, aum, er, family, bsym = GOLD_ROSTER[ticker]
        bench_rows = bench[bsym]
        gold_rows = bench["GC=F"]

        calendar = sorted(set(rows) & set(bench_rows) & set(gold_rows))
        if len(calendar) < MIN_BARS:
            print(f"  dropped {ticker:<6} ({len(calendar)} overlapping sessions)")
            continue

        bclose = [bench_rows[d]["close"] for d in calendar]
        bhigh = [bench_rows[d]["high"] for d in calendar]
        blow = [bench_rows[d]["low"] for d in calendar]
        gclose = [gold_rows[d]["close"] for d in calendar]

        close = [rows[d]["close"] for d in calendar]
        high = [rows[d]["high"] for d in calendar]
        low = [rows[d]["low"] for d in calendar]
        vol = [rows[d]["volume"] for d in calendar]

        rets = [0.0] + [math.log(close[i] / close[i - 1]) for i in range(1, len(close))]
        brets = [0.0] + [math.log(bclose[i] / bclose[i - 1]) for i in range(1, len(bclose))]
        grets = [0.0] + [math.log(gclose[i] / gclose[i - 1]) for i in range(1, len(gclose))]

        # beta to GOLD -- universal across structures, and it validates the
        # product: a 3x gold ETN should print near 3, an inverse near -1
        gold_beta = rolling_beta(rets, grets, BETA_WINDOW)
        # beta to the fund's OWN family benchmark -- used for tracking quality
        fam_beta = rolling_beta(rets, brets, BETA_WINDOW)

        resid = []
        for i in range(len(rets)):
            b = fam_beta[i]
            resid.append(0.0 if b != b else rets[i] - b * brets[i])

        # tracking error: annualised vol of the residual, in percent
        te = []
        for i in range(len(resid)):
            lo = max(0, i - TE_WINDOW + 1)
            te.append(stdev(resid[lo:i + 1]) * math.sqrt(252) * 100.0)

        # realised holding drag: the residual's own trend, annualised, in bps/yr.
        # This is what the fund actually cost the holder over the window --
        # fees, roll, decay and all -- rather than the stated expense ratio.
        drag = []
        for i in range(len(resid)):
            lo = max(0, i - DRAG_WINDOW + 1)
            seg = resid[lo:i + 1]
            drag.append(-mean(seg) * 252 * 10000.0 if seg else 0.0)

        # spread, 21d average of the daily high/low estimator
        sp_raw = corwin_schultz(high, low)
        spread = []
        for i in range(len(sp_raw)):
            lo = max(0, i - ILLIQ_WINDOW + 1)
            spread.append(mean(sp_raw[lo:i + 1]))

        dollar_vol = [close[i] * vol[i] for i in range(len(close))]

        adv = []
        for i in range(len(dollar_vol)):
            lo = max(0, i - ILLIQ_WINDOW + 1)
            adv.append(mean(dollar_vol[lo:i + 1]) / 1e6)

        illiq_raw = []
        for i in range(len(rets)):
            dv = dollar_vol[i]
            illiq_raw.append(abs(rets[i]) / (dv / 1e6) if dv > 0 else 0.0)
        # Amihud is a ratio with turnover in the denominator, so a single
        # near-zero-volume session sends the mean to infinity. The thinnest
        # funds here have days like that, which pinned five of them against the
        # impact cap. Median over the window is the robust standard choice.
        illiq = []
        for i in range(len(illiq_raw)):
            lo = max(0, i - ILLIQ_WINDOW + 1)
            w = sorted(x for x in illiq_raw[lo:i + 1] if x > 0)
            illiq.append(w[len(w) // 2] if w else 0.0)

        # round trip = cross the spread twice + impact of a CLIP_USD_MM clip
        roundtrip = []
        for i in range(len(close)):
            impact = illiq[i] * CLIP_USD_MM * 10000.0
            roundtrip.append(spread[i] + min(impact, IMPACT_CAP_BPS))

        vol_ann = []
        for i in range(len(rets)):
            lo = max(0, i - TE_WINDOW + 1)
            vol_ann.append(stdev(rets[lo:i + 1]) * math.sqrt(252) * 100.0)

        # ---- creation / redemption arbitrage ----------------------------
        # Basket fair value: anchor on the fund's own price FV_WINDOW sessions
        # back and roll it forward on beta x benchmark return, net of the fee
        # the NAV accrues over the same stretch. The gross spread is how far the
        # traded price has drifted from that path.
        fee_daily = (er / 100.0) / 252.0
        gross = []
        for i in range(len(close)):
            lo = max(0, i - FV_WINDOW)
            drift = 0.0
            for s in range(lo + 1, i + 1):
                b = fam_beta[s]
                if b != b:
                    drift = float("nan")
                    break
                drift += b * brets[s]
            if i == lo or drift != drift:
                gross.append(float("nan"))
                continue
            fv = close[lo] * math.exp(drift - fee_daily * (i - lo))
            gross.append((close[i] - fv) / fv * 10000.0 if fv > 0 else float("nan"))

        # Basket-leg half spread, from the benchmark's own high/low
        bsp_raw = corwin_schultz(bhigh, blow)
        bspread = []
        for i in range(len(bsp_raw)):
            lo = max(0, i - ILLIQ_WINDOW + 1)
            bspread.append(mean(bsp_raw[lo:i + 1]))

        basket_mi = BASKET_MI_BPS[bsym]
        fee_bps = CREATE_FEE_BPS[family]

        # D2 = C_ETF + C_basket + fees + financing, each leg crossed once
        exec_cost, net_spread = [], []
        for i in range(len(close)):
            mi_etf = min(illiq[i] * CLIP_USD_MM * 10000.0, IMPACT_CAP_BPS)
            c_etf = spread[i] / 2.0 + mi_etf + COMMISSION_BPS
            c_basket = bspread[i] / 2.0 + basket_mi
            d2 = c_etf + c_basket + fee_bps + FINANCING_BPS
            exec_cost.append(d2)
            g = gross[i]
            # the AP picks the profitable direction, so it is the size of the
            # dislocation that has to clear the cost, not its sign
            net_spread.append(abs(g) - d2 if g == g else float("nan"))

        # Convergence: dS_t = alpha + beta S_(t-1), half life = -ln2 / ln(1+beta)
        half_life = []
        for i in range(len(gross)):
            lo = max(1, i - HL_WINDOW + 1)
            xs, ys = [], []
            for s in range(lo, i + 1):
                prev, cur = gross[s - 1], gross[s]
                if prev != prev or cur != cur:
                    continue
                xs.append(prev / 10000.0)
                ys.append((cur - prev) / 10000.0)
            b = ols_slope(xs, ys)
            # only a mean-reverting fit has a half life: -1 < beta < 0
            if b != b or b >= 0.0 or b <= -1.0:
                half_life.append(float("nan"))
            else:
                half_life.append(-math.log(2.0) / math.log(1.0 + b))

        panel[ticker] = {
            "meta": (name, issuer, aum, er, family, bsym),
            "date": calendar, "close": close, "volume": vol,
            "gold_beta": gold_beta, "fam_beta": fam_beta,
            "te": te, "drag": drag, "spread": spread, "adv": adv,
            "illiq": illiq, "roundtrip": roundtrip, "vol": vol_ann,
            "gross": gross, "exec_cost": exec_cost, "net_spread": net_spread,
            "half_life": half_life, "bspread": bspread,
        }

    return panel


def _clean(v, lo=None, hi=None):
    """NaN-safe rounding guard so no NaN reaches the CSV."""
    if v != v or v in (float("inf"), float("-inf")):
        return None
    if lo is not None:
        v = max(v, lo)
    if hi is not None:
        v = min(v, hi)
    return v


def write_datasets(panel):
    os.makedirs(OUT_DIR, exist_ok=True)

    # each fund contributes its own post-warm-up sessions
    keeps = {tk: list(range(WARMUP, len(d["date"]))) for tk, d in panel.items()}
    total = sum(len(v) for v in keeps.values())
    spans = [(d["date"][WARMUP], d["date"][-1]) for d in panel.values()]
    print(f"\n{len(panel)} funds, {total} fund-sessions "
          f"({min(s[0] for s in spans)} -> {max(s[1] for s in spans)})")

    base_cols = ["", "Ticker", "Fund", "Issuer", "Family", "FamilyLabel",
                 "Benchmark", "Date", "Price", "AUM", "ExpenseRatio"]

    def base_row(idx, tk, d, i):
        name, issuer, aum, er, family, bsym = d["meta"]
        return [idx, tk, name, issuer, family, FAMILIES[family], bsym,
                d["date"][i], round(d["close"][i], 4),
                round(aum / 1e6, 2), er]

    # ---------------- cost of ownership ----------------------------------
    path = os.path.join(OUT_DIR, "etf_cost.csv")
    with open(path, "w", newline="", encoding="utf-8") as fh:
        w = csv.writer(fh)
        w.writerow(base_cols + ["RoundTripBps", "HoldingDragBpsYr", "DragLM",
                                "SpreadBps", "ADVmm"])
        idx = 0
        for tk, d in panel.items():
            for i in keeps[tk]:
                rt = _clean(d["roundtrip"][i], 0.05)
                dr = _clean(d["drag"][i], -20000, 20000)
                if rt is None or dr is None:
                    continue
                w.writerow(base_row(idx, tk, d, i) +
                           [round(rt, 3), round(dr, 1), round(logmod(dr), 4),
                            round(d["spread"][i], 3), round(d["adv"][i], 3)])
                idx += 1
    print(f"wrote {path}  ({idx} rows)")

    # ---------------- liquidity ------------------------------------------
    path = os.path.join(OUT_DIR, "etf_liquidity.csv")
    with open(path, "w", newline="", encoding="utf-8") as fh:
        w = csv.writer(fh)
        w.writerow(base_cols + ["ADVmm", "SpreadBps", "RoundTripBps", "VolAnn"])
        idx = 0
        for tk, d in panel.items():
            for i in keeps[tk]:
                adv = _clean(d["adv"][i], 0.01)
                sp = _clean(d["spread"][i], 0.05)
                if adv is None or sp is None:
                    continue
                w.writerow(base_row(idx, tk, d, i) +
                           [round(adv, 3), round(sp, 3),
                            round(d["roundtrip"][i], 3), round(d["vol"][i], 3)])
                idx += 1
    print(f"wrote {path}  ({idx} rows)")

    # ---------------- exposure quality -----------------------------------
    path = os.path.join(OUT_DIR, "etf_exposure.csv")
    with open(path, "w", newline="", encoding="utf-8") as fh:
        w = csv.writer(fh)
        w.writerow(base_cols + ["GoldBeta", "VolAnn", "TrackingErrorPct",
                                "RoundTripBps", "ADVmm"])
        idx = 0
        for tk, d in panel.items():
            for i in keeps[tk]:
                gb = _clean(d["gold_beta"][i], -6, 6)
                te = _clean(d["te"][i], 0.0)
                if gb is None or te is None:
                    continue
                w.writerow(base_row(idx, tk, d, i) +
                           [round(gb, 4), round(d["vol"][i], 3), round(te, 3),
                            round(d["roundtrip"][i], 3), round(d["adv"][i], 3)])
                idx += 1
    print(f"wrote {path}  ({idx} rows)")

    # ---------------- creation / redemption arbitrage --------------------
    path = os.path.join(OUT_DIR, "etf_arbitrage.csv")
    with open(path, "w", newline="", encoding="utf-8") as fh:
        w = csv.writer(fh)
        w.writerow(base_cols + ["ExecCostBps", "ExecLM", "NetSpreadBps", "NetLM",
                                "GrossSpreadBps", "AbsGrossBps", "HalfLifeDays",
                                "SpreadBps", "ADVmm"])
        idx = 0
        for tk, d in panel.items():
            for i in keeps[tk]:
                ec = _clean(d["exec_cost"][i], 0.05)
                ns = _clean(d["net_spread"][i], -20000, 20000)
                gr = _clean(d["gross"][i], -20000, 20000)
                if ec is None or ns is None or gr is None:
                    continue
                hl = _clean(d["half_life"][i], 0.0, 999.0)
                w.writerow(base_row(idx, tk, d, i) +
                           [round(ec, 3), round(logmod(ec), 4),
                            round(ns, 2), round(logmod(ns), 4),
                            round(gr, 2), round(abs(gr), 2),
                            round(hl, 2) if hl is not None else "",
                            round(d["spread"][i], 3), round(d["adv"][i], 3)])
                idx += 1
    print(f"wrote {path}  ({idx} rows)")

    # ---------------- latest snapshot ------------------------------------
    path = os.path.join(OUT_DIR, "etf_latest.csv")
    with open(path, "w", newline="", encoding="utf-8") as fh:
        w = csv.writer(fh)
        w.writerow(["Ticker", "Fund", "Issuer", "Family", "FamilyLabel",
                    "Benchmark", "Date", "Price", "AUM", "ExpenseRatio",
                    "RoundTripBps", "HoldingDragBpsYr", "SpreadBps",
                    "ADVmm", "GoldBeta", "TrackingErrorPct", "VolAnn",
                    "ExecCostBps", "NetSpreadBps", "GrossSpreadBps",
                    "HalfLifeDays"])
        for tk, d in panel.items():
            name, issuer, aum, er, family, bsym = d["meta"]
            i = len(d["date"]) - 1
            gb = _clean(d["gold_beta"][i], -6, 6)
            hl = _clean(d["half_life"][i], 0.0, 999.0)
            w.writerow([tk, name, issuer, family, FAMILIES[family], bsym,
                        d["date"][i], round(d["close"][i], 4),
                        round(aum / 1e6, 2), er,
                        round(d["roundtrip"][i], 3),
                        round(_clean(d["drag"][i], -20000, 20000) or 0, 1),
                        round(d["spread"][i], 3), round(d["adv"][i], 3),
                        round(gb, 4) if gb is not None else "",
                        round(d["te"][i], 3), round(d["vol"][i], 3),
                        round(d["exec_cost"][i], 3),
                        round(_clean(d["net_spread"][i], -20000, 20000) or 0, 2),
                        round(_clean(d["gross"][i], -20000, 20000) or 0, 2),
                        round(hl, 2) if hl is not None else ""])
    print(f"wrote {path}")

    # ---------------- ranges, so the plot axes can be sized honestly ------
    def span(key):
        vals = sorted(panel[t][key][i] for t in panel for i in keeps[t]
                      if _clean(panel[t][key][i]) is not None)
        n = len(vals)
        if n == 0:
            return "no finite values"
        p = lambda q: vals[min(n - 1, int(n * q))]
        return (f"min {vals[0]:9.2f}  p1 {p(0.01):9.2f}  p50 {p(0.5):9.2f}  "
                f"p99 {p(0.99):9.2f}  max {vals[-1]:9.2f}")

    print("\nreal-unit ranges (size the plot axes from these):")
    for k, lbl in (("roundtrip", "round trip bps"), ("drag", "drag bps/yr"),
                   ("adv", "ADV $mm"), ("spread", "spread bps"),
                   ("gold_beta", "beta to gold"), ("te", "tracking err %"),
                   ("vol", "vol % ann"), ("exec_cost", "exec cost bps"),
                   ("net_spread", "net spread bps"), ("gross", "gross spread bps"),
                   ("half_life", "half life days")):
        print(f"  {lbl:<16}{span(k)}")

    # per-family medians -- the sanity check that the structures came out right
    print("\nlatest median by family:")
    fams = {}
    for tk, d in panel.items():
        i = len(d["date"]) - 1
        fams.setdefault(d["meta"][4], []).append(
            (d["gold_beta"][i], d["roundtrip"][i], d["drag"][i], d["adv"][i]))
    for fam, vals in sorted(fams.items()):
        med = lambda j: sorted(v[j] for v in vals
                               if v[j] == v[j])[len(vals) // 2]
        print(f"  {FAMILIES[fam]:<18} n={len(vals):<3} "
              f"beta {med(0):6.2f}  rt {med(1):7.1f}bps  "
              f"drag {med(2):9.0f}bps/yr  adv ${med(3):9.1f}mm")


if __name__ == "__main__":
    pnl = build_panel()
    write_datasets(pnl)
