# BIS host content security policy

`BIS/scripts/content-security-policy.ts` protects shared development routes,
standalone package development/preview configurations, built HTML and copied
Pages launchers/redirects. Development HTML receives a fresh nonce per response.
Static inline redirect scripts use their exact SHA-256 hashes. Arbitrary inline
JavaScript, event attributes, JavaScript eval, foreign scripts and object embeds
are blocked. WebAssembly compilation remains allowed for SDK compatibility.
Inline styles and HTTPS asset images remain allowed.

Connections allow the known Arkade operators/co-signer, explorers, repository
metadata, same-origin APIs and existing local Conditional Vault endpoints.
Development additionally allows loopback WebSockets for Vite. An additional
hosted signer or metadata origin must be declared through the public build/start
environment variable `BIS_CSP_CONNECT_ORIGINS`, comma- or whitespace-separated.
Only HTTPS origins or loopback HTTP origins are accepted. Credentials, paths,
queries and directive injection are rejected. Runtime signer configuration does
not grant a new browser CSP permission. Never place secrets in this variable.

Pages HTML carries a CSP meta tag. Development and preview also send
`frame-ancestors 'self'` and `X-Content-Type-Options: nosniff`; static hosting
needs its own response-header configuration for those two protections. No
deployment or game-host security qualification is implied by the source change.
CSP is defense in depth, not isolation between wallets and code on one origin.

The targeted documentation-renderer upgrade installs Mermaid 12.2.0, DOMPurify
3.4.17 and KaTeX 0.18.10. A zero-known-vulnerability audit is a dated check, not
a guarantee that dependencies have no vulnerabilities or are all latest.

Verification uses `node --test BIS/scripts/content-security-policy.test.ts`,
package builds, production-prefix Sandbox build, `npm run stage:pages` and
`npm run verify:pages`. Browser tests use fresh wallet-free profiles and their
own ephemeral server. They do not start financial acceptance or replace shared
servers. The policy tests cover injected script/eval/event blocking, fresh
response nonces, application entry routes, sanitized Mermaid, authored inline
hashes and copied static entries. Financial acceptance and production rollout
remain separate gates.
