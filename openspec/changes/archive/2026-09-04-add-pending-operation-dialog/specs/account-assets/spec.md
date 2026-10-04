## MODIFIED Requirements

### Requirement: Fresh bounded reads and explicit states
Assets SHALL request fresh ownership on entry and explicit Refresh. The Pending Operation Dialog SHALL cover loading and retry once with 30 seconds per attempt. Underlying controls SHALL be inert. On success it SHALL reveal fresh holdings or No assets found. Final failure SHALL show an error and OK in the operation dialog; OK closes the source page. Previous rows and amounts SHALL not be revealed as current or persisted as a fallback. No background polling SHALL be introduced.

Detail Refresh SHALL retain selection and navigation context underneath the covering dialog. Fresh results SHALL update detail or return to Assets when the holding is absent with Asset is no longer in your owned assets., restoring appropriate focus and clamped scroll position. After a terminal detail-refresh failure, OK SHALL return to the parent Assets list through a fresh covered read if necessary.

#### Scenario: Empty versus failed query
- **WHEN** a fresh query succeeds with zero holdings or both read attempts fail
- **THEN** the former reveals No assets found and the latter keeps the source page covered by an error with OK

#### Scenario: Detail refresh updates or removes a holding
- **WHEN** Refresh returns a changed quantity or no longer contains the selected asset
- **THEN** the prepared detail shows the exact new quantity or the prepared list is revealed with appropriate focus and scroll
