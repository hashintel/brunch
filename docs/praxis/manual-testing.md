# Manual Testing Protocol

Outer-loop verification for slices that touch the user-facing boundary. Manual testing is irreplaceable for qualitative judgment — UX feel, content quality, flow coherence.

## Setup

1. **Dev server**: use `/cli-cmux` to open a terminal pane, run `npm run dev` there. Do NOT use cmux for browser panes.
2. **Browser**: use `/cli-cdp` to launch Chrome with DevTools Protocol, open the dev URL, and interact (snapshot, fill, click, eval, console).

This keeps the dev server and browser observable without leaving the agent session.

## Fixture capture

After a confirmed-good manual session, materialize golden master fixtures by querying the database:

1. Run an interview session manually, inspecting observer output via debug mode.
2. Confirm the extracted entities look correct.
3. Capture the active path into the trusted manifest seam with `captureProjectToManifestScenario(...)` in `src/server/fixtures/corpus.ts` instead of ad hoc SQL copying.
4. Promote the normalized scenario into `curatedGoldenCorpus` in `src/server/fixtures/corpus.ts`, keeping the provenance note with the entry.
5. Re-run the observer corpus probes so the promoted capture proves the same fixture and probe path the repo already trusts.

This keeps golden fixtures runtime-shaped without hand-authoring JSON or redoing manual SQL extraction every time. See SPEC.md §Oracle Strategy for how fixtures feed into the verification tiers.

## What to check

Each slice's scope card names its outer-loop verification needs. Common checks:

- **Rendering correctness**: do components render the right state? (tool calls, reasoning, turn cards)
- **Interview quality**: are structured questions well-formed with options, grounding, and impact?
- **Observer visibility**: does debug mode show extraction results per-turn?
- **Resume**: close browser, reopen — is state intact?
- **Phase transitions**: does the summary appear? Does confirmation work?
