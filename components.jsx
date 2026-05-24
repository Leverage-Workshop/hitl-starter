/* ============================================================
   Shared shell components — Nav, Topbar, primitives.
   These are used by Dashboard / Config / Settings.
   ============================================================ */

const { useState, useEffect, useMemo, useRef, useCallback } = React;

// -- tiny utilities -------------------------------------------
const fmtTime = (iso) => {
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const fmtMoney = (n) => {
  if (!n) return '—';
  if (n >= 1000) return `$${(n/1000).toFixed(0)}k`;
  return `$${n}`;
};
const fmtRelative = (iso) => {
  const d = new Date(iso);
  const diff = (Date.now() - d.getTime()) / 60000;
  if (diff < 60) return `${Math.round(diff)}m`;
  if (diff < 24*60) return `${Math.round(diff/60)}h`;
  return `${Math.round(diff/(24*60))}d`;
};

// -- logo bracket mark, inline so it scales correctly ---------
const BracketMark = ({ size = 22 }) => (
  <svg width={size} height={size} viewBox="0 0 56 56" aria-hidden="true">
    <path d="M 12 14 L 6 14 L 6 42 L 12 42" fill="none" stroke="var(--fg)" strokeWidth="2.5" strokeLinecap="square" />
    <path d="M 44 14 L 50 14 L 50 42 L 44 42" fill="none" stroke="var(--fg)" strokeWidth="2.5" strokeLinecap="square" />
    <rect x="17" y="26" width="4" height="4" fill="var(--fg-muted)" />
    <rect x="26" y="26" width="4" height="4" fill="var(--fg-muted)" />
    <rect x="35" y="26" width="4" height="4" fill="var(--c-brass)" />
  </svg>
);

// -- Nav (left rail) ------------------------------------------
//
// Generic: takes the workflow list + active id and a nav callback.
// To fork: change WORKFLOWS in data.js. No code change here.
//
const Nav = ({ page, workflowId, onNavigate, onPickWorkflow }) => {
  return (
    <aside className="nav">
      {/* brand row — CLIENT identity (this is a white-label
          per-client deployment; CLIENT.name in data.js) */}
      <div className="nav__brand">
        <BracketMark size={22} />
        <div className="nav__brand-mark">
          <span>{CLIENT.name}</span>
          <span className="nav__brand-slash">/</span>
          <span>Console</span>
        </div>
      </div>

      {/* workflows */}
      <div style={{ overflowY: 'auto' }}>
        <div className="nav__section" style={{ paddingBottom: 4 }}>
          <div className="nav__section-label">Workflows</div>
        </div>
        <ul className="nav__list">
          {WORKFLOWS.map((wf) => (
            <li
              key={wf.id}
              className={
                'nav__item ' +
                (page === 'dashboard' && wf.id === workflowId ? 'nav__item--active' : '')
              }
              onClick={() => onPickWorkflow(wf.id)}
            >
              <span className="nav__item-name">
                <span className={
                  'nav__item-dot ' +
                  (wf.status === 'idle' ? 'nav__item-dot--idle' : '') +
                  (wf.status === 'off'  ? 'nav__item-dot--off'  : '')
                } />
                {wf.name}
              </span>
              <span className="nav__item-count">
                {wf.pending > 0
                  ? `${wf.pending}`
                  : wf.cadence === '—' ? '—' : ''}
              </span>
            </li>
          ))}
        </ul>

        <div className="nav__divider"></div>

        <div className="nav__section" style={{ paddingTop: 0 }}>
          <ul className="nav__list" style={{ padding: 0 }}>
            <li
              className={'nav__item ' + (page === 'config' ? 'nav__item--active' : '')}
              onClick={() => onNavigate('config')}
            >
              <span className="nav__item-name">› config</span>
            </li>
            <li
              className={'nav__item ' + (page === 'settings' ? 'nav__item--active' : '')}
              onClick={() => onNavigate('settings')}
            >
              <span className="nav__item-name">› settings</span>
            </li>
          </ul>
        </div>
      </div>

      {/* user identity */}
      <div className="nav__user" onClick={() => onNavigate('settings')}>
        <div>
          <div className="nav__user-name">j.grant</div>
          <div className="nav__user-role">operator</div>
        </div>
        <div className="nav__user-ver">v 0.4.2</div>
      </div>
    </aside>
  );
};

// -- Topbar (above main panel) --------------------------------
const Topbar = ({ crumbs, right }) => (
  <header className="topbar">
    <div className="topbar__crumbs">
      {crumbs.map((c, i) => (
        <span key={i}>
          {i > 0 && <span className="sep">/</span>}
          <span className={i === crumbs.length - 1 ? 'now' : ''}>{c}</span>
        </span>
      ))}
    </div>
    <div className="topbar__actions">
      <span className="env-pill"><span className="dot"></span>ENV · PROD</span>
      {right}
    </div>
  </header>
);

// -- Button + Chip primitives ---------------------------------
const Button = ({ variant = 'ghost', children, onClick, disabled, ...rest }) => {
  const cls = 'btn' + (variant === 'brass'  ? ' btn--brass'  :
                       variant === 'danger' ? ' btn--danger' : '');
  return (
    <button className={cls} onClick={onClick} disabled={disabled} {...rest}>
      {children}
    </button>
  );
};

const StatusCell = ({ s }) => (
  <span className={`statcell statcell--${s}`}>
    <span className="d"></span>{s}
  </span>
);

const PrioCell = ({ p }) => (
  <span className={`prio prio--${p}`}>{p}</span>
);

const Score = ({ v }) => (
  <span className="score">
    <span className="score__bar"><span className="score__fill" style={{ width: `${v}%` }}></span></span>
    <span>{v}</span>
  </span>
);

Object.assign(window, {
  fmtTime, fmtMoney, fmtRelative,
  BracketMark, Nav, Topbar, Button,
  StatusCell, PrioCell, Score,
});
