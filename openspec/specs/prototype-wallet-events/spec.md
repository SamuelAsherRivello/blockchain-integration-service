# prototype-wallet-events Specification

## Purpose

Let sandbox users observe real Arkade activity at Wallet 1's public address in a separate window while operating the existing demos.

## Requirements

### Requirement: Events entry and teaching flow
The sandbox SHALL place one demo named `Events` in an Events section after Assets and before Smart Contracts. Its page SHALL retain the shared overview, input, executable source, Execute action, and output conventions and explain which existing demos affect Wallet 1.

#### Scenario: Discover and execute
- **WHEN** the user selects Events
- **THEN** the page identifies the selected Wallet 1 public address and network and explains Send Payment, Send Asset, and Send Payment from External Wallet as event sources
- **AND** it explains that Mint Asset alone affects Wallet 2 and that receive/history reads do not initiate transfers
- **AND** the displayed executable source contains exactly Arrange, Act, and Assert sections in that order

### Requirement: Independent minimal popup
Execute SHALL request a resizable 500 by 400 pixel popup with a black background and centered white card with 7px rounded corners. Its front SHALL show `Wallet 1`, the captured network in parentheses, then connection/activity text. It SHALL offer a flip-side session log but no transaction controls or balance dashboard. Monitoring SHALL continue during main-window navigation.

#### Scenario: Navigate while listening
- **WHEN** the popup is ready and the user navigates from Events to Send Payment
- **THEN** the popup remains open and continues observing its captured Wallet 1 address

#### Scenario: Popup blocked
- **WHEN** the browser blocks the popup
- **THEN** the Events page explains that the user must allow popups and retry
- **AND** it does not report a running listener

### Requirement: Public-address observation
The popup SHALL observe only the exact Wallet 1 Arkade address and network captured at launch, without reading a mnemonic or authorizing transactions. It SHALL handle received, spent, and swept outputs supplied by the address subscription, including exact asset quantities, and transport interruption/reconnection. Unsupported event categories SHALL NOT be fabricated.

#### Scenario: Incoming payment
- **WHEN** an address-scoped network event reports a new payment output to Wallet 1
- **THEN** the popup describes the sats supplied by that event
- **AND** the sending demo's local success callback alone cannot trigger the notification

#### Scenario: Asset receipt
- **WHEN** an incoming output contains assets
- **THEN** the popup describes the asset ID and exact quantity without treating an asset transfer as only a sats payment

#### Scenario: Spent or swept output
- **WHEN** the subscription supplies a Wallet 1 output spend or sweep
- **THEN** the popup describes that supported change without inventing an outgoing recipient or interpreting every spent output as a payment

#### Scenario: Setup changes
- **WHEN** the main window changes its configured network or address after launch
- **THEN** the existing popup remains bound to the captured values until explicitly relaunched for the new configuration

### Requirement: Quiet startup and deduplication
The observer SHALL establish an internal baseline without displaying historical holdings as fresh events. It SHALL avoid losing events during initialization and suppress repeated observations of the same output transition across reconnects. A genuinely new spend SHALL remain observable even if its receipt was not seen.

#### Scenario: Existing funded address
- **WHEN** a popup starts for an address that already holds sats or assets
- **THEN** it becomes ready without a receipt message or pulse for those existing holdings

#### Scenario: Arrival during startup
- **WHEN** a new receipt arrives after the stream is established but before baseline preparation finishes
- **THEN** the receipt is retained and displayed once after preparation

#### Scenario: Replay after reconnect
- **WHEN** a transport reconnect repeats an already processed output transition
- **THEN** that transition does not trigger another notification

### Requirement: Event message and pulse timing
A new activity notification SHALL replace the listening line and animate three scale pulses from 100% to 120% and back with 0.5 seconds per half-cycle, finishing at three seconds. The newest message SHALL remain until five seconds after display, then restore current connection status. Newer events SHALL replace the active message and restart its timing without queuing older messages on the front.

#### Scenario: Single notification
- **WHEN** a new event is displayed at time zero
- **THEN** three pulses finish at three seconds, the card stays at 100% scale through five seconds, and the line then resets

#### Scenario: Overlapping events
- **WHEN** a distinct event arrives before the previous message resets
- **THEN** the latest description replaces it and obsolete animation/reset callbacks cannot clear the new message

#### Scenario: Reduced motion
- **WHEN** the user requests reduced motion
- **THEN** the event message remains for five seconds without scale pulses

### Requirement: Truthful connection and resource lifecycle
The popup SHALL show connecting, reconnecting, or unavailable text when readiness is not established. It SHALL reconnect with bounded backoff and release subscriptions, retries, and animations on closure. Repeated Execute SHALL reuse the existing popup for the same captured configuration and replace its observation safely for a changed configuration.

#### Scenario: Disconnection
- **WHEN** an established stream fails
- **THEN** the card reports reconnection instead of implying that it is actively listening or that funds arrived
- **AND** only one stream resumes after recovery

#### Scenario: Close and reopen
- **WHEN** a popup is closed and Execute is used again
- **THEN** the old observation stops and the new popup establishes a fresh quiet baseline

### Requirement: Separate UI and live acceptance
Verification SHALL distinguish deterministic UI/observer checks from real network acceptance. Live acceptance SHALL require an independent popup to report attributable Signet and Mutinynet payment and asset arrivals from existing demos. Missing network evidence SHALL remain explicit and SHALL NOT be replaced by simulated production events.

#### Scenario: Funded flow
- **WHEN** Send Payment and Mint Asset followed by Send Asset complete independently on Signet and Mutinynet while each monitor is ready
- **THEN** the popup displays the corresponding network-supplied payment and asset notifications, pulses, and resets
- **AND** test evidence records public identifiers without mnemonics

### Requirement: Animated idle status
The visible idle front SHALL cycle one, two, and three status dots at one-second intervals without changing connection meaning or adding log entries. Animation SHALL pause while hidden or flipped. Dot ticks SHALL NOT cause repeated accessibility announcements.

#### Scenario: Idle heartbeat
- **WHEN** the foreground card is connecting, reconnecting, or listening without an active notification
- **THEN** the dots advance once per second and repeat after three steps
- **AND** the connection state and session-log count remain unchanged by dot ticks

### Requirement: Flip-side session history
Clicking the card or pressing Enter/Space SHALL toggle a Y-axis flip between the compact front and an available-height back containing a scrollable chronological log. The log SHALL retain distinct connection changes and every observed activity during the session, starting with Connecting and then Connected when ready. It SHALL reset on reload or relaunch. Reduced motion SHALL preserve access without the spatial transition.

#### Scenario: Review observed activity
- **WHEN** the user flips the card after payment and asset notifications
- **THEN** the log lists connection changes and both notifications in observation order
- **AND** the log remains independently scrollable within the popup

#### Scenario: Activity while flipped
- **WHEN** new activity arrives while the back is visible
- **THEN** the activity is added to the log and updates the front's newest-message state
- **AND** returning to the front shows only the unexpired newest event or current connection status

### Requirement: Network-aware actions and stable navigation
Every sandbox demo action SHALL display a larger bold action label with the selected network below it in smaller regular-weight parentheses. Network changes SHALL update that label without reloading. The left navigation SHALL remain 232 CSS pixels wide rather than collapse, while the right content flexes with available width.

#### Scenario: Resize and change networks
- **WHEN** the user narrows the sandbox window and selects the other network
- **THEN** the sidebar retains its width, content stays beside it, and the action's secondary line identifies the newly selected network

### Requirement: Submitted Setup values and isolated wallet state
Subsequent demo actions SHALL read the latest submitted Setup values without requiring a reload. Persistent wallet state SHALL remain separated by network and identity within each browser, preserving existing identity state and databases. Independent browser profiles SHALL NOT inherit one another's local state. An already-open public monitor SHALL still require explicit relaunch to retarget.

#### Scenario: Switch signing identity
- **WHEN** the user submits a different Wallet 2 mnemonic, executes a demo, then restores the earlier mnemonic
- **THEN** each action uses the submitted identity and its own saved state rather than another identity's HD descriptor
- **AND** no existing wallet database is cleared to permit the switch

### Requirement: Environment-aware readable source
Sandbox source buttons SHALL open readable local file text in a separate same-origin window during Vite development and the corresponding GitHub file in the deployed Pages build. Local viewing SHALL NOT execute the source module or permit arbitrary file reads.

#### Scenario: Open source locally
- **WHEN** the user opens a demo source file through a running Vite sandbox
- **THEN** a new window displays the actual allowlisted source text rather than a transformed JavaScript wrapper
- **AND** an unknown file parameter cannot disclose another file

#### Scenario: Open source from Pages
- **WHEN** the user opens a source file in the production build
- **THEN** the destination is the corresponding GitHub file rather than a local development route

### Requirement: Reliable shared demo diagrams
Every sandbox demo's Diagram tab SHALL render its SVG in the shared development preview and remain compatible with production builds. Isolated preview startup SHALL NOT replace the shared preview's dependency cache or require wallet-state resets to restore diagrams.

#### Scenario: Render the complete diagram catalog
- **WHEN** the user opens Diagram on each of the twenty-one demo routes
- **THEN** each route renders a nonempty diagram rather than the failure fallback
