/**
 * The panels the desk plots.
 *
 * Every axis is in REAL UNITS -- basis points, basis points per year, dollars
 * of daily turnover, beta, annualised percent. The cohort runs from a $154bn
 * bullion trust to a $6m ETN and from -3x to +3x leverage, so standardising
 * everything into z-scores would erase exactly the differences a reader is
 * here to see.
 *
 * Where a quantity spans orders of magnitude the axis is logarithmic, and
 * Plotly log ranges are expressed in log10 units. Holding drag takes both signs
 * and spans -3,000 to +18,000 bps/yr, so it is plotted on a log-modulus scale
 * -- sign(x) x log10(1+|x|) -- with the ticks written back in real bps/yr.
 *
 * Ranges below are sized from the p1/p99 printed by build_datasets.py.
 */

const F = (p) => `${process.env.PUBLIC_URL}/plotted_datasets/${p}`;

// Plotly does not decode HTML entities inside tick text or axis titles, so
// these have to be real Unicode characters rather than &minus; / &ndash;.
const MINUS = '\u2212';
const NDASH = '\u2013';

// log-modulus tick positions and their real-world labels
const DRAG_TICKS = {
  tickvals: [-3, -2, -1, 0, 1, 2, 3, 4],
  ticktext: [
    `${MINUS}1,000`, `${MINUS}100`, `${MINUS}10`,
    '0', '10', '100', '1,000', '10,000',
  ],
};

// On a log axis Plotly expects `range` in log10 units but `tickvals` in DATA
// units -- mixing them up silently renders a single mislabelled tick.
// DRAG_TICKS below is different: log-modulus is precomputed in the pipeline, so
// that axis is linear and its tickvals really are in transformed units.
const ADV_TICKS = {
  tickvals: [0.1, 1, 10, 100, 1000, 10000],
  ticktext: ['0.1', '1', '10', '100', '1,000', '10,000'],
};

const BPS_TICKS = {
  tickvals: [1, 3, 10, 30, 100, 300, 1000, 3000],
  ticktext: ['1', '3', '10', '30', '100', '300', '1,000', '3,000'],
};

const VOL_TICKS = {
  tickvals: [10, 20, 50, 100, 200],
  ticktext: ['10', '20', '50', '100', '200'],
};

const COMMON_HOVER = [
  { key: 'Fund', label: 'Fund' },
  { key: 'Issuer', label: 'Issuer' },
  { key: 'FamilyLabel', label: 'Structure' },
  { key: 'Date', label: 'Session' },
];

export const COST = {
  id: 'cost',
  label: 'Cost of Ownership',
  file: F('etf_cost.csv'),
  note: 'Round trip is one buy and one sell at the estimated spread plus the impact of a $1mm clip. Holding drag is what the fund actually cost its holder over six months, fitted from price, not the stated fee.',
  axes: {
    x: {
      key: 'RoundTripBps',
      title: 'Round-trip trading cost  (bps, log)',
      type: 'log',
      range: [0.34, 3.56],
      ticks: BPS_TICKS,
    },
    y: {
      key: 'DragLM',
      title: 'Realised holding drag  (bps per year, log-modulus)',
      range: [-3.6, 4.45],
      ticks: DRAG_TICKS,
      zeroline: true,
    },
    z: { key: 'RoundTripBps', title: 'Round trip  (bps)' },
  },
  hover: [
    ...COMMON_HOVER,
    { key: 'RoundTripBps', label: 'Round trip', suffix: ' bps' },
    { key: 'HoldingDragBpsYr', label: 'Holding drag', suffix: ' bps/yr' },
    { key: 'SpreadBps', label: 'Est. spread', suffix: ' bps' },
    { key: 'ADVmm', label: 'Daily turnover', prefix: '$', suffix: 'mm' },
    { key: 'ExpenseRatio', label: 'Stated fee', suffix: '%' },
  ],
};

export const LIQUIDITY = {
  id: 'liquidity',
  label: 'Liquidity',
  file: F('etf_liquidity.csv'),
  note: 'Turnover is the 21-session average of price times volume. Spread is the Corwin-Schultz high/low estimator, which needs no quote data.',
  axes: {
    x: {
      key: 'ADVmm',
      title: 'Average daily turnover  ($mm, log)',
      type: 'log',
      range: [-1.15, 4.25],
      ticks: ADV_TICKS,
    },
    y: {
      key: 'SpreadBps',
      title: `Estimated bid${NDASH}ask spread  (bps, log)`,
      type: 'log',
      range: [0.15, 2.62],
      ticks: BPS_TICKS,
    },
    z: { key: 'VolAnn', title: 'Volatility  (% ann)' },
  },
  hover: [
    ...COMMON_HOVER,
    { key: 'ADVmm', label: 'Daily turnover', prefix: '$', suffix: 'mm' },
    { key: 'SpreadBps', label: 'Est. spread', suffix: ' bps' },
    { key: 'RoundTripBps', label: 'Round trip', suffix: ' bps' },
    { key: 'AUM', label: 'Fund assets', prefix: '$', suffix: 'mm' },
  ],
};

export const EXPOSURE = {
  id: 'exposure',
  label: 'Exposure',
  file: F('etf_exposure.csv'),
  note: 'Beta is measured against COMEX gold for every fund, whatever it holds, so the six structures land on one comparable scale. A 3x gold product should print near 3 and an inverse near its stated negative multiple.',
  axes: {
    x: {
      key: 'GoldBeta',
      title: 'Beta to gold  (60-session)',
      range: [-6, 6],
      zeroline: true,
    },
    y: {
      key: 'VolAnn',
      title: 'Realised volatility  (% annualised, log)',
      type: 'log',
      range: [0.78, 2.36],
      ticks: VOL_TICKS,
    },
    z: { key: 'RoundTripBps', title: 'Round trip  (bps)' },
  },
  hover: [
    ...COMMON_HOVER,
    { key: 'GoldBeta', label: 'Beta to gold' },
    { key: 'VolAnn', label: 'Volatility', suffix: '% ann' },
    { key: 'TrackingErrorPct', label: 'Tracking error', suffix: '% ann' },
    { key: 'RoundTripBps', label: 'Round trip', suffix: ' bps' },
  ],
};

export const RV3D = {
  id: 'rv3d',
  label: 'Three-way 3D',
  file: F('etf_exposure.csv'),
  note: 'Exposure, tradability and cost together.',
  axes: {
    x: {
      key: 'GoldBeta',
      title: 'Beta to gold',
      range: [-6, 6],
    },
    y: {
      key: 'ADVmm',
      title: 'Turnover ($mm, log)',
      type: 'log',
      range: [-1.15, 4.25],
      ticks: ADV_TICKS,
    },
    z: {
      key: 'RoundTripBps',
      title: 'Round trip (bps, log)',
      type: 'log',
      range: [0.34, 3.56],
      ticks: BPS_TICKS,
    },
  },
  hover: [
    ...COMMON_HOVER,
    { key: 'GoldBeta', label: 'Beta to gold' },
    { key: 'ADVmm', label: 'Daily turnover', prefix: '$', suffix: 'mm' },
    { key: 'RoundTripBps', label: 'Round trip', suffix: ' bps' },
  ],
};

export const VIEWS = [
  { id: 'COST', dataset: COST, mode: '2d', label: 'Cost of Ownership' },
  { id: 'LIQ', dataset: LIQUIDITY, mode: '2d', label: 'Liquidity' },
  { id: 'EXP', dataset: EXPOSURE, mode: '2d', label: 'Exposure' },
  { id: 'RV3D', dataset: RV3D, mode: '3d', label: 'Three-way 3D' },
];
