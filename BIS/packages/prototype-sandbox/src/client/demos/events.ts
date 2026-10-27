// Arrange
import { demoResult, type DemoContext } from '../demo-runtime.ts';
import { demoGetInput } from '../navigation.ts';
import { decodeArkadeAddress } from '../../../../prototype-faucet/src/shared/faucet-core.ts';
import { openEventsMonitor as demoOpenEventsMonitor } from '../events-popup.ts';

export async function runDemo({ network }: DemoContext) {
  const address = demoGetInput(network, 'wallet-1-address');

  // Act
  decodeArkadeAddress(address);
  demoOpenEventsMonitor(network, address);

  // Assert
  return demoResult('Monitor window opened. Wait for its listening message, then use another demo.\nNo payment has been initiated.\nSuccess: true');
}
