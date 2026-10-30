//////////////////////////////////////////
// Arrange
//////////////////////////////////////////
import { RestIndexerProvider } from '@arkade-os/sdk';
import { createEventLedger, publicAddressScript, type WalletActivity } from '../wallet-events.ts';
import { networkDefinition, type TestNetwork } from '../sandbox-shared.ts';

type DemoResultLog = (activity: WalletActivity) => void;

/** A compact view of the listener. The live observer also reconciles snapshots and reconnects. */
export async function observeAddressScript(
  network: TestNetwork,
  address: string,
  signal: AbortSignal,
  demoResultLog: DemoResultLog,
) {
  const script = publicAddressScript(address);
  const indexer = new RestIndexerProvider(networkDefinition(network).operator);
  const ledger = createEventLedger(script);

  //////////////////////////////////////////
  // Act
  //////////////////////////////////////////
  const subscriptionId = await indexer.subscribeForScripts([script]);
  try {
    for await (const frame of indexer.getSubscription(subscriptionId, signal)) {
      const activity = ledger.consume(frame);
      if (activity) demoResultLog(activity);
    }
  } finally {
    await indexer.unsubscribeForScripts(subscriptionId).catch(() => {});
  }

  //////////////////////////////////////////
  // Assert
  //////////////////////////////////////////
  if (!signal.aborted)
    throw new Error('The Arkade script event stream ended unexpectedly.');
}
