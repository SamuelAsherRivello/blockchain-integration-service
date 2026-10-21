export const EVENTS_SOURCE = `// Arrange
import { openEventsMonitor } from './events-popup.ts'

const network = localStorageGetItem('network')
const address = localStorageGetItem('wallet-1-address')

// Act
const popup = openEventsMonitor(network, address)

// Assert
console.log('Demo: Events')
console.log('Monitor window opened:', Boolean(popup))
console.log('Next: wait for the popup to say listening, then try Send Payment or Send Asset.')
console.log('Success:', Boolean(popup))`;
