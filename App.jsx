/* ============================================================
   App — root. Owns top-level routing (page) + auth.
   ============================================================ */

const App = () => {
  const [page, setPage]       = useState('login');     // 'login' | 'dashboard' | 'config' | 'settings'
  const [workflowId, setWfId] = useState(ACTIVE_WORKFLOW_ID);

  // tiny imperative API so you can shortcut into any page from the
  // browser console while exploring the skeleton: `go('config')`
  useEffect(() => { window.go = (p) => setPage(p); }, []);

  if (page === 'login') {
    return <Login onSignIn={() => setPage('dashboard')} />;
  }

  return (
    <div className="app">
      <Nav
        page={page}
        workflowId={workflowId}
        onNavigate={(p) => setPage(p)}
        onPickWorkflow={(id) => { setWfId(id); setPage('dashboard'); }}
      />
      <main className="main">
        {page === 'dashboard' && (
          <Dashboard workflowId={workflowId} onNavigate={setPage} />
        )}
        {page === 'config' && (
          <ConfigPage workflowId={workflowId} onNavigate={setPage} />
        )}
        {page === 'settings' && (
          <SettingsPage
            onNavigate={setPage}
            onSignOut={() => setPage('login')}
          />
        )}
      </main>
    </div>
  );
};

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
