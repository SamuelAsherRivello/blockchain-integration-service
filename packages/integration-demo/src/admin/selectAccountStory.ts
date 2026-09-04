import type { BisContext, createBisUi } from '@bis/integration';

type StorySession = { context: BisContext; ui: ReturnType<typeof createBisUi> };

export function selectAccountStory(id: string, session: StorySession | null) {
  if (!session) return;
  if (id === 'A1') { session.ui.showAccountButton(); return; }
  session.context.openAccountDialog();
  if (id === 'D4') session.context.openAccountTransfer();
  const state = session.context.getState();
  if (id === 'D2a' && state.hasProfile && state.phase === 'active') session.context.openAccountReceive();
}
