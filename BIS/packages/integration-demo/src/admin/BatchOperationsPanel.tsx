import { useRef, useState } from 'react';
import { StoryButton } from './StoryButton';
import { StorySection } from './StorySection';

type LocalBatchAction = 'started' | 'replaced' | 'cleared';

export type BatchOperationsLog = Readonly<{
  operation: 'Batch Operations';
  scope: 'local';
  action: LocalBatchAction;
  message: string;
}>;

export function BatchOperationsPanel({ onLog }: { onLog(entry: BatchOperationsLog): void }) {
  const [batch, setBatch] = useState<number>();
  const [transitioning, setTransitioning] = useState(false);
  const sequence = useRef(0);
  const transitionLocked = useRef(false);

  function releaseTransition() {
    setTimeout(() => {
      transitionLocked.current = false;
      setTransitioning(false);
    }, 0);
  }

  function startNewBatch() {
    if (transitionLocked.current) return;
    transitionLocked.current = true;
    setTransitioning(true);
    const action: LocalBatchAction = batch === undefined ? 'started' : 'replaced';
    setBatch(++sequence.current);
    onLog({
      operation: 'Batch Operations',
      scope: 'local',
      action,
      message: action === 'started' ? 'Started a local Admin batch session.' : 'Replaced the local Admin batch session.',
    });
    releaseTransition();
  }

  function clearLastBatch() {
    if (batch === undefined || transitionLocked.current) return;
    transitionLocked.current = true;
    setTransitioning(true);
    setBatch(undefined);
    onLog({
      operation: 'Batch Operations',
      scope: 'local',
      action: 'cleared',
      message: 'Cleared the local Admin batch session.',
    });
    releaseTransition();
  }

  return <StorySection title="04. Batch Operations" className="batch-operations-panel">
    <p className="story-summary">Local Admin batch-session controls.</p>
    <StoryButton label="Clear Last Batch">
      <button disabled={batch === undefined || transitioning} onClick={clearLastBatch}>Clear Last Batch</button>
    </StoryButton>
    <StoryButton label="Start New Batch">
      <button disabled={transitioning} onClick={startNewBatch}>Start New Batch</button>
    </StoryButton>
  </StorySection>;
}
