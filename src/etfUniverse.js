/**
 * The six funds on the desk, in display order.
 *
 * `color` values are pulled from the desk palette so each fund keeps a stable
 * identity across all four views.
 */
export const ETF_UNIVERSE = {
  IBIT: {
    name: 'iShares Bitcoin Trust ETF',
    sponsor: 'BlackRock',
    asset: 'BTC',
    fee: 0.25,
    color: '#2EE6A8',
  },
  FBTC: {
    name: 'Fidelity Wise Origin Bitcoin Fund',
    sponsor: 'Fidelity',
    asset: 'BTC',
    fee: 0.25,
    color: '#7C9CFF',
  },
  GBTC: {
    name: 'Grayscale Bitcoin Trust ETF',
    sponsor: 'Grayscale',
    asset: 'BTC',
    fee: 1.5,
    color: '#FFC24B',
  },
  ARKB: {
    name: 'ARK 21Shares Bitcoin ETF',
    sponsor: 'ARK / 21Shares',
    asset: 'BTC',
    fee: 0.21,
    color: '#FF5D73',
  },
  BITB: {
    name: 'Bitwise Bitcoin ETF',
    sponsor: 'Bitwise',
    asset: 'BTC',
    fee: 0.2,
    color: '#98DCDF',
  },
  IAU: {
    name: 'iShares Gold Trust',
    sponsor: 'BlackRock',
    asset: 'GOLD',
    fee: 0.25,
    color: '#D2DFA7',
  },
};

export const ETF_ORDER = ['GBTC', 'BITB', 'FBTC', 'IAU', 'IBIT', 'ARKB'];

/**
 * Quartile classification buckets carried through from the source dataset.
 * Retained so a point can still be shaded by risk/yield quartile instead of
 * by fund when that view is useful.
 */
export const CLASSIFICATION_COLORS = {
  '1-1': '#8F828C',
  '1-2': '#646464',
  '1-3': '#ACDCDF',
  '1-4': '#90C3C9',
  '2-1': '#AEC47D',
  '2-2': '#929292',
  '2-3': '#9CC6B0',
  '2-4': '#78B8D1',
  '3-1': '#78B8D1',
  '3-2': '#273D58',
  '3-3': '#D2DFA7',
  '3-4': '#C5C6A9',
  '4-1': '#928FB1',
  '4-2': '#98DCDF',
  '4-3': '#AFC47E',
  '4-4': '#A6C095',
};
