"""
The gold ETF roster, as listed by etf.com/topics/gold (100-row display mode),
captured 2026-08-25.

The source page states "With 40 ETFs traded in the U.S. markets, Gold ETFs
gather total assets under management of $276.69B." NUGY is row 38 of those 40;
the desk takes rows 1..38 (GLD -> NUGY). The two rows after NUGY (DGZ, DZZ) are
inverse Deutsche Bank ETNs under $1.2M and are outside the requested range.

AUM and ExpenseRatio are quoted from etf.com and are metadata only -- nothing
plotted is derived from them. Everything on the axes comes from price data.

`family` groups funds by what they actually do, because a 3x leveraged ETN and a
physically backed trust are not comparable on the same tracking metric.
`benchmark` is the series each fund's residual is measured against.
"""

# ticker: (name, issuer, aum_usd, expense_ratio_pct, family, benchmark)
GOLD_ROSTER = {
    "GLD":  ("SPDR Gold Shares",                      "World Gold Council",  154.58e9, 0.40, "physical",  "GC=F"),
    "IAU":  ("iShares Gold Trust",                    "BlackRock",            67.77e9, 0.25, "physical",  "GC=F"),
    "GLDM": ("SPDR Gold MiniShares",                  "World Gold Council",   32.03e9, 0.10, "physical",  "GC=F"),
    "GDX":  ("VanEck Gold Miners ETF",                "VanEck",               32.03e9, 0.51, "miners",    "GDX"),
    "GDXJ": ("VanEck Junior Gold Miners ETF",         "VanEck",                9.86e9, 0.52, "miners",    "GDX"),
    "IAUM": ("iShares Gold Trust Micro",              "BlackRock",             8.02e9, 0.09, "physical",  "GC=F"),
    "SGOL": ("abrdn Physical Gold Shares",            "abrdn",                 7.75e9, 0.17, "physical",  "GC=F"),
    "OUNZ": ("VanEck Merk Gold ETF",                  "VanEck",                2.88e9, 0.25, "physical",  "GC=F"),
    "AAAU": ("Goldman Sachs Physical Gold ETF",       "Goldman Sachs",         2.86e9, 0.18, "physical",  "GC=F"),
    "RING": ("iShares MSCI Global Gold Miners",       "BlackRock",             2.58e9, 0.39, "miners",    "GDX"),
    "GDXU": ("MicroSectors Gold Miners 3X Lev ETN",   "BMO",                   1.67e9, 0.95, "lev_miners","GDX"),
    "BAR":  ("GraniteShares Gold Shares",             "GraniteShares",         1.47e9, 0.17, "physical",  "GC=F"),
    "NUGT": ("Direxion Daily Gold Miners Bull 2X",    "Direxion",              1.46e9, 1.13, "lev_miners","GDX"),
    "UGL":  ("ProShares Ultra Gold",                  "ProShares",           958.75e6, 0.95, "lev_gold",  "GC=F"),
    "SGDM": ("Sprott Gold Miners ETF",                "Sprott",              738.19e6, 0.46, "miners",    "GDX"),
    "JNUG": ("Direxion Daily Jr Gold Miners Bull 2X", "Direxion",            655.36e6, 1.03, "lev_miners","GDX"),
    "IAUI": ("NEOS Gold High Income ETF",             "NEOS",                588.57e6, 0.79, "income",    "GC=F"),
    "FGDL": ("Franklin Responsibly Sourced Gold",     "Franklin Templeton",  469.55e6, 0.15, "physical",  "GC=F"),
    "SGDJ": ("Sprott Junior Gold Miners ETF",         "Sprott",              369.90e6, 0.50, "miners",    "GDX"),
    "GDXY": ("YieldMax Gold Miners Option Income",    "YieldMax",            316.85e6, 1.00, "income",    "GDX"),
    "DGP":  ("DB Gold Double Long ETN",               "Deutsche Bank",       237.73e6, 0.75, "lev_gold",  "GC=F"),
    "GLDI": ("UBS ETRACS Gold Covered Call ETN",      "UBS",                 176.85e6, 0.65, "income",    "GC=F"),
    "KGLD": ("Kurv Gold Enhanced Income ETF",         "Kurv",                149.06e6, 1.00, "income",    "GC=F"),
    "GOEX": ("Global X Gold Explorers ETF",           "Mirae / Global X",    144.99e6, 0.65, "miners",    "GDX"),
    "SHNY": ("MicroSectors Gold 3X Leveraged ETN",    "BMO",                 114.13e6, 0.95, "lev_gold",  "GC=F"),
    "DUST": ("Direxion Daily Gold Miners Bear 2X",    "Direxion",             92.34e6, 0.94, "inverse",   "GDX"),
    "GDXW": ("Roundhill Gold Miners WeeklyPay",       "Roundhill",            90.93e6, 0.99, "income",    "GDX"),
    "GLL":  ("ProShares UltraShort Gold",             "ProShares",            88.55e6, 0.95, "inverse",   "GC=F"),
    "GDXD": ("MicroSectors Gold Miners -3X ETN",      "BMO",                  77.47e6, 0.95, "inverse",   "GDX"),
    "YGLD": ("Simplify Gold Strategy ETF",            "Simplify",             43.57e6, 0.53, "income",    "GC=F"),
    "JDST": ("Direxion Daily Jr Gold Miners Bear 2X", "Direxion",             28.12e6, 0.92, "inverse",   "GDX"),
    "AUMI": ("Themes Gold Miners ETF",                "Themes",               27.92e6, 0.35, "miners",    "GDX"),
    "GLDY": ("Defiance Gold Enhanced Options Income", "Defiance",             26.10e6, 1.04, "income",    "GC=F"),
    "GLDW": ("Roundhill Gold WeeklyPay ETF",          "Roundhill",            18.52e6, 0.99, "income",    "GC=F"),
    "DULL": ("MicroSectors Gold -3X Inverse ETN",     "BMO",                  13.10e6, 0.95, "inverse",   "GC=F"),
    "USG":  ("USCF Gold Strategy Plus Income",        "USCF / Marygold",       8.74e6, 0.45, "income",    "GC=F"),
    "AUAU": ("Global X Gold Miners ETF",              "Mirae / Global X",      7.08e6, 0.35, "miners",    "GDX"),
    "NUGY": ("GraniteShares YieldBOOST Gold Miners",  "GraniteShares",         6.47e6, 1.07, "income",    "GDX"),
}

FAMILIES = {
    "physical":   "Physical gold",
    "miners":     "Gold miners",
    "lev_gold":   "Leveraged gold",
    "lev_miners": "Leveraged miners",
    "inverse":    "Inverse",
    "income":     "Option income",
}

SOURCE = "etf.com/topics/gold, 100-row display, captured 2026-08-25"
