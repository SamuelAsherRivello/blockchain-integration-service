# Spec Delta

## MODIFIED Requirements

### Requirement: Fresh bounded reads and explicit states
Assets SHALL use a complete fresh account/network ownership snapshot on entry, join compatible ownership preparation already in progress, or start a new foreground read. An eligible one-shot background read SHALL serve the same inspection data without opening the page. Explicit Refresh SHALL bypass completed values and request current live data, joining only eligible live work under the shared refresh policy.

The Pending Operation Dialog SHALL cover foreground preparation after the construction gate on entry and immediately on explicit Refresh. Reads SHALL retry once with 30 seconds per attempt; attaching to existing work SHALL preserve elapsed time and consumed attempts. Underlying controls SHALL be inert during modal coverage. On success the view SHALL reveal complete holdings or No assets found. Final failure SHALL show an error and OK in the operation dialog; OK closes the source page. Previous rows and amounts SHALL not be revealed as current after failure or persisted as a fallback. No background polling SHALL be introduced.

Detail Refresh SHALL retain selection and navigation context underneath the covering dialog. Fresh results SHALL update detail or return to Assets when the holding is absent with Asset is no longer in your owned assets., restoring appropriate focus and clamped scroll position. After a terminal detail-refresh failure, OK SHALL return to the parent Assets list through a fresh covered read if necessary.

#### Scenario: Empty versus failed query
- **WHEN** a complete query succeeds with zero holdings or both read attempts fail
- **THEN** the former reveals No assets found and the latter keeps the source page covered by an error with OK

#### Scenario: Detail refresh updates or removes a holding
- **WHEN** Refresh returns a changed quantity or no longer contains the selected asset
- **THEN** the prepared detail shows the exact new quantity or the prepared list is revealed with appropriate focus and scroll

#### Scenario: Navigation adopts ownership warming
- **WHEN** Assets opens while a compatible ownership read is already pending
- **THEN** the normal entry loading presentation appears and the existing request supplies the result without restarting ownership work

### Requirement: Account isolation and API compatibility
Asset presentation SHALL belong to the active account, network, and current presentation session. Leaving the asset flow or unmounting its view SHALL clear presentation values, detach page consumers, and invalidate delayed visible updates and copy feedback, while valid context-owned ownership preparation can continue and populate the cache. Switching or clearing accounts, network replacement, reset, and context disposal SHALL invalidate affected completed and pending data.

Existing public asset listing SHALL remain UI-independent and SHALL NOT navigate or update runtime asset presentation as a side effect. Compatible presentation consumers SHALL share in-flight ownership work; APIs and mutations that require a new authoritative ownership check SHALL retain that live-read contract. C.G.1 Mint Asset and Asset listing SHALL retain their existing Admin behavior. Inspection SHALL NOT submit transactions or require unrelated pending wallet operations to complete.

#### Scenario: Leave and reenter during loading
- **WHEN** a player leaves a pending shared asset read and enters Assets again for the same valid account and network
- **THEN** the new presentation session joins that request and only its attached consumer can populate the current view

#### Scenario: Another account becomes active
- **WHEN** a pending ownership read resolves after account or network replacement
- **THEN** its result cannot populate the new view or repopulate affected cached data

#### Scenario: Admin listing while runtime exists
- **WHEN** a host calls the public listing API or executes the existing asset-listing action where enabled
- **THEN** results remain available to that caller without opening, clearing, or changing the runtime view

