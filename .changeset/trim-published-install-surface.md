---
"@hashintel/brunch": patch
---

Trim the published install surface without changing runtime behavior:

- Production dependencies 23 → 15. `stringify-tree` is deleted with its last consumer, and seven packages move to `devDependencies`: the six web-only ones (`react`, `react-dom`, `@tanstack/react-query`, `@tanstack/react-router`, `@fontsource-variable/inter`, `@fontsource-variable/geist-mono`) and the build-time `drizzle-typebox`. None of the eight is reachable from either published entry point (`bin/brunch.js` or `main`); the React and TanStack code ships inlined in the prebuilt `dist-web` Vite bundle and the fonts ship as `.woff2` assets beside it.
- The package `files` list excludes `dist/probes` and the unbundled `dist/web` tree. Probe scripts still build locally, while the shipped browser application remains the self-contained `dist-web` bundle.
- Executor internals consolidate: the two inert execute-plan artifact tools and their report writers are removed, the execute-tool authority map is type-coupled to the `tool-names.ts` roster union so roster drift becomes a compile error, and the duplicated path-existence predicate collapses to one executor-owned helper.
