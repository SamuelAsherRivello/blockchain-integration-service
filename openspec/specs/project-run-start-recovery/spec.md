# project-run-start-recovery Specification

## Purpose
Provides reliable local development startup for the shared project server by
recovering from ownership, port, process, sidecar, and verification conditions.

## Requirements

### Requirement: Owned server restart

The run workflow SHALL identify and stop only development processes owned by the
current project before starting a fresh server.

#### Scenario: Restart an owned preferred-port server

- **WHEN** the preferred port is serving this project
- **THEN** the workflow stops that project process tree, waits for termination,
  and starts one fresh server on the preferred port

#### Scenario: Preserve an unrelated server

- **WHEN** the preferred port is serving another project
- **THEN** the workflow leaves that process untouched and chooses another port

### Requirement: Fallback port selection

The run workflow SHALL try the declared preferred port followed by a dedicated
fallback range and SHALL return the actual selected port.

#### Scenario: Preferred port unavailable

- **WHEN** the preferred port cannot be bound
- **THEN** the workflow starts the project on the first usable fallback port

#### Scenario: Port race during launch

- **WHEN** another process claims a candidate port after probing but before the
  project binds
- **THEN** the workflow treats the bind conflict as recoverable and retries the
  next candidate without leaving a duplicate project server

### Requirement: Authoritative project launch

The workflow SHALL launch the repository's configured development command with
the selected host and port and SHALL NOT require an assumed root Vite config.

#### Scenario: Repository launcher has custom configuration

- **WHEN** the project exposes a shared launcher script
- **THEN** the workflow invokes that script and passes the selected host and
  port through its supported arguments

### Requirement: Optional sidecar tolerance

The workflow SHALL distinguish a healthy shared Vite server from an optional
sidecar failure and SHALL keep the Vite server available when the sidecar's
fixed port is independently occupied.

#### Scenario: Faucet API port is already occupied

- **WHEN** the shared Vite server starts but the optional faucet API cannot bind
  its fixed port
- **THEN** the workflow retains the Vite server, reports the sidecar state, and
  continues route verification

### Requirement: Route and identity verification

The workflow SHALL verify every configured route against the selected server
and SHALL report each route with its configured application identity and URL.

#### Scenario: All routes respond

- **WHEN** every configured route returns a successful HTTP response with the
  expected application marker or title
- **THEN** the workflow reports the run as verified

#### Scenario: Verification runtime cannot reach loopback

- **WHEN** the server is listening but the invoking sandbox cannot access its
  loopback socket
- **THEN** the workflow keeps the server running and reports the URLs as
  host-verification-pending rather than stopping startup

### Requirement: Single-server invariant

The workflow SHALL retain at most one project-owned development server after
startup and SHALL reconcile duplicate project-owned launches before reporting
success.

#### Scenario: Duplicate project launch detected

- **WHEN** more than one project-owned development process is found
- **THEN** the workflow keeps one selected server and stops only the extra
  project-owned process trees
