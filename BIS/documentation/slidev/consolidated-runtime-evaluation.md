# Consolidated Slidev runtime evaluation

The installed `@slidev/cli` 53.0.0 public Node entry point exports
`resolveOptions(entryOptions, mode)` and
`createServer(options, viteConfig?, serverOptions?)`. Each call accepts one
resolved Slidev entry and returns one Vite development server. The CLI follows
the same shape: it resolves a single `entry`, creates one server, and calls
`server.listen()`.

There is no documented multi-entry or manifest-routed server API in this
version. A shared listener would therefore require a custom Vite adapter that
dispatches each route to distinct Slidev option sets, virtual modules, editor
save endpoints, and HMR clients. Simply mounting the existing servers behind
one Vite process would risk collisions in the generated `@slidev/slides`
module, root-relative editor API, and HMR channel.

The current landing proxy is already a single browser origin while preserving
those independent Slidev identities. Keep that model unless a future Slidev
release supplies an explicit multi-entry development-server API, or an adapter
is implemented with evidence that every declared deck retains source, editor,
generated-module, and HMR isolation under targeted recovery.

Evidence inspected on 2026-10-07:

- `node_modules/@slidev/cli/dist/index.d.mts`
- `node_modules/@slidev/cli/dist/serve-DzvJFv6v.mjs`
- `node_modules/@slidev/cli/dist/cli.mjs`
