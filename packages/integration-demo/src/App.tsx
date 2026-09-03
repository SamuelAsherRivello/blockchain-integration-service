import { AdminPanel } from './admin/AdminPanel';
import { GamePreview } from './preview/GamePreview';

export function App() {
  return (
    <div className="demo-app">
      <header className="app-header">
        <div className="identity"><span className="brand-mark" aria-hidden="true">↗</span><span>Blockchain Integration Service</span></div>
        <span className="version-tag">DEMO <span>0.0.1</span></span>
      </header>
      <main className="workspace">
        <AdminPanel />
        <GamePreview />
      </main>
    </div>
  );
}
