import React from 'react';
import { FAMILIES, FAMILY_ORDER } from './etfUniverse';

function Formula({ tag, name, unit, code, plain, children }) {
  return (
    <div className="formula">
      <div className="formula-head">
        <span className="formula-tag">{tag}</span>
        <span className="formula-name">{name}</span>
        {unit && <span className="formula-unit">{unit}</span>}
      </div>
      <pre>{code}</pre>
      {children && <p className="formula-note">{children}</p>}
      {plain && (
        <div className="plain">
          <span className="plain-tag">In plain English</span>
          <p>{plain}</p>
        </div>
      )}
    </div>
  );
}

export default function AboutPage() {
  return (
    <div className="doc">
      <div className="doc-hero">
        <div className="doc-kicker">Methodology</div>
        <h1>How this desk works</h1>
        <p className="doc-lede">
          Thirty-seven gold funds that all say &ldquo;gold&rdquo; on the tin and
          behave nothing like each other. This page explains every number on the
          desk &mdash; where it comes from, what it means, and where it stops
          being trustworthy. No prior knowledge assumed.
        </p>
      </div>

      {/* ── universe ─────────────────────────────────── */}
      <section id="universe">
        <h2>The universe</h2>
        <h3>Everything etf.com calls a gold ETF</h3>

        <p>
          The list is taken from <strong>etf.com/topics/gold</strong> in its
          100-row display, running from GLD down to NUGY &mdash; the full set the
          site publishes. The page states 40 US-listed gold ETFs in total; NUGY
          is the 38th, and the two rows below it are inverse notes with under
          $1.2m in assets.
        </p>

        <div className="note">
          <p>
            One of the 38, <strong>GLDY</strong>, launched too recently to have
            enough price history for any rolling statistic, so it is listed but
            not plotted. That leaves <strong>37 funds</strong> on the desk.
          </p>
        </div>

        <h4>They are not the same kind of thing</h4>

        <p>
          This is the single most important fact about the cohort. A physically
          backed trust and a daily-reset 3x note both appear on a gold screener,
          but they are different instruments with different risks. Every point on
          the desk is coloured by which of six structures it belongs to.
        </p>

        <div className="tablewrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>Structure</th>
                <th>What it is</th>
              </tr>
            </thead>
            <tbody>
              {FAMILY_ORDER.map((k) => (
                <tr key={k}>
                  <td className="tk">
                    <span className="swatch" style={{ background: FAMILIES[k].color }} />
                    {FAMILIES[k].label}
                  </td>
                  <td>{FAMILIES[k].blurb}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p>
          Click any structure in the strip above the chart to hide it;
          double-click to view it alone. Comparing a leveraged note against a
          bullion trust on the same axis is usually a mistake, and the filter is
          there to stop you making it by accident.
        </p>
      </section>

      {/* ── data ─────────────────────────────────── */}
      <section id="data">
        <h2>Inputs</h2>
        <h3>Where the numbers come from</h3>

        <p>
          Every plotted value is derived from free daily price data &mdash; the
          open, high, low, close and volume for each fund, pulled from Yahoo
          Finance&rsquo;s public chart endpoint. Nothing here needs a paid
          terminal.
        </p>

        <div className="formula">
          <div className="formula-head">
            <span className="formula-tag">SRC</span>
            <span className="formula-name">Price feed</span>
          </div>
          <pre>{`https://query1.finance.yahoo.com/v8/finance/chart/{SYMBOL}
    ?range=2y&interval=1d`}</pre>
          <p className="formula-note">
            Plus two benchmarks: <code>GC=F</code> (COMEX gold futures) and{' '}
            <code>GDX</code>, the miner index, used as the reference for
            miner-linked funds.
          </p>
        </div>

        <div className="note warn">
          <p>
            <strong>Fund assets and stated fees are quoted from etf.com</strong>{' '}
            and appear in the tooltip as context. They are never plotted. Every
            axis is derived from price, so nothing on the chart depends on a
            figure this desk cannot recompute.
          </p>
        </div>

        <p>
          Each fund is measured on <strong>its own history</strong>, not on a
          calendar shared by all 37. The newest fund here has about nine months
          of data; forcing everything onto a common window would have thrown away
          more than half of GLD&rsquo;s history to gain nothing.
        </p>

        <Formula
          tag="1"
          name="Daily log return"
          unit="decimal"
          code={`r_t = ln( close_t / close_(t-1) )      the fund
b_t = ln( bench_t / bench_(t-1) )      gold or the miner index`}
          plain="Today's price divided by yesterday's, then a logarithm. Logs are used instead of plain percentages because they add up cleanly over time."
        />
      </section>

      {/* ── cost panel ─────────────────────────────────── */}
      <section id="cost">
        <h2>Panel one</h2>
        <h3>Cost of ownership</h3>

        <p>
          Two costs decide what a fund really charges you, and neither is the
          number on the fact sheet. There is what you pay to <em>get in and
          out</em>, and what the fund quietly costs you <em>per year you hold
          it</em>.
        </p>

        <h4>The horizontal axis &mdash; getting in and out</h4>

        <p>
          Daily data has no bid and no ask. But there is a well-known way to
          recover the spread from just the daily high and low, published by
          Corwin and Schultz in 2012. Over two days, the high-to-low range
          reflects both real price movement and the spread &mdash; and real
          movement scales with time while the spread does not. Compare one
          day&rsquo;s range with a two-day range and the spread falls out.
        </p>

        <Formula
          tag="2"
          name="Corwin&ndash;Schultz spread estimator"
          unit="basis points"
          code={`k = 3 \u2212 2\u221A2

beta  = ln(H_(t-1) / L_(t-1))\u00B2  +  ln(H_t / L_t)\u00B2
gamma = ln( max(H_(t-1), H_t) / min(L_(t-1), L_t) )\u00B2

alpha = ( \u221A(2\u00B7beta) \u2212 \u221Abeta ) / k  \u2212  \u221A( gamma / k )

Spread_t = 2 \u00B7 (e^alpha \u2212 1) / (1 + e^alpha)   \u00D7 10,000`}
          plain="An estimate of the gap between the buy price and the sell price, worked out from the daily high and low alone. Roughly: what you lose instantly by buying and immediately selling."
        >
          Averaged over 21 sessions, because the daily version is clipped at zero
          whenever the maths returns a negative number.
        </Formula>

        <p>
          Then there is your own footprint. A large order in a thin fund pushes
          the price against you. Amihud&rsquo;s 2002 measure captures that in one
          number: how far the price moves per million dollars traded.
        </p>

        <Formula
          tag="3"
          name="Round-trip trading cost"
          unit="basis points"
          code={`illiq_t = | r_t |  /  ( close_t \u00B7 volume_t / 1,000,000 )

RoundTrip_t = Spread_t  +  ( median illiq over 21 sessions \u00D7 $1mm \u00D7 10,000 )`}
          plain="What one complete buy-and-sell costs on a one-million-dollar order: the spread you cross, plus the price you move by showing up."
        >
          The median, not the average. Amihud puts turnover in the denominator,
          so a single near-dead session sends an average to infinity &mdash; and
          the thinnest funds here have sessions like that. Quoted for a $1m clip
          so the funds are comparable; for the smallest funds on the desk that
          clip is a large share of a day&rsquo;s volume, and the cost shown says
          so.
        </Formula>

        <h4>The vertical axis &mdash; the cost of holding it</h4>

        <p>
          Rather than quote the stated expense ratio, the desk measures what the
          fund <em>actually</em> cost. Strip out the benchmark move and whatever
          systematic loss is left over is the real drag &mdash; fees, roll costs,
          compounding decay, tracking slippage, all of it, whether or not it
          appears in a prospectus.
        </p>

        <Formula
          tag="4"
          name="Realised holding drag"
          unit="basis points per year"
          code={`beta_t  = Cov(r, b) / Var(b)          over the last 60 sessions
resid_t = r_t \u2212 beta_t \u00B7 b_t

Drag = \u2212 mean( resid over the last 126 sessions ) \u00D7 252 \u00D7 10,000`}
          plain="How much the fund lost its holder each year beyond what its benchmark did. Positive means it bled value; negative means it actually did slightly better than its exposure implies."
        >
          126 sessions is about six months. Because this is measured rather than
          quoted, it captures things a fee table never shows &mdash; most
          obviously the compounding decay in daily-reset leveraged products.
        </Formula>

        <div className="note warn">
          <p>
            <strong>Why that axis looks strange.</strong> Holding drag runs from
            roughly &minus;3,000 bps/yr to &#43;18,000 bps/yr across this cohort,
            and it takes both signs, so neither a normal nor a logarithmic axis
            can show it. The plot uses a <strong>log-modulus</strong> scale,{' '}
            <code>sign(x) &times; log10(1 + |x|)</code>, which keeps the sign and
            compresses the tail. <strong>The tick labels are real bps per
            year</strong> &mdash; each step is ten times the last.
          </p>
        </div>

        <p>
          The best place to sit is the <strong>bottom left</strong>: cheap to
          trade, and it does not bleed while you hold it. The physical trusts
          cluster there. The leveraged and inverse products sit far up the
          vertical axis, and that is not a defect &mdash; it is what daily
          rebalancing does, working exactly as designed.
        </p>
      </section>

      {/* ── liquidity ─────────────────────────────────── */}
      <section id="liquidity">
        <h2>Panel two</h2>
        <h3>Liquidity</h3>

        <p>
          Can you actually get the size you want, and what will it cost you at
          the touch? Turnover across this cohort spans five orders of magnitude,
          from about $13bn a day to under $100k, so both axes are logarithmic.
        </p>

        <Formula
          tag="5"
          name="Average daily turnover"
          unit="US$ millions"
          code={`ADV = mean( close_t \u00D7 volume_t  over 21 sessions ) / 1,000,000`}
          plain="How many dollars change hands in a typical day. The single best guide to whether you can get in and out without a fuss."
        />

        <p>
          The two axes lean against each other, which is the point: deep funds
          quote tight and thin funds quote wide. What is worth looking for is a
          fund sitting <em>off</em> that line &mdash; unusually wide for its
          turnover, or unusually tight.
        </p>
      </section>

      {/* ── exposure ─────────────────────────────────── */}
      <section id="exposure">
        <h2>Panel three</h2>
        <h3>Exposure</h3>

        <p>
          The most useful question you can ask a fund with &ldquo;gold&rdquo; in
          its name is simple: <strong>how much gold do I actually get?</strong>{' '}
          Every fund here is regressed against COMEX gold, whatever it happens to
          hold, so all six structures land on one comparable scale.
        </p>

        <Formula
          tag="6"
          name="Beta to gold"
          unit="ratio, 60-session"
          code={`GoldBeta_t = Cov(r, gold) / Var(gold)

           = \u03A3 (r_j \u2212 r\u0304)(g_j \u2212 g\u0304)
             \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500      over the last 60 sessions
                  \u03A3 (g_j \u2212 g\u0304)\u00B2`}
          plain="How much the fund moves when gold moves 1%. A bullion trust should sit near 1. A 3x product should sit near 3. An inverse should be negative."
        >
          This doubles as a validity check on the whole desk. If the leveraged
          products did not print near their stated multiples, something upstream
          would be wrong.
        </Formula>

        <p>
          The vertical axis is realised volatility, logarithmic, so you can read
          the risk you are taking to obtain that exposure. Two funds with the
          same beta but different volatility are not equivalent &mdash; the
          noisier one is carrying risk that has nothing to do with gold.
        </p>
      </section>

      {/* ── scale ─────────────────────────────────── */}
      <section id="scale">
        <h2>Scale</h2>
        <h3>Why there are no z-scores here</h3>

        <p>
          An earlier version of this desk standardised every axis &mdash; each
          value rewritten as standard deviations from the average. That works
          when the things being compared are alike. It fails badly here.
        </p>

        <p>
          A z-score answers &ldquo;how unusual is this within the group?&rdquo;
          But this group contains a $154bn bullion trust and a $6m note, products
          ranging from &minus;3x to &#43;3x. Standardising would report that a
          3x fund is &ldquo;2.4 standard deviations above average&rdquo; when
          what you actually want to know is that it is <strong>3x</strong>.
        </p>

        <p>
          So every axis stays in the unit it was measured in &mdash; basis
          points, basis points per year, dollars, beta, percent &mdash; and where
          a span crosses orders of magnitude the axis goes logarithmic instead of
          the data being squashed. <strong>Every tick label on this desk is a
          real number you could quote.</strong>
        </p>
      </section>

      {/* ── caveats ─────────────────────────────────── */}
      <section id="caveats">
        <h2>Limitations</h2>
        <h3>What this does not do</h3>

        <ul>
          <li>
            <strong>Spreads are estimated, not quoted.</strong>{' '}
            Corwin&ndash;Schultz infers a spread from the daily high and low. It
            is known to read high on volatile instruments, so the leveraged
            funds&rsquo; spreads are likely overstated relative to the bullion
            trusts.
          </li>
          <li>
            <strong>Daily bars, not intraday.</strong> Everything here describes
            structure over months. None of it tells you when to send an order.
          </li>
          <li>
            <strong>Drag is backward-looking.</strong> It measures what the last
            six months cost. Leveraged decay in particular depends on the
            volatility path and will differ in another regime.
          </li>
          <li>
            <strong>Beta moves.</strong> A 60-session window is a compromise. A
            fund&rsquo;s beta at any moment is an estimate, not a constant.
          </li>
          <li>
            <strong>Miner funds are benchmarked to miners.</strong> Tracking
            error for a miner fund is measured against the miner index, not gold
            &mdash; otherwise every one of them would look broken.
          </li>
          <li>
            <strong>It is not advice.</strong> This is a data visualisation built
            from public prices.
          </li>
        </ul>
      </section>

      <div className="doc-foot">
        Universe from etf.com/topics/gold, captured 25 August 2026. All plotted
        figures are computed in <code>scripts/build_datasets.py</code> using the
        Python standard library only. Re-run it and the entire desk regenerates
        from scratch. Fund names and tickers are the property of their issuers;
        this desk is not affiliated with any of them.
      </div>
    </div>
  );
}
