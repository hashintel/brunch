# `.fixtures/seeds/wisp/`

A session-derived, execution-ready product graph for **Wisp**, a branded
full-stack encrypted file-drop application.

Source: Brunch session `019faf5a-360b-73a4-acb0-e7d8b6e67f57`, exported from
the retained graph at LSN 34. The reusable seed snapshot normalizes all accepted
items to the explicit basis required by the fixture loader.

`base.json` is the canonical complete snapshot. Loading `wisp/base` includes
the whole graph; no additions, variants, or flags need to be selected
separately. Its settled state includes:

- Vite dev-server proxying for origin-relative `/drops` requests
- the Wisp product name
- a shared developer-style app shell across sender and recipient routes
- the complete crypto, backend, UI, plan, and verification graph history,
  including superseded planning history

The snapshot contains 59 nodes and 133 edges.

Validate with:

```sh
npx tsx src/graph/validate-fixture.ts wisp/base
```
