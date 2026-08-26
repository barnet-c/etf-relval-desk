import React, { useEffect, useState } from 'react';
import './App.css';
import RelValPlot from './RelValPlot';
import AboutPage from './AboutPage';
import { VIEWS } from './datasets';
import { FAMILIES, FAMILY_ORDER } from './etfUniverse';

function DeskMark() {
  return (
    <a
      className="brand-link"
      href="https://www.openexa.com/"
      target="_blank"
      rel="noopener noreferrer"
      aria-label="OpenEXA — opens openexa.com in a new tab"
    >
      <img
        className="logo"
        src={`${process.env.PUBLIC_URL}/openexa-logo.webp`}
        alt="OpenEXA"
        width="352"
        height="133"
      />
    </a>
  );
}

/** The structural key, and the filter. Points are coloured by family. */
function FamilyStrip({ hidden, onToggle, onOnly, onAll }) {
  return (
    <div className="fundstrip">
      <span className="sl">Structure</span>
      {FAMILY_ORDER.map((key) => {
        const fam = FAMILIES[key];
        const off = hidden.has(key);
        return (
          <button
            type="button"
            key={key}
            className={`fund-pill${off ? ' off' : ''}`}
            title={`${fam.blurb} — click to ${off ? 'show' : 'hide'}, double-click to isolate`}
            aria-pressed={!off}
            onClick={() => onToggle(key)}
            onDoubleClick={() => onOnly(key)}
          >
            <span className="swatch" style={{ background: fam.color }} />
            {fam.label}
          </button>
        );
      })}
      {hidden.size > 0 && (
        <button type="button" className="fund-reset" onClick={onAll}>
          Show all
        </button>
      )}
    </div>
  );
}

export default function App() {
  const [page, setPage] = useState('desk');
  const [viewId, setViewId] = useState(VIEWS[0].id);
  const [hidden, setHidden] = useState(() => new Set());

  const toggle = (key) =>
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next.size === FAMILY_ORDER.length ? prev : next;
    });

  const only = (key) =>
    setHidden((prev) => {
      const isolated = new Set(FAMILY_ORDER.filter((k) => k !== key));
      return prev.size === isolated.size && !prev.has(key) ? new Set() : isolated;
    });

  const showAll = () => setHidden(new Set());

  useEffect(() => {
    document.body.classList.toggle('no-scroll', page === 'desk');
    if (page === 'about') window.scrollTo(0, 0);
    return () => document.body.classList.remove('no-scroll');
  }, [page]);

  const isDesk = page === 'desk';
  const view = VIEWS.find((v) => v.id === viewId);

  return (
    <>
      <header className="topbar">
        <div className="topbar-in">
          <div className="brand">
            <DeskMark />
            <span className="brand-sep" aria-hidden="true" />
            <span className="brand-text">
              <b>Gold ETF Desk</b>
              <i>Cost, liquidity and exposure across 37 funds</i>
            </span>
          </div>

          <div className="topbar-right">
            <div className="tabs" role="tablist" aria-label="Page">
              <button type="button" role="tab" className="tab"
                aria-selected={isDesk} onClick={() => setPage('desk')}>
                Desk
              </button>
              <button type="button" role="tab" className="tab"
                aria-selected={!isDesk} onClick={() => setPage('about')}>
                Methodology
              </button>
            </div>

            {isDesk && (
              <select
                className="model-select"
                aria-label="Select view"
                value={viewId}
                onChange={(e) => setViewId(e.target.value)}
              >
                {VIEWS.map((v) => (
                  <option key={v.id} value={v.id}>{v.label}</option>
                ))}
              </select>
            )}
          </div>
        </div>
      </header>

      {isDesk ? (
        <>
          <FamilyStrip hidden={hidden} onToggle={toggle} onOnly={only} onAll={showAll} />
          <main className="content desk">
            {VIEWS.map((v) => (
              <div key={v.id} id={v.id} className="view"
                style={{ display: v.id === viewId ? 'block' : 'none' }}>
                {v.id === viewId && (
                  <RelValPlot dataset={v.dataset} mode={v.mode} hidden={hidden} />
                )}
              </div>
            ))}
          </main>
          {view && view.dataset.note && (
            <p className="panelnote">{view.dataset.note}</p>
          )}
        </>
      ) : (
        <main>
          <AboutPage />
        </main>
      )}
    </>
  );
}
