import './App.css';
import React, { useEffect, useMemo, useState } from 'react';
import Plot from 'react-plotly.js';
import * as d3 from 'd3';
import EtfData from './EtfData';
import { ETF_UNIVERSE, ETF_ORDER } from './etfUniverse';

const AXIS = {
  color: '#F0F3F8',
  gridcolor: 'rgba(255,255,255,0.10)',
  zerolinecolor: 'rgba(255,255,255,0.30)',
  linecolor: 'rgba(255,255,255,0.17)',
  tickfont: { size: 11, color: '#9BA5B6' },
};

const PAPER = '#050609';
const PLOT = '#0A0C12';

// module-level cache so switching views never refetches the same CSV
const csvCache = new Map();

function loadCsv(file) {
  if (!csvCache.has(file)) {
    csvCache.set(file, d3.csv(file));
  }
  return csvCache.get(file);
}

function formatHover(row, hoverFields) {
  const head = `<b>${row.Ticker}</b>  ·  ${row.Fund}`;
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
 * Builds one Plotly trace per fund so the legend doubles as a fund filter.
 */
function buildTraces(rows, dataset, mode) {
  const csv = new EtfData(rows, -1);
  const grouped = csv.group_by('Ticker');
  const { x, y, z } = dataset.axes;

  return ETF_ORDER.filter((ticker) => grouped[ticker]).map((ticker) => {
    const meta = ETF_UNIVERSE[ticker];
    const points = grouped[ticker];

    const trace = {
      x: points.map((r) => parseFloat(r[x.key])),
      y: points.map((r) => parseFloat(r[y.key])),
      type: mode === '3d' ? 'scatter3d' : 'scatter',
      mode: 'markers',
      name: `${ticker} · ${meta.sponsor}`,
      hoverinfo: 'text',
      text: points.map((r) => formatHover(r, dataset.hover)),
      marker: {
        color: meta.color,
        size: mode === '3d' ? 2.6 : 5,
        opacity: mode === '3d' ? 0.8 : 0.72,
        line: { width: 0 },
      },
    };

    if (mode === '3d') {
      trace.z = points.map((r) => parseFloat(r[z.key]));
    }

    return trace;
  });
}

function buildLayout(dataset, mode) {
  const { x, y, z } = dataset.axes;

  const legend = {
    bgcolor: 'rgba(13,15,22,0.72)',
    bordercolor: 'rgba(255,255,255,0.10)',
    borderwidth: 1,
    font: { color: '#F0F3F8', size: 11 },
    itemsizing: 'constant',
    x: mode === '3d' ? 0.01 : 1.01,
    y: 1,
    xanchor: 'left',
    yanchor: 'top',
  };

  const base = {
    autosize: true,
    paper_bgcolor: PAPER,
    plot_bgcolor: PLOT,
    font: {
      family: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      color: '#9BA5B6',
    },
    hoverlabel: {
      bgcolor: '#0D0F16',
      bordercolor: 'rgba(46,230,168,0.45)',
      font: { color: '#F0F3F8', size: 12 },
      align: 'left',
    },
    legend,
    showlegend: true,
  };

  if (mode === '3d') {
    return {
      ...base,
      margin: { l: 0, r: 0, b: 0, t: 0, pad: 0 },
      scene: {
        bgcolor: PLOT,
        domain: { x: [0.04, 0.96], y: [0.02, 0.98] },
        xaxis: { ...AXIS, title: x.title, range: x.range },
        yaxis: { ...AXIS, title: y.title, range: y.range },
        zaxis: { ...AXIS, title: z.title },
        camera: { eye: { x: 1.5, y: 1.5, z: 0.85 } },
        aspectmode: 'cube',
      },
    };
  }

  return {
    ...base,
    margin: { l: 70, r: 190, b: 70, t: 30, pad: 4 },
    xaxis: { ...AXIS, title: x.title, range: x.range },
    yaxis: { ...AXIS, title: y.title, range: y.range },
    hovermode: 'closest',
  };
}

const CONFIG = {
  displaylogo: false,
  responsive: true,
  scrollZoom: true,
  modeBarButtonsToRemove: ['sendDataToCloud', 'toggleSpikelines'],
};

export default function RelValPlot({ dataset, mode }) {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    loadCsv(dataset.file)
      .then((data) => {
        if (!cancelled) setRows(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err);
      });

    return () => {
      cancelled = true;
    };
  }, [dataset.file]);

  const traces = useMemo(
    () => (rows ? buildTraces(rows, dataset, mode) : []),
    [rows, dataset, mode]
  );

  const layout = useMemo(() => buildLayout(dataset, mode), [dataset, mode]);

  if (error) {
    return <div className="plot-status">Could not load {dataset.label} dataset.</div>;
  }

  // gate on data so the dark canvas never flashes white while the CSV loads
  if (!rows) {
    return <div className="plot-status">Loading {dataset.label} panel…</div>;
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
