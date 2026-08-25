/**
 * The gold ETF cohort.
 *
 * The universe is the 38 gold ETFs listed by etf.com/topics/gold from GLD
 * through NUGY. Per-fund metadata (name, issuer, AUM, expense ratio, family)
 * travels in the CSVs themselves, so the only thing declared here is how each
 * structural family is drawn.
 *
 * Points are coloured by FAMILY, not by ticker. With 37 funds on the desk a
 * per-ticker palette would need 37 distinguishable hues, which is not possible
 * and not useful; what a reader actually needs to see is which of the six
 * product structures a point belongs to.
 *
 * The palette is deliberately neutral -- warm and cool greys, champagne, sand,
 * bronze, slate, dusty blue and lavender. No green and no red anywhere, so
 * nothing on the chart reads as an implied "good" or "bad" verdict.
 */

export const FAMILY_ORDER = [
  'physical',
  'miners',
  'lev_gold',
  'lev_miners',
  'inverse',
  'income',
];

export const FAMILIES = {
  physical: {
    label: 'Physical gold',
    color: '#E3D2A8', // champagne
    blurb: 'Trusts holding allocated bullion. The cheapest way to hold gold.',
  },
  miners: {
    label: 'Gold miners',
    color: '#93A9C6', // dusty blue
    blurb: 'Equity in gold mining companies. Levered to gold by operation.',
  },
  lev_gold: {
    label: 'Leveraged gold',
    color: '#C7A57E', // bronze
    blurb: 'Daily-reset 2x and 3x gold. Compounding decay is structural.',
  },
  lev_miners: {
    label: 'Leveraged miners',
    color: '#AB9CBD', // dusty lavender
    blurb: 'Daily-reset leverage on the miner index. The widest exposure here.',
  },
  inverse: {
    label: 'Inverse',
    color: '#8C919C', // slate
    blurb: 'Short gold or short miners, daily reset.',
  },
  income: {
    label: 'Option income',
    color: '#C4B7A4', // sand
    blurb: 'Covered-call and yield strategies written over gold or miners.',
  },
};

/** Anything the CSV labels with an unknown family still gets drawn. */
export const FALLBACK_COLOR = '#79808C';

export function familyColor(key) {
  return (FAMILIES[key] && FAMILIES[key].color) || FALLBACK_COLOR;
}

export function familyLabel(key) {
  return (FAMILIES[key] && FAMILIES[key].label) || key;
}

export const UNIVERSE_SOURCE =
  'etf.com/topics/gold — 38 funds, GLD through NUGY';
