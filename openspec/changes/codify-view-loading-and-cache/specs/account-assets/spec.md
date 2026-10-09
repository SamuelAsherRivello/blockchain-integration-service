# Spec Delta

## MODIFIED Requirements

### Requirement: Fresh bounded reads and explicit states
Assets SHALL request ownership on entry when automatic loading is enabled and no valid recent cache exists, and on explicit Refresh. The Pending Operation Dialog SHALL cover loading and retry once with 30 seconds per attempt when the Assets loading policy enables modal coverage. A valid complete same-account, same-network cached result SHALL be revealed without that dialog. Underlying controls SHALL be inert only while modal coverage is active. On success it SHALL reveal fresh holdings or No assets found. Final failure SHALL show an error and OK in the operation dialog; OK closes the source page. Previous rows and amounts SHALL not be revealed as current after an expired, failed, or partial read. No background polling SHALL be introduced.

Detail Refresh SHALL retain selection and navigation context underneath the covering dialog. Fresh results SHALL update detail or return to Assets when the holding is absent with Asset is no longer in your owned assets., restoring appropriate focus and clamped scroll position. After a terminal detail-refresh failure, OK SHALL return to the parent Assets list through a fresh covered read if necessary.

#### Scenario: Empty versus failed query
- **WHEN** a fresh query succeeds with zero holdings or both read attempts fail
- **THEN** the former reveals No assets found and the latter keeps the source page covered by an error with OK

#### Scenario: Return within freshness window
- **WHEN** the player leaves Assets after a complete successful query and returns within 15 seconds for the same account and network
- **THEN** the cached holdings appear without another foreground ownership request or loading dialog

#### Scenario: Detail refresh updates or removes a holding
- **WHEN** Refresh returns a changed quantity or no longer contains the selected asset
- **THEN** the prepared detail shows the exact new quantity or the prepared list is revealed with appropriate focus and scroll

### Requirement: Account isolation and API compatibility
Asset presentation SHALL belong to the active account and current presentation session. Complete successful ownership data may remain in the ephemeral cache for the configured freshness window, scoped by account, network, and data type. Leaving the asset flow, switching or clearing accounts, network change, reset, unmount, and disposal SHALL clear presentation values or invalidate incompatible cached reads and delayed copy feedback. Existing public asset listing SHALL remain UI-independent and SHALL NOT navigate or update runtime asset presentation as a side effect. C.G.1 Mint Asset and Asset listing SHALL retain their existing Admin behavior. Inspection SHALL NOT submit transactions or require unrelated pending wallet operations to complete.

#### Scenario: Leave and reenter during loading
- **WHEN** a player leaves a pending asset read and enters Assets again, or another account becomes active
- **THEN** only results for the new presentation session and account can populate the view, and an incomplete old read cannot enter the cache

#### Scenario: Reenter after a successful read
- **WHEN** the player reenters Assets within the configured freshness window
- **THEN** the complete cached result may populate the list, but a changed account or network cannot use it

#### Scenario: Admin listing while runtime exists
- **WHEN** a host calls the public listing API or executes the existing asset-listing action where enabled
- **THEN** results remain available to that caller without opening, clearing, changing, or caching a runtime presentation as a side effect
