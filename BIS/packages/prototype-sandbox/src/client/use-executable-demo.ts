import { useState } from 'react';
import type { TestNetwork } from '../../../integration/src/client/state-layer-core/test-network.ts';
import { useDemoOutput } from './demo-output.ts';
import { demoDefinition } from './demo-registry.ts';
import { demoErrorMessage, type DemoContext } from './demo-runtime.ts';

/** The page owns timing and loading. Each registered file owns its operation. */
export function useExecutableDemo(sourceId: string, network: TestNetwork) {
  const { output, elapsedMs, setOutput, setElapsedMs, beginExecution } = useDemoOutput();
  const [running, setRunning] = useState(false);
  async function execute(options: Omit<DemoContext, 'network'> = {}) {
    beginExecution();
    setElapsedMs(null);
    setRunning(true);
    const startedAt = performance.now();
    try {
      const result = await demoDefinition(sourceId).run({ network, ...options });
      setOutput(result.output, result.details);
      return result;
    } catch (error) {
      setOutput(`Error: ${demoErrorMessage(error)}\nSuccess: false`);
    } finally {
      setElapsedMs(Math.round(performance.now() - startedAt));
      setRunning(false);
    }
  }
  return { output, elapsedMs, running, execute };
}
