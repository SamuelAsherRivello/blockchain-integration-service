import type { ReactNode } from 'react';
import { StoryAction } from './StoryAction';
import { StoryButton } from './StoryButton';
import { StorySection } from './StorySection';
import { getContinuePriceSats, type TestNetwork } from '@bis/integration';
const userStoriesUrl = `${import.meta.env?.BASE_URL ?? '/'}documentation/user-stories/`;
const sortStoryIds = (left: string, right: string) => left.localeCompare(right, undefined, {numeric: true});
const categories = [{ name: 'Accounts', title: 'A. Accounts', storyIds: ['A.G.1', 'A.G.2', 'A.G.3', 'A.P.1', 'A.P.2', 'A.P.3', 'A.P.4', 'A.P.5'] }, { name: 'Payments/Transfers', title: 'B. Payments', storyIds: ['B.G.1', 'B.P.1', 'B.P.2', 'B.P.3', 'B.P.4', 'B.P.5', 'B.P.6', 'B.P.7', 'B.P.8'] }, { name: 'Assets', title: 'C. Assets', storyIds: ['C.G.1', 'C.G.2', 'C.G.3', 'C.G.4', 'C.P.1'] }, { name: 'Contracts', title: 'D. Contracts', storyIds: ['D.G.1', 'D.P.1', 'D.P.2'] }, { name: 'Transactions', title: 'E. Transactions', storyIds: ['E.P.1', 'E.P.2', 'E.P.3'] }, { name: 'Integrations', title: 'F. Integrations', storyIds: ['F.P.1'] }];

const stories = [{ id: 'A.P.1', category: 'Accounts', label: 'Account Button' }, { id: 'A.P.4', category: 'Accounts', label: 'Account Dialog' }] as const;
export function AdminPanel({ continueReason, mintAvailable = false, mintReason, playerActive = false, gameWallet, gameWalletBoard, contracts, marketplace, continueAvailable = true, selected, accountOpen, canReset, onSelect, onReset, canFund, funding, onFund, onExplorer, onOpenOnboarding, onMint, onCompleteLevel, completionOpen, assetBusy, consoleOutput, onContinue, continueBusy, onShowToast, onShowToastWithIcon, canShowToast = false, network }: {
  continueReason?: string; mintAvailable?: boolean; mintReason?: string; playerActive?: boolean; gameWallet?: ReactNode; gameWalletBoard?: ReactNode; contracts?:ReactNode; marketplace?: ReactNode; continueAvailable?: boolean;
  onShowToast?(): void; onShowToastWithIcon?(): void; canShowToast?: boolean;
  onContinue?():void; continueBusy?:boolean;
  selected: string | null; accountOpen: boolean; canReset: boolean; onSelect(id: string): void; onReset(): void;
  canFund: boolean; funding: boolean; onFund(): void; onExplorer(): void;
  onOpenOnboarding?(): void;
  onCompleteLevel?(): void; completionOpen?: boolean;
  onMint(): void; assetBusy: boolean; consoleOutput: string;
  network?: TestNetwork;
}) {
  return <aside className="admin-panel" aria-label="Admin UI">
    <h1 className="panel-title">Admin</h1>
    <div className="admin-scroll" role="region" aria-label="Admin controls" tabIndex={0}>
    <section aria-labelledby="documentation-title">
      <h2 id="documentation-title" className="admin-section-title">User Stories</h2>
      <a className="documentation-link" href={userStoriesUrl} target="_blank" rel="noopener noreferrer">Documentation ↗</a>
    </section>
    <section aria-labelledby="implementation-title">
    <h2 id="implementation-title" className="admin-section-title">Implementation</h2>
    <nav aria-label="User stories">
      {categories.map(category => <StorySection key={category.name} title={category.title}>
        <p className="story-summary">Stories: {category.storyIds.slice().sort(sortStoryIds).join(', ')}</p>
        {category.name === 'Contracts' && contracts}
        {category.name === 'Integrations' && <>
          <StoryButton label="F.P.1. UI Toast">
            <button type="button" aria-label="F.P.1. Show" disabled={!canShowToast} onClick={onShowToast}>Show</button>
            <button type="button" aria-label="F.P.1. Show With Icon" disabled={!canShowToast} onClick={onShowToastWithIcon}>Show With Icon</button>
          </StoryButton>
        </>}
        {category.name === 'Payments/Transfers' && <><StoryAction id="B.P.1" label={`"Pay ${getContinuePriceSats()} Sats To Continue" (Player->Game)`} disabled={continueBusy || !continueAvailable} onClick={onContinue} /><StoryAction id="B.P.8" label="Open Onboarding" disabled={!playerActive || !onOpenOnboarding} onClick={onOpenOnboarding} /></>}
        {category.name === 'Assets' && <>{!marketplace && <StoryAction id="C.G.1" label={mintAvailable ? "Mint Asset & Send" : `Mint Asset & Send (${mintReason ?? 'Awaiting Balance'})`} disabled={!mintAvailable || assetBusy} onClick={onMint} />} {marketplace}</>}
        {category.name === 'Transactions' && <StoryAction id="E.P.1" label="View Activity" disabled={!playerActive} onClick={() => onSelect('E.P.1')} />}
        {stories.filter(story => story.category === category.name).map(story =>
          <StoryAction key={story.id} id={story.id} label={story.label} emphasis={story.id === 'A.P.1' ? 'start' : undefined} selected={selected === story.id} disabled={accountOpen} onClick={() => onSelect(story.id)} />)}
        {category.name === 'Accounts' && gameWallet}
        {category.name === 'Accounts' && gameWalletBoard}
      </StorySection>)}
    </nav>
    <StorySection title="X. Appendix">
      <p className="story-summary">Stories: {['X.N.2'].sort(sortStoryIds).join(', ')}</p>
    </StorySection>
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
