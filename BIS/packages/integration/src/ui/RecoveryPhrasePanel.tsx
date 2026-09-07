import { useLayoutEffect, useState, type ReactNode } from 'react';
import { FieldHeading } from './FieldHeading';
import { CopyButton, VisibilityToggle } from './IconButton';
import { useClipboardCopy } from './useClipboardCopy';

export function TestWalletWarning() {
  return <p className="bis-warning bis-seed-warning">Never use a real wallet’s phrase.</p>;
}
export function SeedWordsHeading({ action, shown, onToggle, disabled, spread = false, children }: {
  action: ReactNode; shown: boolean; onToggle(): void; disabled?: boolean; spread?: boolean; children?: ReactNode;
}) {
  return <FieldHeading label="Seed words" className={`bis-recovery-heading${spread ? ' bis-seed-heading-spread' : ''}`}>
    {action}<VisibilityToggle shown={shown} disabled={disabled} onClick={onToggle} />{children}
  </FieldHeading>;
}
function ReadOnlyRecoveryWords({ phrase, shown }: { phrase?: string; shown: boolean }) {
  return <ol className="bis-recovery" aria-label="Private recovery phrase">{phrase?.trim().split(/\s+/).map((word, index) =>
    <li key={index}><span aria-hidden="true">{index + 1}.</span> <span className="bis-recovery-word">{shown ? word : '*'.repeat(word.length)}</span></li>)}</ol>;
}
/** Only private runtime callers receive recovery material. Session identity never contains words. */
export function RecoveryPhrasePanel({ phrase, session, disabled }: { phrase?: string; session: object; disabled: boolean }) {
  const [visibleSession, setVisibleSession] = useState<object>();
  const shown = visibleSession === session;
  useLayoutEffect(() => { setVisibleSession(undefined); }, [session]);
  const copy = useClipboardCopy(() => phrase?.trim().split(/\s+/).join(' '), session, disabled);
  return <>
    <SeedWordsHeading spread shown={shown} onToggle={() => setVisibleSession(shown ? undefined : session)} action={<CopyButton label="Seed words" copied={copy.hasCopied} disabled={disabled} onClick={() => void copy.copy()} />}>
      <span className="bis-sr-only" role="status">{copy.status === 'copied' ? 'Copied to clipboard.' : ''}</span>
    </SeedWordsHeading>
    {copy.status === 'failed' && <span className="bis-copy-status" role="status">Could not copy. Try again or copy the words manually.</span>}
    <ReadOnlyRecoveryWords phrase={phrase} shown={shown} />
  </>;
}
