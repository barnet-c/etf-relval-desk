"""
Build the two relative-value datasets that power the ETF desk.

Pulls daily OHLCV for the six ETFs (plus their benchmark asset) from the public
Yahoo Finance chart endpoint, then derives:

  1. etf_crre_arb.csv       creation / redemption arbitrage panel
  2. etf_liquidity_arb.csv  liquidity arbitrage panel

Standard library only -- no third party dependencies.

Usage:  python scripts/build_datasets.py
"""

import csv
import json
import math
import os
import ssl
import time
import urllib.error
import urllib.parse
import urllib.request

# --------------------------------------------------------------------------
# universe
# --------------------------------------------------------------------------

ETFS = {
    "IBIT": {"name": "iShares Bitcoin Trust ETF",          "sponsor": "BlackRock",       "asset": "BTC",  "fee": 0.25},
    "FBTC": {"name": "Fidelity Wise Origin Bitcoin Fund",  "sponsor": "Fidelity",        "asset": "BTC",  "fee": 0.25},
    "GBTC": {"name": "Grayscale Bitcoin Trust ETF",        "sponsor": "Grayscale",       "asset": "BTC",  "fee": 1.50},
    "ARKB": {"name": "ARK 21Shares Bitcoin ETF",           "sponsor": "ARK / 21Shares",  "asset": "BTC",  "fee": 0.21},
    "BITB": {"name": "Bitwise Bitcoin ETF",                "sponsor": "Bitwise",         "asset": "BTC",  "fee": 0.20},
    "IAU":  {"name": "iShares Gold Trust",                 "sponsor": "BlackRock",       "asset": "GOLD", "fee": 0.25},
}

BENCHMARKS = {"BTC": "BTC-USD", "GOLD": "GC=F"}

RANGE = "2y"
INTERVAL = "1d"

BETA_WINDOW = 60      # rolling window for the fair-value beta
TE_WINDOW = 20        # rolling window for tracking-error vol
DISLOCATION_LAG = 5   # cumulative residual horizon for the arb signal
ILLIQ_WINDOW = 21     # rolling window for the Amihud measure
WARMUP = 20           # sessions dropped so every rolling window is fully populated

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
# small statistics helpers
# --------------------------------------------------------------------------

def mean(xs):
    return sum(xs) / len(xs) if xs else 0.0


def stdev(xs):
    if len(xs) < 2:
        return 0.0
    m = mean(xs)
    return math.sqrt(sum((x - m) ** 2 for x in xs) / (len(xs) - 1))


def zscore(xs):
    m, s = mean(xs), stdev(xs)
    if s == 0:
        return [0.0 for _ in xs]
    return [(x - m) / s for x in xs]


def quartile_bucket(value, cuts):
    """Map a value onto 1..4 using three precomputed cut points."""
    for i, cut in enumerate(cuts):
        if value <= cut:
            return i + 1
    return 4


def quartile_cuts(xs):
    s = sorted(xs)
    if not s:
        return [0, 0, 0]
    return [s[int(len(s) * q)] if int(len(s) * q) < len(s) else s[-1]
            for q in (0.25, 0.50, 0.75)]


def rolling_beta(asset_rets, bench_rets, window):
    """Rolling OLS beta of asset on benchmark; falls back to 1.0 while warming up."""
    betas = []
    for i in range(len(asset_rets)):
        lo = max(0, i - window + 1)
        a = asset_rets[lo:i + 1]
        b = bench_rets[lo:i + 1]
        if len(a) < 10:
            betas.append(1.0)
            continue
        mb = mean(b)
        var = sum((x - mb) ** 2 for x in b)
        if var == 0:
            betas.append(1.0)
            continue
        ma = mean(a)
        cov = sum((a[j] - ma) * (b[j] - mb) for j in range(len(a)))
        betas.append(cov / var)
    return betas


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
    print("downloading benchmarks ...")
    bench = {}
    for asset, symbol in BENCHMARKS.items():
        bench[asset] = fetch_series(symbol)
        print(f"  {asset:<4} {symbol:<9} {len(bench[asset])} bars")

    print("downloading ETFs ...")
    series = {}
    for ticker in ETFS:
        series[ticker] = fetch_series(ticker)
        print(f"  {ticker:<4} {len(series[ticker])} bars")

    # common trading calendar across every ETF
    common = None
    for rows in series.values():
        days = set(rows)
        common = days if common is None else (common & days)
    calendar = sorted(common)
    print(f"common calendar: {len(calendar)} sessions "
          f"({calendar[0]} -> {calendar[-1]})")

    panel = {}
    for ticker, meta in ETFS.items():
        rows = series[ticker]
        bench_rows = bench[meta["asset"]]

        # forward-fill the benchmark onto the ETF calendar
        bench_close, last = [], None
        for day in calendar:
            if day in bench_rows:
                last = bench_rows[day]["close"]
            bench_close.append(last)
        first_valid = next((c for c in bench_close if c is not None), 1.0)
        bench_close = [c if c is not None else first_valid for c in bench_close]

        close = [rows[d]["close"] for d in calendar]
        high = [rows[d]["high"] for d in calendar]
        low = [rows[d]["low"] for d in calendar]
        vol = [rows[d]["volume"] for d in calendar]

        rets = [0.0] + [math.log(close[i] / close[i - 1]) for i in range(1, len(close))]
        brets = [0.0] + [math.log(bench_close[i] / bench_close[i - 1])
                         for i in range(1, len(bench_close))]

        betas = rolling_beta(rets, brets, BETA_WINDOW)
        resid = [rets[i] - betas[i] * brets[i] for i in range(len(rets))]

        # --- creation / redemption arbitrage -----------------------------
        # tracking error vol -> the risk an AP warehouses on the basket
        te = []
        for i in range(len(resid)):
            lo = max(0, i - TE_WINDOW + 1)
            te.append(stdev(resid[lo:i + 1]) * math.sqrt(252) * 100.0)

        # cumulative residual -> how far the fund has drifted from fair value
        disloc = []
        for i in range(len(resid)):
            lo = max(0, i - DISLOCATION_LAG + 1)
            disloc.append(sum(resid[lo:i + 1]) * 10000.0)

        # --- liquidity arbitrage -----------------------------------------
        # the daily Corwin-Schultz estimate is clamped at zero, which piles a
        # lot of sessions onto an artificial floor -- average it over the same
        # window as the Amihud measure to recover a usable "typical" spread
        spread_raw = corwin_schultz(high, low)
        spread = []
        for i in range(len(spread_raw)):
            lo = max(0, i - ILLIQ_WINDOW + 1)
            spread.append(mean(spread_raw[lo:i + 1]))

        dollar_vol = [close[i] * vol[i] for i in range(len(close))]

        illiq_raw = []
        for i in range(len(rets)):
            dv = dollar_vol[i]
            illiq_raw.append(abs(rets[i]) / (dv / 1e6) if dv > 0 else 0.0)

        illiq = []
        for i in range(len(illiq_raw)):
            lo = max(0, i - ILLIQ_WINDOW + 1)
            window = [x for x in illiq_raw[lo:i + 1] if x > 0]
            illiq.append(math.log10(mean(window)) if window else -6.0)

        adv = []
        for i in range(len(dollar_vol)):
            lo = max(0, i - ILLIQ_WINDOW + 1)
            adv.append(mean(dollar_vol[lo:i + 1]) / 1e6)

        panel[ticker] = {
            "date": calendar, "close": close, "volume": vol,
            "te": te, "disloc": disloc, "beta": betas,
            "spread": spread, "illiq": illiq, "adv": adv,
        }

    return calendar, panel


def write_datasets(calendar, panel):
    os.makedirs(OUT_DIR, exist_ok=True)
    keep = range(WARMUP, len(calendar))

    # ---------------- creation / redemption arbitrage --------------------
    all_te = [panel[t]["te"][i] for t in panel for i in keep]
    all_dis = [panel[t]["disloc"][i] for t in panel for i in keep]
    te_mu, te_sd = mean(all_te), stdev(all_te) or 1.0
    dis_mu, dis_sd = mean(all_dis), stdev(all_dis) or 1.0

    risk_z = [(v - te_mu) / te_sd for v in all_te]
    yield_z = [(v - dis_mu) / dis_sd for v in all_dis]
    risk_cuts, yield_cuts = quartile_cuts(risk_z), quartile_cuts(yield_z)

    path = os.path.join(OUT_DIR, "etf_crre_arb.csv")
    with open(path, "w", newline="", encoding="utf-8") as fh:
        w = csv.writer(fh)
        w.writerow(["", "Ticker", "Risk", "Yield", "Price", "Date", "Fund",
                    "Sponsor", "Asset", "Fee", "TrackingError", "Dislocation",
                    "Beta", "Volume", "Classifications"])
        idx = 0
        for ticker, meta in ETFS.items():
            d = panel[ticker]
            for i in keep:
                risk = (d["te"][i] - te_mu) / te_sd
                yld = (d["disloc"][i] - dis_mu) / dis_sd
                cls = (f"{quartile_bucket(risk, risk_cuts)}-"
                       f"{quartile_bucket(yld, yield_cuts)}")
                w.writerow([idx, ticker, round(risk, 6), round(yld, 6),
                            round(d["close"][i], 4), d["date"][i], meta["name"],
                            meta["sponsor"], meta["asset"], meta["fee"],
                            round(d["te"][i], 4), round(d["disloc"][i], 3),
                            round(d["beta"][i], 4), int(d["volume"][i]), cls])
                idx += 1
    print(f"wrote {path}  ({idx} rows)")

    # ---------------- liquidity arbitrage --------------------------------
    all_illiq = [panel[t]["illiq"][i] for t in panel for i in keep]
    all_spread = [panel[t]["spread"][i] for t in panel for i in keep]
    il_mu, il_sd = mean(all_illiq), stdev(all_illiq) or 1.0
    sp_mu, sp_sd = mean(all_spread), stdev(all_spread) or 1.0

    risk_cuts = quartile_cuts([(v - il_mu) / il_sd for v in all_illiq])
    yield_cuts = quartile_cuts([(v - sp_mu) / sp_sd for v in all_spread])

    path = os.path.join(OUT_DIR, "etf_liquidity_arb.csv")
    with open(path, "w", newline="", encoding="utf-8") as fh:
        w = csv.writer(fh)
        w.writerow(["", "Ticker", "Risk", "Yield", "Price", "Date", "Fund",
                    "Sponsor", "Asset", "Fee", "SpreadBps", "Illiquidity",
                    "ADV", "Volume", "Classifications"])
        idx = 0
        for ticker, meta in ETFS.items():
            d = panel[ticker]
            for i in keep:
                risk = (d["illiq"][i] - il_mu) / il_sd
                yld = (d["spread"][i] - sp_mu) / sp_sd
                cls = (f"{quartile_bucket(risk, risk_cuts)}-"
                       f"{quartile_bucket(yld, yield_cuts)}")
                w.writerow([idx, ticker, round(risk, 6), round(yld, 6),
                            round(d["close"][i], 4), d["date"][i], meta["name"],
                            meta["sponsor"], meta["asset"], meta["fee"],
                            round(d["spread"][i], 3), round(d["illiq"][i], 4),
                            round(d["adv"][i], 2), int(d["volume"][i]), cls])
                idx += 1
    print(f"wrote {path}  ({idx} rows)")


if __name__ == "__main__":
    cal, pnl = build_panel()
    write_datasets(cal, pnl)
