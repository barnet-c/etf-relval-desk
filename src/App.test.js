import EtfData from './EtfData';
import { FAMILIES, FAMILY_ORDER, familyColor, familyLabel } from './etfUniverse';
import { VIEWS, COST, LIQUIDITY, EXPOSURE, RV3D } from './datasets';

const rows = [
  { '': '0', Ticker: 'GLD', Family: 'physical', RoundTripBps: '16.3', DragLM: '2.35' },
  { '': '1', Ticker: 'IAU', Family: 'physical', RoundTripBps: '18.1', DragLM: '2.11' },
  { '': '2', Ticker: 'NUGT', Family: 'lev_miners', RoundTripBps: '131', DragLM: '3.73' },
];

const PANELS = [COST, LIQUIDITY, EXPOSURE, RV3D];

test('every structural family has a label, colour and description', () => {
  FAMILY_ORDER.forEach((key) => {
    expect(FAMILIES[key]).toBeDefined();
    expect(FAMILIES[key].color).toMatch(/^#[0-9A-Fa-f]{6}$/);
    expect(FAMILIES[key].label.length).toBeGreaterThan(0);
    expect(FAMILIES[key].blurb.length).toBeGreaterThan(0);
  });
});

test('the six gold ETF structures are covered', () => {
  expect([...FAMILY_ORDER].sort()).toEqual(
    ['income', 'inverse', 'lev_gold', 'lev_miners', 'miners', 'physical']
  );
});

test('no two families share a colour', () => {
  const colors = FAMILY_ORDER.map((k) => FAMILIES[k].color.toLowerCase());
  expect(new Set(colors).size).toBe(FAMILY_ORDER.length);
});

/** sRGB hex -> {h: 0-360, s: 0-1, l: 0-1} */
function hsl(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  const l = (max + min) / 2;
  if (d === 0) return { h: 0, s: 0, l };
  const s = d / (1 - Math.abs(2 * l - 1));
  let h;
  if (max === r) h = 60 * (((g - b) / d + 6) % 6);
  else if (max === g) h = 60 * ((b - r) / d + 2);
  else h = 60 * ((r - g) / d + 4);
  return { h, s, l };
}

test('the palette is neutral — no saturated green or red verdict colours', () => {
  FAMILY_ORDER.forEach((key) => {
    const { h, s } = hsl(FAMILIES[key].color);
    // muted tones are fine whatever their hue; the rule is about colours
    // saturated enough to read as a signal
    if (s > 0.3) {
      const isRed = h >= 345 || h <= 15;
      const isGreen = h >= 90 && h <= 165;
      expect({ key, h: Math.round(h), isRed, isGreen })
        .toMatchObject({ isRed: false, isGreen: false });
    }
    // and nothing on the desk may be vivid
    expect(s).toBeLessThan(0.62);
  });
});

test('unknown families still resolve to a drawable colour and label', () => {
  expect(familyColor('nope')).toMatch(/^#[0-9A-Fa-f]{6}$/);
  expect(familyLabel('nope')).toBe('nope');
  expect(familyColor('physical')).toBe(FAMILIES.physical.color);
});

test('EtfData groups rows by family and filters by column value', () => {
  const data = new EtfData(rows, -1);
  expect(data.length).toBe(3);
  expect(Object.keys(data.group_by('Family')).sort())
    .toEqual(['lev_miners', 'physical']);
  expect(data.group_by('Family').physical).toHaveLength(2);
  expect(data.get_values('Ticker', 'GLD')).toHaveLength(1);
  expect(data.get_col(['RoundTripBps'], true)).toEqual([16.3, 18.1, 131]);
});

test('four panels are wired across the three datasets', () => {
  expect(VIEWS).toHaveLength(4);
  expect(VIEWS.map((v) => v.label)).toEqual([
    'Cost of Ownership',
    'Liquidity',
    'Exposure',
    'Three-way 3D',
  ]);
  PANELS.forEach((p) => {
    expect(p.file).toContain('/plotted_datasets/');
    expect(p.axes.x.key).toBeTruthy();
    expect(p.axes.y.key).toBeTruthy();
    expect(p.axes.z.key).toBeTruthy();
    expect(p.note.length).toBeGreaterThan(0);
  });
});

test('axes are in real units, never z-scores', () => {
  const REAL = /Bps|BpsYr|mm|Beta|Ann|Pct|DragLM/;
  PANELS.forEach((p) => {
    Object.values(p.axes).forEach((a) => {
      expect(a.key).toMatch(REAL);
      expect(a.key).not.toMatch(/^(Risk|Yield)$/);
    });
  });
});

test('every log axis carries an explicit tick map in real units', () => {
  PANELS.forEach((p) => {
    Object.values(p.axes).forEach((a) => {
      if (a.type !== 'log') return;
      expect(a.ticks).toBeDefined();
      expect(a.ticks.tickvals.length).toBe(a.ticks.ticktext.length);
      expect(a.ticks.tickvals.length).toBeGreaterThan(1);
    });
  });
});

test('log axes give tickvals in data units, and enough land inside the range', () => {
  // Plotly reads `range` on a log axis in log10 units but `tickvals` in data
  // units. Getting that backwards renders one mislabelled tick and no error.
  PANELS.forEach((p) => {
    Object.entries(p.axes).forEach(([which, a]) => {
      if (a.type !== 'log' || !a.range) return;
      const [lo, hi] = a.range;
      a.ticks.tickvals.forEach((v) => {
        expect(v).toBeGreaterThan(0); // a log tick at 0 or below is nonsense
      });
      const inside = a.ticks.tickvals.filter((v) => {
        const l = Math.log10(v);
        return l >= lo && l <= hi;
      });
      expect({ panel: p.id, axis: which, inside: inside.length })
        .toMatchObject({ panel: p.id, axis: which });
      expect(inside.length).toBeGreaterThanOrEqual(3);
    });
  });
});

test('the drag axis is log-modulus and its ticks span both signs', () => {
  const y = COST.axes.y;
  expect(y.key).toBe('DragLM');
  expect(y.ticks.tickvals.some((v) => v < 0)).toBe(true);
  expect(y.ticks.tickvals.some((v) => v > 0)).toBe(true);
  expect(y.ticks.tickvals).toContain(0);
  expect(y.zeroline).toBe(true);
});

test('every plotted axis declares a finite range', () => {
  PANELS.forEach((p) => {
    Object.values(p.axes).forEach((a) => {
      if (!a.range) return;
      const [lo, hi] = a.range;
      expect(Number.isFinite(lo)).toBe(true);
      expect(Number.isFinite(hi)).toBe(true);
      expect(hi).toBeGreaterThan(lo);
    });
  });
});
