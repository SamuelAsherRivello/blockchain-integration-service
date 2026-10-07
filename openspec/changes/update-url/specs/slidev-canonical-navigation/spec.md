# Spec Delta

## Purpose

Provide Slidev deck links that name one deck and one active slide entirely in
the pathname, so copied links remain simple and directly requestable.

## ADDED Requirements

### Requirement: Canonical deck URL has one pathname slide position
The preview SHALL identify a deck by its declared base path and the active
slide by one trailing numeric pathname segment. A canonical URL SHALL use
`/slidev/<deck>/<slide>` and SHALL not contain a hash slide route.

#### Scenario: Author copies the active presentation URL
- **WHEN** an author views slide 59 of a declared deck
- **THEN** the copied URL ends in `/59`
- **AND** the URL contains no `#` fragment or additional slide number

### Requirement: Generated navigation uses pathname canonical URLs
The local and public landing pages, runtime status and verification output, and
theme navigation links SHALL generate path-only canonical deck URLs.

#### Scenario: Author opens a deck from the landing page
- **WHEN** an author selects a declared deck
- **THEN** the browser opens that deck at `/slidev/<deck>/1`

### Requirement: Canonical deep links survive direct requests
Local preview and published public decks SHALL render a declared pathname slide
when that URL is requested directly or refreshed.

#### Scenario: Author follows a published deep link
- **WHEN** an author opens `/slidev/<deck>/29` directly
- **THEN** the declared deck renders slide 29
- **AND** subsequent navigation updates the pathname slide position
