/**
 * The two relative-value panels the desk plots.
 *
 * Both CSVs share the Risk / Yield / Price / Classifications schema so a single
 * plot component can render either one in 2D or 3D. `hover` names the extra
 * columns surfaced in the tooltip for that panel.
 */

export const CRRE_ARB = {
  id: 'crre',
  label: 'Cr&Re Arb',
  file: `${process.env.PUBLIC_URL}/plotted_datasets/etf_crre_arb.csv`,
  axes: {
    x: { key: 'Risk', title: 'Basket risk  (tracking-error z)', range: [3.0, -2.1] },
    y: { key: 'Yield', title: 'Arb yield  (dislocation z)', range: [-5.2, 5.2] },
    z: { key: 'Price', title: 'Price  ($)' },
  },
  hover: [
    { key: 'Date', label: 'Date' },
    { key: 'Price', label: 'Price', prefix: '$' },
    { key: 'TrackingError', label: 'Tracking error', suffix: '% ann.' },
    { key: 'Dislocation', label: 'Dislocation', suffix: ' bps' },
    { key: 'Beta', label: 'Beta to asset' },
    { key: 'Fee', label: 'Fee', suffix: '%' },
    { key: 'Classifications', label: 'Classification' },
  ],
};

export const LIQUIDITY_ARB = {
  id: 'liquidity',
  label: 'Liquidity Arb',
  file: `${process.env.PUBLIC_URL}/plotted_datasets/etf_liquidity_arb.csv`,
  axes: {
    x: { key: 'Risk', title: 'Liquidity risk  (Amihud z)', range: [2.0, -2.3] },
    y: { key: 'Yield', title: 'Spread capture  (bid/ask z)', range: [-2.0, 3.9] },
    z: { key: 'Price', title: 'Price  ($)' },
  },
  hover: [
    { key: 'Date', label: 'Date' },
    { key: 'Price', label: 'Price', prefix: '$' },
    { key: 'SpreadBps', label: 'Est. spread (21d)', suffix: ' bps' },
    { key: 'Illiquidity', label: 'Amihud (log10)' },
    { key: 'ADV', label: '21d ADV', prefix: '$', suffix: 'mm' },
    { key: 'Fee', label: 'Fee', suffix: '%' },
    { key: 'Classifications', label: 'Classification' },
  ],
};

export const VIEWS = [
  { id: 'CRRE2D', dataset: CRRE_ARB, mode: '2d', label: 'Cr&Re Arb 2D' },
  { id: 'CRRE3D', dataset: CRRE_ARB, mode: '3d', label: 'Cr&Re Arb 3D' },
  { id: 'LIQ2D', dataset: LIQUIDITY_ARB, mode: '2d', label: 'Liquidity Arb 2D' },
  { id: 'LIQ3D', dataset: LIQUIDITY_ARB, mode: '3d', label: 'Liquidity Arb 3D' },
];
