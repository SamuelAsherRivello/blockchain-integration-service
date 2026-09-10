import { RecoveryPhraseEntry } from './RecoveryPhraseEntry';
import { getControls, type BisContext, type BisState } from '../core/context';

export function RestoreAccount({ context, phase }: { context: BisContext; phase: BisState['phase'] }) {
  const editable = phase === 'restore-entry';
  const busy = phase === 'restoring' || phase === 'restore-saving';
  return <RecoveryPhraseEntry editable={editable} disabled={busy} hideWhen={!editable}
    submitLabel={phase === 'restore-error' ? 'Retry' : '⚡ Restore'}
    onSubmit={phrase => { void (phase === 'restore-error' ? context.retry() : getControls(context).restore(phrase)); }}
    onBack={() => context.closeAccount()} backDisabled={phase === 'restore-saving'} />;
}
