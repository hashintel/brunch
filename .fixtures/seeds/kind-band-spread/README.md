# `.fixtures/seeds/kind-band-spread/`

Hand-authored coverage fixture for renderer development.

Purpose:

- provide one explicit-basis node of every currently shipped graph kind
- guarantee all three readiness bands appear in one deterministic seed
- give graph-slice renderers a compact, legal seed that is not tied to any one real spec archive

Contents:

- `coverage-matrix.json` — one spec whose nodes cover every intent/oracle/design/plan kind

The fixture is intentionally small and hand-curated. It exists to exercise projection and rendering breadth, not to mirror a realistic spec narrative.
