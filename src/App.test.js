import EtfData from './EtfData';
import { ETF_ORDER, ETF_UNIVERSE } from './etfUniverse';
import { VIEWS, CRRE_ARB, LIQUIDITY_ARB } from './datasets';

const rows = [
  { '': '0', Ticker: 'IBIT', Risk: '-1.2', Yield: '0.4', Price: '34.35', Classifications: '1-2' },
  { '': '1', Ticker: 'IBIT', Risk: '0.8', Yield: '-0.9', Price: '35.10', Classifications: '3-1' },
  { '': '2', Ticker: 'GBTC', Risk: '0.1', Yield: '1.6', Price: '52.40', Classifications: '2-4' },
];

test('every fund in the universe has a colour and a display name', () => {
  ETF_ORDER.forEach((ticker) => {
    expect(ETF_UNIVERSE[ticker]).toBeDefined();
    expect(ETF_UNIVERSE[ticker].color).toMatch(/^#[0-9A-Fa-f]{6}$/);
    expect(ETF_UNIVERSE[ticker].name.length).toBeGreaterThan(0);
  });
});

test('the desk covers exactly the six requested ETFs', () => {
  expect([...ETF_ORDER].sort()).toEqual(
    ['ARKB', 'BITB', 'FBTC', 'GBTC', 'IAU', 'IBIT']
  );
});

test('EtfData exposes numeric and label column accessors', () => {
  const data = new EtfData(rows, -1);
  expect(data.length).toBe(3);
  expect(data.get_col(['Risk'], true)).toEqual([-1.2, 0.8, 0.1]);
  expect(data.get_val(0, ['Risk', 'Yield'], true)).toEqual([-1.2, 0.4]);
  expect(data.get_val(2, ['Classifications'], false)).toBe('Classifications: 2-4');
});

test('EtfData groups rows by ticker and filters by column value', () => {
  const data = new EtfData(rows, -1);
  expect(Object.keys(data.group_by('Ticker')).sort()).toEqual(['GBTC', 'IBIT']);
  expect(data.group_by('Ticker').IBIT).toHaveLength(2);
  expect(data.get_values('Ticker', 'GBTC')).toHaveLength(1);
});

test('four views are wired across the two arbitrage panels', () => {
  expect(VIEWS).toHaveLength(4);
  expect(VIEWS.map((v) => v.label)).toEqual([
    'Cr&Re Arb 2D',
    'Cr&Re Arb 3D',
    'Liquidity Arb 2D',
    'Liquidity Arb 3D',
  ]);
  [CRRE_ARB, LIQUIDITY_ARB].forEach((dataset) => {
    expect(dataset.file).toContain('/plotted_datasets/');
    expect(dataset.axes.x.key).toBe('Risk');
    expect(dataset.axes.y.key).toBe('Yield');
    expect(dataset.axes.z.key).toBe('Price');
  });
});
