## ADDED Requirements

### Requirement: Event-driven visible asset updates
While Assets is open, BIS SHALL observe output changes for the current account receive scripts, including subdust, and refresh holdings on incoming, spent or swept output events without periodic asset polling. Event refreshes SHALL preserve an already prepared page without a covering progress dialog and coalesce bursts into a bounded number of reads. Leaving Assets, changing account or disposing the context SHALL stop observation and invalidate late results. Stream unavailability SHALL leave manual Refresh available without introducing a polling fallback.

#### Scenario: Holding changes while visible
- **WHEN** the stream reports an output change while Assets is open
- **THEN** a fresh read updates quantities or removes absent holdings without requiring a click or opening a progress overlay

#### Scenario: Exit and late events
- **WHEN** the player leaves Assets or changes account
- **THEN** the subscription is stopped and late callbacks cannot refresh or reopen the former view
