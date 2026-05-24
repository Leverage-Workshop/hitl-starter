/* ============================================================
   Dashboard — the core page.

   - Persistent left nav (in App).
   - Header with stats.
   - Table / Cards toggle (changes both layout and available actions).
   - Detail flyout opens on row/card click.
   - Selecting rows in table mode reveals a bulk-action bar.
   ============================================================ */

// -- Stat tile ------------------------------------------------
const StatTile = ({ label, value, sub }) => (
  <div className="stat">
    <div className="stat__label">{label}</div>
    <div className="stat__value">{value}</div>
    <div className="stat__sub">{sub}</div>
  </div>
);

// -- Queue table (dense rows, batch actions) ------------------
const QueueTable = ({ items, selected, onToggleOne, onToggleAll, onOpen, activeId }) => {
  const allChecked = items.length > 0 && items.every((i) => selected.has(i.id));
  const someChecked = items.some((i) => selected.has(i.id));

  // indeterminate header checkbox handling
  const headRef = useRef(null);
  useEffect(() => {
    if (headRef.current) headRef.current.indeterminate = someChecked && !allChecked;
  }, [someChecked, allChecked]);

  return (
    <div className="qtable-wrap">
      <table className="qtable">
        <thead>
          <tr>
            <th className="check">
              <input
                ref={headRef}
                className="cb"
                type="checkbox"
                checked={allChecked}
                onChange={(e) => onToggleAll(e.target.checked)}
              />
            </th>
            <th>ID</th>
            <th>STATUS</th>
            <th>PRIORITY</th>
            <th>SUBJECT</th>
            <th>FROM</th>
            <th className="num">VALUE</th>
            <th className="num">CONF</th>
            <th className="num">ATCH</th>
            <th className="num">SUBMITTED</th>
          </tr>
        </thead>
        <tbody>
          {items.map((it) => {
            const isSel = selected.has(it.id);
            const isAct = it.id === activeId;
            return (
              <tr
                key={it.id}
                className={(isSel ? 'selected ' : '') + (isAct ? 'active' : '')}
                onClick={(e) => {
                  if (e.target.classList?.contains('cb')) return;
                  onOpen(it.id);
                }}
              >
                <td className="check" onClick={(e) => e.stopPropagation()}>
                  <input
                    className="cb"
                    type="checkbox"
                    checked={isSel}
                    onChange={() => onToggleOne(it.id)}
                  />
                </td>
                <td className="mono accent">{it.id}</td>
                <td><StatusCell s={it.status} /></td>
                <td><PrioCell p={it.priority} /></td>
                <td>{it.subject}</td>
                <td className="mono muted">{it.from}</td>
                <td className="num">{fmtMoney(it.value)}</td>
                <td className="num">{it.score ? <Score v={it.score} /> : <span className="muted">—</span>}</td>
                <td className="num muted">{it.attachments || '—'}</td>
                <td className="num muted">{fmtRelative(it.submitted)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

// -- Queue cards (one item per card, color-coded) -------------
const QueueCards = ({ items, onOpen, activeId, onQuickAction }) => (
  <div className="cards">
    {items.map((it) => (
      <div
        key={it.id}
        className={
          'card-item card-item--' + it.priority + (it.id === activeId ? ' active' : '')
        }
        onClick={() => onOpen(it.id)}
      >
        <div className="card-item__head">
          <div>
            <div className="card-item__id">{it.id}</div>
            <div className="card-item__title">{it.subject}</div>
          </div>
          <PrioCell p={it.priority} />
        </div>
        <div className="card-item__summary">{it.summary}</div>
        <div className="card-item__meta">
          <span>FROM · <b>{it.from.split('@')[1]}</b></span>
          <span>VAL · <b>{fmtMoney(it.value)}</b></span>
          <span>CONF · <b>{it.score || '—'}</b></span>
          <span>{fmtRelative(it.submitted)} AGO</span>
        </div>
        {/* per-card quick actions — no bulk in cards mode */}
        <div className="card-item__actions" onClick={(e) => e.stopPropagation()}>
          <Button variant="brass"
            onClick={() => onQuickAction(it.id, 'approve')}>Approve</Button>
          <Button onClick={() => onOpen(it.id)}>Review</Button>
          <Button variant="danger"
            onClick={() => onQuickAction(it.id, 'reject')}>Reject</Button>
        </div>
      </div>
    ))}
  </div>
);

// -- Dashboard root -------------------------------------------
const Dashboard = ({ workflowId, onNavigate }) => {
  const workflow = WORKFLOWS.find((w) => w.id === workflowId) || WORKFLOWS[0];

  // local state — kept here so reseeding via data.js works on reload
  const [items, setItems] = useState(ITEMS);
  const [view, setView] = useState('table'); // 'table' | 'cards' — TABLE is default
  const [selected, setSelected] = useState(new Set());
  const [openId, setOpenId] = useState(null);
  const [query, setQuery] = useState('');

  // filter to the active workflow's pending bucket
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((i) =>
      !q ||
      i.subject.toLowerCase().includes(q) ||
      i.from.toLowerCase().includes(q) ||
      i.id.toLowerCase().includes(q)
    );
  }, [items, query]);

  const openItem = items.find((i) => i.id === openId);

  // bulk + selection helpers
  const toggleOne = (id) => {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const toggleAll = (checked) => {
    if (!checked) return setSelected(new Set());
    setSelected(new Set(visible.map((i) => i.id)));
  };
  const clearSelection = () => setSelected(new Set());

  const applyToSelected = (action) => {
    setItems((arr) =>
      arr.map((i) =>
        selected.has(i.id)
          ? { ...i, status: action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : i.status }
          : i
      )
    );
    clearSelection();
  };

  const applyToOne = (id, action) => {
    setItems((arr) =>
      arr.map((i) =>
        i.id === id
          ? { ...i, status: action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : i.status }
          : i
      )
    );
  };

  const handleAction = (id, key) => {
    if (key === 'approve' || key === 'reject') applyToOne(id, key);
    setOpenId(null);
  };

  // keyboard: Esc closes flyout, A approves the open item, X rejects
  useEffect(() => {
    const onKey = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.key === 'Escape') setOpenId(null);
      if (openId) {
        for (const a of ACTION_SET) {
          if (e.key.toUpperCase() === a.hotkey) {
            e.preventDefault();
            handleAction(openId, a.key);
            return;
          }
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [openId]);

  // counts for stat tiles — derived from current state
  const liveStats = useMemo(() => {
    const pending = items.filter((i) => i.status === 'pending').length;
    const approved = items.filter((i) => i.status === 'approved').length;
    return [
      { label: 'PENDING',           value: String(pending),  sub: 'in queue' },
      { label: 'APPROVED // 7D',    value: String(34 + approved),  sub: '+ 6 vs prior 7d' },
      ...STATS.slice(2),
    ];
  }, [items]);

  return (
    <>
      <Topbar
        crumbs={['workflows', workflow.name]}
        right={<>
          <Button onClick={() => onNavigate('config')}>Edit</Button>
          <Button variant="brass">▶ Run now</Button>
        </>}
      />

      <div className="page">

        {/* header */}
        <div data-screen-label="01 Dashboard Header">
          <div className="page-header__eyebrow">WORKFLOW // 03</div>
          <div className="page-header__title-row">
            <h1 className="page-header__title">{workflow.name}</h1>
            <span className="status">
              <span className="dot"></span>RUNNING
            </span>
          </div>
          <p className="page-header__desc">
            Reads inbound RFP emails, drafts a first response in the studio voice, attaches the right pricing
            sheet, and files the thread in the correct CRM pipeline. Flags anything above the confidence
            floor for a human decision before sending.
          </p>
        </div>

        {/* stats */}
        <div className="stats">
          {liveStats.map((s) => <StatTile key={s.label} {...s} />)}
        </div>

        {/* toolbar */}
        <div>
          <div className="toolbar">
            <div className="toolbar__left">
              <span className="toolbar__title">REVIEW QUEUE // LAST 7D</span>
            </div>
            <div className="toolbar__right">
              <div className="search">
                <span style={{ color: 'var(--fg-muted)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>⌕</span>
                <input
                  type="text"
                  placeholder="filter id, subject, sender…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                <kbd>/</kbd>
              </div>
              <div className="seg">
                <button
                  className={'seg__btn ' + (view === 'table' ? 'seg__btn--active' : '')}
                  onClick={() => { setView('table'); }}
                >Table</button>
                <button
                  className={'seg__btn ' + (view === 'cards' ? 'seg__btn--active' : '')}
                  onClick={() => { setView('cards'); clearSelection(); }}
                >Cards</button>
              </div>
            </div>
          </div>

          {/* bulk-action bar — only in table view, only when rows selected */}
          {view === 'table' && selected.size > 0 && (
            <div className="bulkbar" style={{ marginTop: 12 }}>
              <div className="bulkbar__count">
                <span className="num">{selected.size}</span> selected
                <span style={{ color: 'var(--fg-muted)', marginLeft: 12 }}>
                  · bulk actions apply to all
                </span>
              </div>
              <div className="bulkbar__actions">
                <Button onClick={clearSelection}>Clear</Button>
                <Button onClick={() => applyToSelected('reassign')}>Reassign</Button>
                <Button variant="danger" onClick={() => applyToSelected('reject')}>Reject selected</Button>
                <Button variant="brass" onClick={() => applyToSelected('approve')}>Approve selected</Button>
              </div>
            </div>
          )}
        </div>

        {/* the list */}
        <div style={{ marginTop: -8 }}>
          {view === 'table' ? (
            <QueueTable
              items={visible}
              selected={selected}
              onToggleOne={toggleOne}
              onToggleAll={toggleAll}
              onOpen={setOpenId}
              activeId={openId}
            />
          ) : (
            <QueueCards
              items={visible}
              onOpen={setOpenId}
              activeId={openId}
              onQuickAction={applyToOne}
            />
          )}
          {visible.length === 0 && (
            <div className="empty">no items match the current filter.</div>
          )}
        </div>
      </div>

      {/* detail flyout */}
      <DetailFlyout
        item={openItem}
        onClose={() => setOpenId(null)}
        onAction={handleAction}
      />
    </>
  );
};

Object.assign(window, { Dashboard });
