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

        panel[ticker] = {
            "meta": (name, issuer, aum, er, family, bsym),
            "date": calendar, "close": close, "volume": vol,
            "gold_beta": gold_beta, "fam_beta": fam_beta,
            "te": te, "drag": drag, "spread": spread, "adv": adv,
            "illiq": illiq, "roundtrip": roundtrip, "vol": vol_ann,
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

    # ---------------- latest snapshot ------------------------------------
    path = os.path.join(OUT_DIR, "etf_latest.csv")
    with open(path, "w", newline="", encoding="utf-8") as fh:
        w = csv.writer(fh)
        w.writerow(["Ticker", "Fund", "Issuer", "Family", "FamilyLabel",
                    "Benchmark", "Date", "Price", "AUM", "ExpenseRatio",
                    "RoundTripBps", "HoldingDragBpsYr", "SpreadBps",
                    "ADVmm", "GoldBeta", "TrackingErrorPct", "VolAnn"])
        for tk, d in panel.items():
            name, issuer, aum, er, family, bsym = d["meta"]
            i = len(d["date"]) - 1
            gb = _clean(d["gold_beta"][i], -6, 6)
            w.writerow([tk, name, issuer, family, FAMILIES[family], bsym,
                        d["date"][i], round(d["close"][i], 4),
                        round(aum / 1e6, 2), er,
                        round(d["roundtrip"][i], 3),
                        round(_clean(d["drag"][i], -20000, 20000) or 0, 1),
                        round(d["spread"][i], 3), round(d["adv"][i], 3),
                        round(gb, 4) if gb is not None else "",
                        round(d["te"][i], 3), round(d["vol"][i], 3)])
    print(f"wrote {path}")

    # ---------------- ranges, so the plot axes can be sized honestly ------
    def span(key):
        vals = sorted(panel[t][key][i] for t in panel for i in keeps[t]
                      if _clean(panel[t][key][i]) is not None)
        n = len(vals)
        p = lambda q: vals[min(n - 1, int(n * q))]
        return (f"min {vals[0]:9.2f}  p1 {p(0.01):9.2f}  p50 {p(0.5):9.2f}  "
                f"p99 {p(0.99):9.2f}  max {vals[-1]:9.2f}")

    print("\nreal-unit ranges (size the plot axes from these):")
    for k, lbl in (("roundtrip", "round trip bps"), ("drag", "drag bps/yr"),
                   ("adv", "ADV $mm"), ("spread", "spread bps"),
                   ("gold_beta", "beta to gold"), ("te", "tracking err %"),
                   ("vol", "vol % ann")):
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
