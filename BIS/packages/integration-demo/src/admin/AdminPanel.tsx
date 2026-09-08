import { StoryAction } from './StoryAction';
import { getContinuePriceSats } from '@bis/integration';
const userStoriesUrl = './documentation/user-stories/';
const categories = [{ name: 'Account', title: 'A. Account' }, { name: 'Pay-to-play', title: 'B. Pay-to-play' }, { name: 'Assets', title: 'C. Assets' }, { name: 'UI', title: 'D. UI' }];

const stories = [{ id: 'A1', category: 'Account', label: 'Account Button' }, { id: 'A2', category: 'Account', label: 'Create Account' }, { id: 'A3', category: 'Account', label: 'Restore Account' }, { id: 'A4', category: 'Account', label: 'Account Balance' }, { id: 'A5', category: 'Account', label: 'Inspect Activity' }, { id: 'A6', category: 'Account', label: 'Log Out' }, { id: 'D2a', category: 'Account', label: 'Receive Funds' }, { id: 'D3a', category: 'Account', label: 'Send Funds' }, { id: 'D4', category: 'Account', label: 'Account Transfer' }] as const;
export function AdminPanel({ selected, accountOpen, canReset, onSelect, onReset, canFund, funding, onFund, onExplorer, onMint, onListAssets, onCompleteLevel, completionOpen, assetBusy, consoleOutput, onContinue, continueBusy, onShowToast, onShowToastWithIcon, canShowToast = false }: {
  onShowToast?(): void; onShowToastWithIcon?(): void; canShowToast?: boolean;
  onContinue?():void; continueBusy?:boolean;
  selected: string | null; accountOpen: boolean; canReset: boolean; onSelect(id: string): void; onReset(): void;
  canFund: boolean; funding: boolean; onFund(): void; onExplorer(): void;
  onCompleteLevel?(): void; completionOpen?: boolean;
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
        {category.name === 'UI' && <>
          <StoryAction id="D1" label="Show Toast" disabled={!canShowToast} onClick={onShowToast} />
          <StoryAction id="D2" label="Show Toast With Icon" disabled={!canShowToast} onClick={onShowToastWithIcon} />
        </>}
        {category.name === 'Pay-to-play' && <StoryAction id="B1" label={`"Pay ${getContinuePriceSats()} Sats To Coninue"`} disabled={accountOpen || continueBusy} onClick={onContinue} />}
        {category.name === 'Assets' && <>
          <StoryAction id="C1" label="Mint Asset" disabled={accountOpen || assetBusy} onClick={onMint} />
          <StoryAction id="C4" label="List Assets" disabled={accountOpen || assetBusy} onClick={onListAssets} />
          <StoryAction id="C6" label="Reward Player With Trophy After Level Complete" disabled={accountOpen || assetBusy || completionOpen} onClick={onCompleteLevel} />
        </>}
        {stories.filter(story => story.category === category.name).map(story =>
          <StoryAction key={story.id} id={story.id} label={story.label} selected={selected === story.id} disabled={accountOpen} onClick={() => onSelect(story.id)} arrow />)}
      </section>)}
    </nav>
    <section aria-labelledby="tools-title">
      <h2 id="tools-title" className="admin-section-title">E. Admin Tools</h2>
      <StoryAction id="E1" label="Fund Signet Sats" disabled={!canFund || funding} onClick={onFund} />
      <StoryAction id="E2" label="Open On Mempool.space" disabled={!canFund || funding} onClick={onExplorer} />
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
