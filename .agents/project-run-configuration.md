# Shared development server

portRange: 5174-5174
preferredPort: 5174

The BIS root launcher serves all packages at this origin. The faucet API uses
5190. Stealth & Steel reserves 5176. Reuse a healthy, ownership-verified server.
Never stop or move it during an ordinary start. An occupied or unhealthy fixed
port requires inspection and explicit restart approval, not fallback.

All starts share `output/run-state/startup.lock`. The installed run helper
hands its lock token to the root launcher. A stale lock is reported, never
automatically stolen. State updates use atomic replacement. Explicit isolated
tests require `--isolated --port <test-port>` and separate run-state directories.
They must not touch shared previews or wallet storage.
