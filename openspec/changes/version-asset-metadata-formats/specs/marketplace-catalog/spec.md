# Spec Delta

## ADDED Requirements

### Requirement: Marketplace recognizes only the latest asset format
Marketplace SHALL classify, render as an owned equipment item, publish for trading, and use for checkout only a holding resolved as the registry's latest asset format. For a supported earlier version with automatic upgrade enabled, Marketplace SHALL show a truthful upgrading/pending state while BIS completes or resumes migration; it SHALL not enable item behavior until the latest-format replacement is verified. Older compatible formats with automatic upgrade disabled, unsupported formats, malformed markers, and legacy metadata SHALL remain outside Marketplace item behavior and SHALL receive a truthful migration/unsupported state without inferred effects.

#### Scenario: Marketplace reads an earlier-format holding
- **WHEN** fresh inventory contains an otherwise valid marketplace item from a format older than the registry's latest version
- **THEN** Marketplace does not render it as an eligible owned item or enable a marketplace action for it
- **AND** it reports the holding as version-migration-required or unsupported without fabricating gameplay metadata

#### Scenario: Marketplace reads the current format
- **WHEN** fresh inventory contains a holding that resolves as the latest format and passes its strict catalog validation
- **THEN** Marketplace renders and operates on it using the existing catalog behavior
