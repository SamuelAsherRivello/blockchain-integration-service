# Spec Delta

## Purpose

Provide local Slidev links with one unambiguous active-slide position that can
be copied, shared, and verified without conflicting navigation state.

## ADDED Requirements

### Requirement: Canonical local deck URL has one slide position
The local preview SHALL identify a deck by its declared base path and the
active slide only by its Slidev hash route. A canonical deck URL SHALL contain
exactly one slide number in the `#/N` fragment and no numeric slide suffix in
the pathname after the deck base.

#### Scenario: Author copies the active presentation URL
- **WHEN** an author is viewing slide 59 of a declared deck through the local launcher
- **THEN** the copied URL ends with the deck base followed by `#/59`
- **AND** the pathname contains no additional slide number

### Requirement: Generated local navigation uses canonical URLs
The local landing page, runtime status and verification output, and theme
navigation links SHALL generate canonical local deck URLs.

#### Scenario: Author opens a deck from the landing page
- **WHEN** an author selects a declared deck from the local landing page
- **THEN** the browser opens that deck at `#/1` without a pathname slide suffix

#### Scenario: Verification reports a deck route
- **WHEN** local preview verification reports a route for a declared deck slide
- **THEN** the route identifies the deck base and the slide only through its hash fragment

### Requirement: Canonical URLs preserve deck routing and slide navigation
The launcher SHALL continue routing a canonical deck URL to its manifest-declared
deck, and Slidev navigation SHALL update the one hash-based slide position.

#### Scenario: Author follows a canonical deep link
- **WHEN** an author opens a canonical URL for a declared deck and slide
- **THEN** the declared deck renders the referenced slide
- **AND** subsequent next and previous navigation updates only the hash slide position

#### Scenario: A legacy duplicate-position URL is opened
- **WHEN** a URL contains both a pathname slide suffix and a hash slide position
- **THEN** the runtime does not generate or report that form as a canonical link
