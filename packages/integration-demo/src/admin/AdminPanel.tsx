const userStoriesUrl = './documentation/user-stories/';
const categories = [{ name: 'Account', title: 'A. Account' }, { name: 'Pay-to-play', title: 'B. Pay-to-play' }, { name: 'Assets', title: 'C. Assets' }];

const stories = [{ id: 'A1', category: 'Account', label: 'Account Button' }, { id: 'A2', category: 'Account', label: 'Create Account' }, { id: 'A3', category: 'Account', label: 'Restore Account' }, { id: 'A4', category: 'Account', label: 'Account Balance' }, { id: 'A5', category: 'Account', label: 'Inspect Activity' }, { id: 'A6', category: 'Account', label: 'Log Out' }, { id: 'D2a', category: 'Account', label: 'Receive Funds' }, { id: 'D3a', category: 'Account', label: 'Send Funds' }, { id: 'D4', category: 'Account', label: 'Account Transfer' }] as const;
export function AdminPanel({ selected, accountOpen, canReset, onSelect, onReset, canFund, funding, onFund, onExplorer, onMint, onListAssets, assetBusy, consoleOutput }: {
  selected: string | null; accountOpen: boolean; canReset: boolean; onSelect(id: string): void; onReset(): void;
  canFund: boolean; funding: boolean; onFund(): void; onExplorer(): void;
  onMint(): void; onListAssets(): void; assetBusy: boolean; consoleOutput: string;
}) {
  return <aside className="admin-panel" aria-label="Admin UI">
    <h1 className="panel-title">Admin</h1>
    <div className="admin-scroll" role="region" aria-label="Admin controls" tabIndex={0}>
    <section aria-labelledby="documentation-title">
      <h2 id="documentation-title" className="admin-section-title">User Stories</h2>
      <a className="documentation-link" href={userStoriesUrl} target="_blank" rel="noopener noreferrer">Documentation ↗</a>
    </section>
    <nav aria-label="User stories">
      {categories.map(category => <section key={category.name}>
        <h3 className="category-title">{category.title}</h3>
        {category.name === 'Assets' && <>
          <button className="story-button" disabled={accountOpen || assetBusy} onClick={onMint}><span>C1</span>Mint Asset</button>
          <button className="story-button" disabled={accountOpen || assetBusy} onClick={onListAssets}><span>C4</span>List Assets</button>
        </>}
        {stories.filter(story => story.category === category.name).map(story =>
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
      {/* Only production BisContext return values belong here; admin helpers do not. */}
      <textarea className="admin-console" aria-label="Console output" readOnly rows={8} value={consoleOutput} />
    </section>
    <button className="reset-button" disabled={!canReset} onClick={onReset}>Reset Client</button>
    </div>
  </aside>;
}
