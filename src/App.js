import React, { useState } from 'react';
import './App.css';
import RelValPlot from './RelValPlot';
import { VIEWS } from './datasets';
import { ETF_ORDER } from './etfUniverse';

function DeskMark() {
  return (
    <svg className="logo" viewBox="0 0 40 40" role="img" aria-label="Relative value desk">
      <defs>
        <linearGradient id="rvd-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#2EE6A8" />
          <stop offset="100%" stopColor="#7C9CFF" />
        </linearGradient>
      </defs>
      <circle cx="20" cy="20" r="18" fill="none" stroke="url(#rvd-g)" strokeWidth="1.6" opacity="0.55" />
      <path d="M8 27 L16 17 L23 22 L32 10" fill="none" stroke="url(#rvd-g)" strokeWidth="2.4"
        strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="16" cy="17" r="2.4" fill="#2EE6A8" />
      <circle cx="23" cy="22" r="2.4" fill="#7C9CFF" />
    </svg>
  );
}

export default function App() {
  const [viewId, setViewId] = useState(VIEWS[0].id);

  return (
    <>
      <header className="topbar">
        <div className="topbar-in">
          <div className="brand">
            <DeskMark />
            <span className="brand-sep" aria-hidden="true" />
            <span className="brand-text">
              <b>Relative Value</b>
              <i>Creation / redemption · liquidity desk</i>
            </span>
          </div>

          <div className="topbar-right">
            <span className="chip tickers" aria-label="Funds on the desk">
              <i className="dot" />
              {ETF_ORDER.join(' · ')}
            </span>
            <span className="chip" aria-hidden="true">Dataset</span>
            <select
              className="model-select"
              aria-label="Select model"
              value={viewId}
              onChange={(e) => setViewId(e.target.value)}
            >
              {VIEWS.map((view) => (
                <option key={view.id} value={view.id}>
                  {view.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </header>

      <main className="content">
        {VIEWS.map((view) => (
          <div
            key={view.id}
            id={view.id}
            className="view"
            style={{ display: view.id === viewId ? 'block' : 'none' }}
          >
            {/* mount lazily, then keep alive so switching views is instant */}
            {view.id === viewId && (
              <RelValPlot dataset={view.dataset} mode={view.mode} />
            )}
          </div>
        ))}
      </main>
    </>
  );
}
