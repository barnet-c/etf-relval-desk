import './App.css';
import React, { useEffect, useMemo, useState } from 'react';
import Plot from 'react-plotly.js';
import * as d3 from 'd3';
import EtfData from './EtfData';
import { FAMILIES, FAMILY_ORDER, familyColor } from './etfUniverse';

// The chart surface is the OpenEXA desk blue-grey, not the page black, so the
// plot reads as a panel sitting on the page rather than a hole cut into it.
const PAPER = '#141721';
const PLOT = '#141721';

const AXIS = {
  color: '#E4E1DA',
  gridcolor: 'rgba(255,255,255,0.065)',
  zerolinecolor: 'rgba(255,255,255,0.30)',
  zerolinewidth: 1.3,
  linecolor: 'rgba(255,255,255,0.15)',
  tickfont: { size: 11.5, color: '#8E8A83' },
  title: { font: { size: 12.5, color: '#C6C1B8' } },
};

// The WebGL 3D renderer ignores alpha on grid, line and pane colours, so each
// one has to be an opaque tone mixed against the plot background by hand.
const AXIS_3D = {
  gridcolor: 'rgb(52,57,72)',
  zerolinecolor: 'rgb(88,95,116)',
  linecolor: 'rgb(58,64,81)',
  showbackground: true,
  backgroundcolor: 'rgb(26,30,42)',
  showspikes: false,
  tickfont: { size: 10, color: '#8E8A83' },
  title: { font: { size: 11.5, color: '#C6C1B8' } },
};

const EMPTY = new Set();
const csvCache = new Map();

function loadCsv(file) {
  if (!csvCache.has(file)) csvCache.set(file, d3.csv(file));
  return csvCache.get(file);
}

function formatHover(row, hoverFields) {
  const head = `<b>${row.Ticker}</b>`;
  const body = hoverFields
    .map(({ key, label, prefix = '', suffix = '' }) => {
      const value = row[key];
      if (value === undefined || value === '') return null;
      return `${label}: ${prefix}${value}${suffix}`;
    })
    .filter(Boolean)
    .join('<br>');
  return `${head}<br>${body}`;
}

/**
 * One trace per structural family. With 37 funds a per-ticker legend would be
 * unreadable and would need 37 distinguishable hues; the family is what
 * actually explains where a point sits.
 */
function buildTraces(rows, dataset, mode, hidden) {
  const csv = new EtfData(rows, -1);
  const grouped = csv.group_by('Family');
  const { x, y, z } = dataset.axes;

  const num = (r, k) => {
    const v = parseFloat(r[k]);
    return Number.isFinite(v) ? v : null;
  };

  return FAMILY_ORDER.filter((f) => grouped[f] && !hidden.has(f)).map((fam) => {
    const points = grouped[fam];
    const trace = {
      x: points.map((r) => num(r, x.key)),
      y: points.map((r) => num(r, y.key)),
      type: mode === '3d' ? 'scatter3d' : 'scattergl',
      mode: 'markers',
      name: FAMILIES[fam].label,
      hoverinfo: 'text',
      text: points.map((r) => formatHover(r, dataset.hover)),
      marker: {
        color: familyColor(fam),
        size: mode === '3d' ? 2.6 : 5,
        opacity: mode === '3d' ? 0.82 : 0.6,
        line: { width: 0 },
      },
    };
    if (mode === '3d') trace.z = points.map((r) => num(r, z.key));
    return trace;
  });
}

function axisSpec(a, is3d) {
  const base = is3d ? AXIS_3D : AXIS;
  const spec = { ...base, title: a.title, range: a.range };
  if (a.type === 'log') spec.type = 'log';
  if (a.ticks) {
    spec.tickmode = 'array';
    spec.tickvals = a.ticks.tickvals;
    spec.ticktext = a.ticks.ticktext;
  }
  if (a.zeroline) spec.zeroline = true;
  return spec;
}

function buildLayout(dataset, mode) {
  const { x, y, z } = dataset.axes;

  const base = {
    autosize: true,
    paper_bgcolor: PAPER,
    plot_bgcolor: PLOT,
    font: {
      family: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      color: '#8E8A83',
    },
    hoverlabel: {
      // lifted off PLOT so the tooltip still reads as a separate surface
      bgcolor: '#1C2030',
      bordercolor: 'rgba(216,196,154,0.45)',
      font: { color: '#E4E1DA', size: 12 },
      align: 'left',
    },
    // the family strip above the chart is the single key and filter
    showlegend: false,
  };

  if (mode === '3d') {
    return {
      ...base,
      margin: { l: 0, r: 0, b: 0, t: 0, pad: 0 },
      scene: {
        bgcolor: PLOT,
        domain: { x: [0.02, 0.98], y: [0, 1] },
        xaxis: axisSpec(x, true),
        yaxis: axisSpec(y, true),
        zaxis: axisSpec(z, true),
        camera: {
          eye: { x: 1.62, y: 1.62, z: 0.72 },
          center: { x: 0, y: 0, z: -0.12 },
        },
        aspectmode: 'cube',
      },
    };
  }

  return {
    ...base,
    margin: { l: 92, r: 34, b: 76, t: 28, pad: 4 },
    xaxis: axisSpec(x, false),
    yaxis: axisSpec(y, false),
    hovermode: 'closest',
  };
}

const CONFIG = {
  displaylogo: false,
  responsive: true,
  scrollZoom: true,
  modeBarButtonsToRemove: ['sendDataToCloud', 'toggleSpikelines'],
};

export default function RelValPlot({ dataset, mode, hidden }) {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    loadCsv(dataset.file)
      .then((data) => { if (!cancelled) setRows(data); })
      .catch((err) => { if (!cancelled) setError(err); });
    return () => { cancelled = true; };
  }, [dataset.file]);

  const traces = useMemo(
    () => (rows ? buildTraces(rows, dataset, mode, hidden || EMPTY) : []),
    [rows, dataset, mode, hidden]
  );

  const layout = useMemo(() => buildLayout(dataset, mode), [dataset, mode]);

  if (error) {
    return <div className="plot-status">Could not load the {dataset.label} panel.</div>;
  }
  if (!rows) {
    return <div className="plot-status">Loading {dataset.label}…</div>;
  }

  return (
    <div className="plot-frame">
      <Plot
        data={traces}
        layout={layout}
        config={CONFIG}
        useResizeHandler
        style={{ width: '100%', height: '100%' }}
      />
    </div>
  );
}
