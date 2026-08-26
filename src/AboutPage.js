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

      {/* ── arbitrage ─────────────────────────────────── */}
      <section id="arbitrage">
        <h2>Panel one</h2>
        <h3>Creation arbitrage</h3>

        <p>
          Most of this desk asks what a fund costs <em>you</em>. This panel
          asks a different question, from the other side of the screen: when
          the traded price drifts away from what the fund actually holds,{' '}
          <strong>is the gap big enough for anyone to bother closing
          it?</strong>
        </p>

        <p>
          That is the job of an authorised participant. If the ETF trades rich
          it sells the ETF, buys the basket, and delivers it to the issuer for
          new shares. If it trades cheap it does the reverse. The trade only
          exists if the dislocation is wider than the cost of doing it &mdash;
          and that cost is the horizontal axis here.
        </p>

        <h4>Step one &mdash; what the basket is worth</h4>

        <p>
          The textbook version prices the basket line by line, weight times
          executable price, ask for a creation and bid for a redemption. This
          desk has no basket file and no quotes, so the basket is proxied by the
          fund&rsquo;s <strong>own benchmark</strong> &mdash; COMEX gold, or the
          miner index for miner funds &mdash; rolled forward on the beta fitted
          in panel five, and bled down by the fee the NAV accrues along
          the way.
        </p>

        <Formula
          tag="2"
          name="Basket fair value"
          unit="price"
          code={`FV_t = P_(t−W) · exp(  Σ beta_s · b_s  −  (ER/252) · W  )
                        s = t−W+1 .. t

W = 21 sessions      b_s = benchmark log return
beta_s = the fund's own 60-session beta to that benchmark`}
          plain="Take the fund's price three weeks ago, push it forward by whatever gold did since — scaled by how much gold the fund actually gives you — then subtract the management fee it has quietly accrued. That is roughly what a share should be worth today."
        >
          Anchoring on the fund&rsquo;s own price rather than a published NAV is
          what makes this computable from free data. It also means the measure
          is a <em>relative</em> dislocation over the last 21 sessions, not an
          absolute premium to NAV.
        </Formula>

        <Formula
          tag="3"
          name="Gross arbitrage spread"
          unit="basis points"
          code={`GrossSpread_t = ( P_ETF,t − FV_t ) / FV_t  × 10,000`}
          plain="How far the market price has wandered from that fair value, in hundredths of a percent. Positive means the ETF is expensive relative to what it holds; negative means it is cheap."
        />

        <h4>The horizontal axis &mdash; what the trade costs</h4>

        <p>
          Every arbitrage crosses <strong>two</strong> markets, and the textbook
          splits the cost accordingly. The ETF leg pays half a spread, plus the
          impact of its own size, plus commission. The basket leg pays half a
          spread and its own impact. On top of both sit two cash items: the
          issuer&rsquo;s creation fee, and the cost of funding the position over
          the settlement gap.
        </p>

        <Formula
          tag="4"
          name="Total execution cost  (D₂)"
          unit="basis points"
          code={`C_ETF    = Spread_ETF / 2   +  MI_ETF  +  Commission
C_basket = Spread_bench / 2  +  MI_basket

D2 = C_ETF  +  C_basket  +  CreationFee  +  Financing`}
          plain="Add up every toll the round trip pays: half the gap between buy and sell on each of the two markets, the price you move by trading size, the broker's cut, the issuer's fee for printing new shares, and one night of interest."
        >
          Both spreads come from the same Corwin&ndash;Schultz estimator as
          formula 7 in panel three &mdash; the fund&rsquo;s on the fund, the
          benchmark&rsquo;s on the benchmark. <code>MI_ETF</code> is the Amihud
          impact of formula 8 for a $1m clip. Note that this is a{' '}
          <em>one-way</em> cost on each leg, unlike the round trip in panel
          three, which crosses the same market twice.
        </Formula>

        <div className="note warn">
          <p>
            <strong>Four of these numbers are invented, not sourced.</strong>{' '}
            Only the two spread terms and <code>MI_ETF</code> are measured from
            price data. Commission (<strong>0.5 bps</strong>), financing (an
            assumed <strong>4.3%</strong> annualised over <strong>T+1</strong>,
            about 1.2 bps), the creation fee (<strong>1.0&ndash;3.0 bps</strong>{' '}
            by structure) and basket impact (<strong>0.5 bps</strong> against
            gold futures, <strong>1.5 bps</strong> against the miner basket) are
            placeholder constants of roughly the right order of magnitude.{' '}
            <strong>No prospectus, fee schedule or funding curve was
            consulted for any of them.</strong> Basket impact in particular is
            assumed rather than measured because Yahoo reports{' '}
            <code>GC=F</code> volume in contracts and reports it unreliably, so
            an Amihud measure on it would be noise. All five sit at the top of{' '}
            <code>scripts/build_datasets.py</code>; replace them with real data
            before quoting a number off this panel.
          </p>
        </div>

        <h4>The vertical axis &mdash; what survives</h4>

        <Formula
          tag="5"
          name="Net arbitrage spread"
          unit="basis points"
          code={`NetSpread_t = | GrossSpread_t |  −  D2_t`}
          plain="The dislocation minus everything it costs to capture. Above zero, the trade pays for itself. Below zero, the price can stay 'wrong' all day and nobody has a reason to correct it."
        >
          The absolute value is deliberate: an AP creates when the ETF is rich
          and redeems when it is cheap, so what has to clear the cost is the{' '}
          <em>size</em> of the dislocation, not its direction. The signed gross
          spread is in the tooltip if you want to know which way it pointed.
        </Formula>

        <div className="note warn">
          <p>
            <strong>Why that axis looks strange too.</strong> The horizontal
            axis is <strong>logarithmic</strong> and{' '}
            <strong>reversed</strong> &mdash; cost grows to the <em>left</em>,
            and each labelled step that way is ten times the last. The practical
            reading: <strong>the further right a point sits, the cheaper it is
            to arbitrage</strong>. Execution cost is strictly positive, so the
            axis never reaches zero.
          </p>
        </div>

        <div className="note">
          <p>
            <strong>Reading the panel.</strong> The horizontal zero line is the
            whole story: above it a dislocation is wide enough to pay for its
            own correction, below it the price can stay &ldquo;wrong&rdquo; and
            nobody has a reason to fix it. The{' '}
            <strong>physical trusts</strong> sit furthest right &mdash; a
            median D₂ of about <strong>26 bps</strong>, roughly a quarter of
            what the miner and inverse structures pay &mdash; which is why
            bullion ETFs track as tightly as they do. The interesting family is{' '}
            <strong>gold miners</strong>: median execution cost around{' '}
            <strong>95 bps</strong> against a median dislocation of only{' '}
            <strong>101 bps</strong>, so the typical session leaves nothing on
            the table and the net spread is negative <strong>58%</strong> of the
            time &mdash; the only structure here where that is true.
          </p>
        </div>

        <div className="note warn">
          <p>
            <strong>Do not read the level as free money.</strong> The median net
            spread is positive for five of the six structures, which no real
            market would leave alone. That is the fair-value proxy showing
            through: formula 2 measures drift away from a 21-session
            beta-implied path, and a fund can drift from that path for reasons
            an AP cannot monetise &mdash; beta estimation error, a benchmark
            that is not really its basket, genuine tracking slippage. A true
            premium to NAV would be far smaller. Compare structures against each
            other, and watch which side of the line they sit on; do not read the
            height above zero as a P&amp;L.
          </p>
        </div>

      </section>

      {/* ── arbitrage 3d ─────────────────────────────────── */}
      <section id="arbitrage-3d">
        <h2>Panel two</h2>
        <h3>Creation arbitrage in three dimensions</h3>

        <p>
          Panel one tells you whether a dislocation is <em>worth</em> closing.
          It does not tell you how long your money is tied up while it closes,
          and a trade that pays 40 bps in two days is not the same trade as one
          that pays 40 bps in a month. This panel keeps both arbitrage axes
          exactly as they were and adds that third question on the vertical:{' '}
          <strong>once the position is on, how long does the gap historically
          take to shut?</strong>
        </p>

        <h4>The third axis &mdash; how fast it closes</h4>

        <p>
          Take the same relative dislocation from formula 3 and ask whether it
          mean-reverts. Regress today&rsquo;s <em>change</em> in the spread on
          yesterday&rsquo;s <em>level</em>. A negative slope means a wide gap
          tends to narrow, and the size of that slope says how quickly. Turn it
          into a half-life &mdash; the number of sessions for any gap to shrink
          by half &mdash; and it becomes a number you can compare across funds.
        </p>

        <Formula
          tag="6"
          name="Convergence half-life"
          unit="sessions"
          code={`S_t = ( P_ETF,t − FV_t ) / FV_t

ΔS_t = alpha  +  beta · S_(t−1)  +  e_t      over 60 sessions

  equivalently   S_t = c + (1 + beta) · S_(t−1) + e_t

HalfLife = − ln(2) / ln(1 + beta)`}
          plain="Fit a line to how much of yesterday's gap disappeared today, then work out how many days it takes for half of any gap to melt away. A day or two means the market is policing itself; three weeks means it is not."
        >
          Only a mean-reverting fit has a half-life, so this is left blank
          unless <code>&minus;1 &lt; beta &lt; 0</code>. That holds for{' '}
          <strong>99%</strong> of fund-sessions here; the remaining 1% leaves a
          gap in the point cloud rather than a fabricated number. A fit that
          reverts almost imperceptibly can throw an enormous half-life, so the
          value is clamped at <strong>999 sessions</strong> &mdash; read
          anything near the top of the axis as &ldquo;this does not converge on
          any horizon you would trade,&rdquo; not as a measurement. It bites on
          three rows out of twelve thousand.
        </Formula>

        <div className="note warn">
          <p>
            <strong>Daily bars are the wrong frequency for this, and that
            matters.</strong> Create/redeem is an intraday trade; the textbook
            fits this regression on 1- or 5-minute bars, where a half-life of
            &ldquo;six periods&rdquo; means half an hour. Free daily closes are
            the coarsest frequency that still says anything, so a half-life
            under one session here should be read as <em>within a day</em> and
            no finer. The cross-sectional ranking is the usable output; the
            absolute number is not.
          </p>
        </div>

        <div className="note">
          <p>
            <strong>Reading the panel.</strong> The good corner is{' '}
            <strong>low and to the right</strong> &mdash; cheap to put on, and
            quick to come back. The two axes agree more often than not, which is
            the mechanism working: <strong>physical trusts</strong> are both the
            cheapest to arbitrage and the fastest to converge, a median
            half-life of <strong>1.3 sessions</strong> with{' '}
            <strong>99%</strong> of sessions under five. The far corner belongs
            to <strong>leveraged miners</strong> at a median of{' '}
            <strong>8.9 sessions</strong>, with only <strong>20%</strong> under
            five &mdash; expensive to correct <em>and</em> slow to correct, which
            is exactly the combination that lets a price stay wrong. Gold miners
            and inverse funds sit between the two at roughly{' '}
            <strong>4.4&ndash;4.9 sessions</strong>.
          </p>
        </div>

        <div className="note warn">
          <p>
            <strong>Drag to rotate.</strong> Three-dimensional scatter hides
            points behind other points from any single angle, so no one camera
            position tells the truth about this cloud. Spin it. The tooltip
            carries the exact half-life, execution cost and both spreads for
            whichever point you are actually looking at.
          </p>
        </div>
      </section>

      {/* ── cost panel ─────────────────────────────────── */}
      <section id="cost">
        <h2>Panel three</h2>
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
          tag="7"
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
          tag="8"
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
          tag="9"
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
        <h2>Panel four</h2>
        <h3>Liquidity</h3>

        <p>
          Can you actually get the size you want, and what will it cost you at
          the touch? Turnover across this cohort spans five orders of magnitude,
          from about $13bn a day to under $100k, so both axes are logarithmic.
        </p>

        <Formula
          tag="10"
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
        <h2>Panel five</h2>
        <h3>Exposure</h3>

        <p>
          The most useful question you can ask a fund with &ldquo;gold&rdquo; in
          its name is simple: <strong>how much gold do I actually get?</strong>{' '}
          Every fund here is regressed against COMEX gold, whatever it happens to
          hold, so all six structures land on one comparable scale.
        </p>

        <Formula
          tag="11"
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
            <strong>The arbitrage panel has no basket and no NAV.</strong> A
            real desk prices the creation basket constituent by constituent off
            executable quotes and compares it to the published NAV. Panel one
            proxies the basket with a beta-scaled benchmark anchored on the
            fund&rsquo;s own price, so it measures dislocation relative to the
            last 21 sessions rather than a true premium to net asset value. It
            reads directionally, not to the basis point.
          </li>
          <li>
            <strong>Its cash legs are assumed.</strong> Commission, financing,
            the creation fee and the basket&rsquo;s market impact are desk
            constants, listed in panel one and set at the top of the build
            script. On the thinnest funds they are a rounding error next to the
            spread; on the physical trusts they are most of the cost.
          </li>
          <li>
            <strong>Convergence is fitted on daily closes.</strong> Create and
            redeem is an intraday trade and the half-life regression belongs on
            minute bars. Daily data can rank funds from fast to slow, which is
            what panel two is for; it cannot tell you that a gap closes in six
            hours rather than twelve.
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
