export function AdminPanel() {
  return (
    <aside className="admin-panel" aria-labelledby="admin-title">
      <div className="panel-heading"><span className="eyebrow">DEVELOPMENT</span><span className="panel-number">01</span></div>
      <h1 id="admin-title">Admin</h1>
      <p className="panel-intro">A workspace for testing your game integration.</p>
      <section className="admin-card">
        <span className="status-dot" aria-hidden="true" />
        <div><h2>UI preview</h2><p>The first piece is ready to try.</p></div>
        <span className="small-tag">WIP</span>
      </section>
      <section className="try-it">
        <span className="eyebrow">TRY IT OUT</span>
        <p>Select <strong>⚡ Account</strong> in the preview, then dismiss the prompt with <strong>OK</strong>.</p>
      </section>
      <div className="admin-note"><span aria-hidden="true">＋</span><p>Game-event controls will live here as the integration grows.</p></div>
      <footer className="admin-footer"><span className="status-dot" aria-hidden="true" /> UI only · No wallet connected</footer>
    </aside>
  );
}
