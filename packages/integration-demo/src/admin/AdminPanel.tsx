import userStoriesUrl from '../../../../documentation/User Story Diagrams.md?url';

const stories = [{ id: 'A1', category: 'Account', label: 'Account Button' }, { id: 'A2', category: 'Account', label: 'Create Account' }, { id: 'A3', category: 'Account', label: 'Restore Account' }, { id: 'A4', category: 'Account', label: 'Account Balance' }, { id: 'A5', category: 'Account', label: 'Inspect Activity' }, { id: 'A6', category: 'Account', label: 'Log Out' }] as const;
export function AdminPanel({ selected, accountOpen, canReset, error, onSelect, onReset, canFund, funding, fundingMessage, onFund, onExplorer }: {
  selected: string | null; accountOpen: boolean; canReset: boolean; error?: string; onSelect(id: string): void; onReset(): void;
  canFund: boolean; funding: boolean; fundingMessage?: string; onFund(): void; onExplorer(): void;
}) {
  return <aside className="admin-panel" aria-label="Admin UI">
    <h1 className="panel-title">Admin</h1>
    <div className="admin-scroll" role="region" aria-label="Admin controls" tabIndex={0}>
    <section aria-labelledby="documentation-title">
      <h2 id="documentation-title" className="admin-section-title">User Stories</h2>
      <a className="documentation-link" href={userStoriesUrl} target="_blank" rel="noopener noreferrer">Documentation ↗</a>
    </section>
    <nav aria-label="User stories">
      {[...new Set(stories.map(story => story.category))].map(category => <section key={category}>
        <h3 className="category-title">{category}</h3>
        {stories.filter(story => story.category === category).map(story =>
          <button key={story.id} className="story-button" aria-pressed={selected === story.id} disabled={accountOpen} onClick={()=>onSelect(story.id)}>
            <span>{story.id}</span>{story.label}<span className="story-arrow" aria-hidden="true">↗</span>
          </button>)}
      </section>)}
    </nav>
    <section aria-labelledby="tools-title">
      <h2 id="tools-title" className="admin-section-title">Tools</h2>
      <button className="story-button" disabled={!canFund || funding} onClick={onFund}>Fund Signet Sats</button>
      <button className="story-button" disabled={!canFund || funding} onClick={onExplorer}>Address on Mempool.space</button>
    </section>
    <section aria-labelledby="console-title">
      <h2 id="console-title" className="admin-section-title">Console</h2>
      <textarea className="admin-console" aria-label="Console output" readOnly rows={6} value={[funding ? 'Preparing Bitcoin address…' : fundingMessage || (canFund ? 'Copies your Bitcoin address and opens the Signet faucet.' : 'Create or restore an account to fund it.'), error].filter(Boolean).join('\n')} />
    </section>
    <button className="reset-button" disabled={!canReset} onClick={onReset}>Reset Client</button>
    </div>
  </aside>;
}
