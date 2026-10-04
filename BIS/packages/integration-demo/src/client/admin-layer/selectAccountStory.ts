import type { BisContext, createBisUi } from '@bis/integration';

type StorySession = { context: BisContext; ui: ReturnType<typeof createBisUi> };

export function selectAccountStory(id: string, session: StorySession | null) {
  if (!session) return;
  if (id === 'A.P.1') { session.ui.showAccountButton(); return; }
  session.context.openAccountDialog();
  if (id === 'B.P.8') { session.context.openAccountOnboarding?.(); return; }
  if (id === 'B.P.7') session.context.openAccountTransfer();
  if (id === 'E.P.1') { session.context.openAccountActivity(); return; }
  const state = session.context.getState();
  if (id === 'B.P.5' && state.hasProfile && state.phase === 'active') session.context.openAccountSend();
  if (id === 'B.P.3' && state.hasProfile && state.phase === 'active') session.context.openAccountReceive();
}
