# Manual Testing Protocol

Outer-loop verification for slices that touch the user-facing boundary. Manual testing is irreplaceable for qualitative judgment — UX feel, content quality, flow coherence.

## Setup

1. **Dev server**: use `/cli-cmux` to open a terminal pane, run `npm run dev` there. Do NOT use cmux for browser panes.
2. **Browser**: use `/cli-cdp` to launch Chrome with DevTools Protocol, open the dev URL, and interact (snapshot, fill, click, eval, console).

This keeps the dev server and browser observable without leaving the agent session.

## Fixture Walkthrough Workflow

Use this as the default end-to-end loop when you want to repeatedly manual-test seeded states.

### Important DB-path note

- `npm run seed` now defaults to the same project-local database as the app runtime: `.brunch/brunch.db`
- `npm run dev` also defaults to that resolved project-local database
- `npm run studio` defaults to `.brunch/brunch.db` too

Only use `BRUNCH_DB` or an explicit seed path when you intentionally want an alternate scratch database.

### Recommended repeatable workflow

Use the project-local default unless you intentionally want a separate scratch DB:

```bash
# 1. Remove any previous seeded state
mkdir -p .brunch
rm -f .brunch/brunch.db .brunch/brunch.db-shm .brunch/brunch.db-wal

# 2. Inspect the available walkthrough fixtures if needed
npm run seed

# 3. Seed the scenario you want to inspect
npm run seed issue-tracker-design-active

# 4. Launch the app against the same database
npm run dev
```

Then:

1. Open `http://localhost:5173`.
2. Confirm the seeded project appears in the dashboard.
3. Walk through the specific state you seeded.
4. To test resume, close the browser tab, reopen the app, and confirm the same project state is still present.
5. To switch scenarios, stop the dev server, re-run the wipe + seed steps, then launch `npm run dev` again.

### If you want to use an alternate scratch DB instead

This is useful when you want to keep walkthrough state separate from the project-local default:

```bash
export BRUNCH_DB=./tmp/manual-testing.db
rm -f "$BRUNCH_DB" "$BRUNCH_DB-shm" "$BRUNCH_DB-wal"
npm run seed issue-tracker-design-active "$BRUNCH_DB"
npm run dev
```

### Choosing a scenario

Start with these:

- `issue-tracker-kickoff-ready` — blank kickoff workspace
- `issue-tracker-design-active` — in-flight transcript state
- `issue-tracker-criteria-ready` — review-phase workspace before export
- `issue-tracker-all-phases-closed` — completed export-ready project
- `forced-close-all-phases-closed` — export caveat for user-forced closure
- `low-readiness-all-phases-closed` — export caveat for low-readiness closure

## Fixture capture

After a confirmed-good manual session, materialize golden master fixtures by querying the database:

1. Run an interview session manually, inspecting observer output via debug mode.
2. Confirm the extracted entities look correct.
3. Capture the active path into the trusted manifest seam with `captureProjectToManifestScenario(...)` in `src/server/fixtures/corpus.ts` instead of ad hoc SQL copying.
4. Promote the normalized scenario into `curatedGoldenCorpus` in `src/server/fixtures/corpus.ts`, keeping the provenance note with the entry.
5. Re-run the observer corpus probes so the promoted capture proves the same fixture and probe path the repo already trusts.

This keeps golden fixtures runtime-shaped without hand-authoring JSON or redoing manual SQL extraction every time. See SPEC.md §Oracle Strategy for how fixtures feed into the verification tiers.

## Recommended walkthrough seeds

Prefer the richer `issue-tracker-*` fixtures for manual walkthroughs. They are trusted manifest-backed scenarios, not ad hoc SQL snapshots.

- `issue-tracker-kickoff-ready` — empty kickoff workspace and resume from a seeded blank project
- `issue-tracker-scope-closed` — scope summary/confirmation artifacts and first design-ready handoff
- `issue-tracker-design-active` — in-flight design transcript state
- `issue-tracker-requirements-ready` — requirements closure artifacts and criteria handoff workspace
- `issue-tracker-criteria-ready` — criteria review-ready workspace
- `issue-tracker-all-phases-closed` — export-ready completed project
- `forced-close-all-phases-closed` — synthetic caveat fixture for user-forced design closure
- `low-readiness-all-phases-closed` — synthetic caveat fixture for low-readiness scope closure

## What to check

Each slice's scope card names its outer-loop verification needs. Common checks:

- **Rendering correctness**: do components render the right state? (tool calls, reasoning, turn cards)
- **Interview quality**: are structured questions well-formed with options, grounding, and impact?
- **Observer visibility**: does debug mode show extraction results per-turn?
- **Resume**: close browser, reopen — is state intact?
- **Phase transitions**: does the summary appear? Does confirmation work?
