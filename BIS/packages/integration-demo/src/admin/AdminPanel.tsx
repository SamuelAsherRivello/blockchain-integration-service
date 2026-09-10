import type { ReactNode } from 'react';
import { StoryAction } from './StoryAction';
import { StorySection } from './StorySection';
import { getContinuePriceSats } from '@bis/integration';
const userStoriesUrl = './documentation/user-stories/';
const categories = [{ name: 'Account', title: 'A. Account', stories: 'A1, A2, A3, A4, A5, A6' }, { name: 'Pay-to-play', title: 'B. Pay-to-play', stories: 'B1, B2' }, { name: 'Assets', title: 'C. Assets', stories: 'C1, C2' }, { name: 'UI', title: 'D. UI', stories: 'D1, D2' }];

const stories = [{ id: 'A1', category: 'Account', label: 'Account Button' }, { id: 'A4', category: 'Account', label: 'Account Dialog' }] as const;
export function AdminPanel({ continueReason, mintAvailable = false, mintReason, playerActive = false, gameWallet, contracts, continueAvailable = true, selected, accountOpen, canReset, onSelect, onReset, canFund, funding, onFund, onExplorer, onOpenOnboarding, onMint, onCompleteLevel, completionOpen, assetBusy, consoleOutput, onContinue, continueBusy, onShowToast, onShowToastWithIcon, canShowToast = false }: {
  continueReason?: string; mintAvailable?: boolean; mintReason?: string; playerActive?: boolean; gameWallet?: ReactNode; contracts?:ReactNode; continueAvailable?: boolean;
  onShowToast?(): void; onShowToastWithIcon?(): void; canShowToast?: boolean;
  onContinue?():void; continueBusy?:boolean;
  selected: string | null; accountOpen: boolean; canReset: boolean; onSelect(id: string): void; onReset(): void;
  canFund: boolean; funding: boolean; onFund(): void; onExplorer(): void;
  onOpenOnboarding?(): void;
  onCompleteLevel?(): void; completionOpen?: boolean;
  onMint(): void; assetBusy: boolean; consoleOutput: string;
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
        <p className="story-summary">Stories: {category.stories}</p>
        {category.name === 'UI' && <>
          <StoryAction id="D1" label="Show Toast" disabled={!canShowToast} onClick={onShowToast} />
          <StoryAction id="D2" label="Show Toast With Icon" disabled={!canShowToast} onClick={onShowToastWithIcon} />
        </>}
        {category.name === 'Pay-to-play' && <><StoryAction id="B1" label={`"Pay ${getContinuePriceSats()} Sats To Continue" (Player->Game)`} disabled={continueBusy || !continueAvailable} onClick={onContinue} />{!continueAvailable && continueReason && <p role="status">{continueReason}</p>}</>}
        {category.name === 'Assets' && <>
          <StoryAction id="C1" label={mintAvailable ? "Mint Asset & Send" : `Mint Asset & Send (${mintReason ?? 'Awaiting Balance'})`} disabled={!mintAvailable || assetBusy} onClick={onMint} />
        </>}
        {stories.filter(story => story.category === category.name).map(story =>
          <StoryAction key={story.id} id={story.id} label={story.label} selected={selected === story.id} disabled={accountOpen} onClick={() => onSelect(story.id)} />)}
      </StorySection>)}
    </nav>
    <StorySection title="E. Admin Tools">
      <p className="story-summary">Stories: E1, E2, E3</p>
      <StoryAction id="E1" label="Open Signet Faucet(s)" disabled={!canFund || funding} onClick={onFund} />
      <StoryAction id="E2" label="Open On Mempool.space" disabled={!canFund || funding} onClick={onExplorer} />
      <StoryAction id="E3" label="Open Onboarding" disabled={!playerActive || !onOpenOnboarding} onClick={onOpenOnboarding} />
    </StorySection>
    {gameWallet}
    {contracts}
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
