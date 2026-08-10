# Populated-workspace posture entry

Date: 2026-08-10

Commit under test: `d5cad33dd` (`FE-1348: Validate authless bare workspace entry`)

Branch: `ln/fe-1348-validate-current-brunch-usage-and-testing-paths`

Driver session: `fe1348-populated-posture-r1` (120 × 40)

Workspace: `.fixtures/scratch/fe1348-populated-posture-r1`

Pi profile: `.fixtures/scratch/fe1348-populated-posture-pi-r1`

## Initial populated-state proof

The fresh named workbench was genuinely populated before launch with ordinary project files and no Brunch state:

```text
README.md       05b1471ed1f16082dec1897e9fa19c9b9adf888bb7710582d9b8f46acc0a8a27
package.json    e6de16b1736dc314f71746fcec1de0a08524a73399fa55fee73f9cc44939dc46
src/existing.ts f6553942c4ca8a63531e8947cf74beb5b64c32b8b5ad440134f762ec09fe21fb
BRUNCH_STATE_BEFORE=absent
```

`package.json` named the existing project `existing-populated-project`; no seed, fixture, `.brunch/`, database, workspace JSON, or transcript was copied into it. The three source hashes were unchanged after the walkthrough.

## Isolated no-provider ordering

The parent harness had four provider API variables. Before launching the source TUI, the child environment explicitly removed `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, `OPENAI_API_KEY`, `OPENROUTER_API_KEY`, `GOOGLE_API_KEY`, `GROQ_API_KEY`, and `XAI_API_KEY`, and set `PI_CODING_AGENT_DIR` to the fresh isolated profile. Its `auth.json` parsed as `{}` with zero keys (final SHA-256 `ca3d163bab055381827226140568f3bef7eaac187cebd76878e0b63e9e442356`).

```sh
env -u ANTHROPIC_API_KEY -u GEMINI_API_KEY -u OPENAI_API_KEY \
  -u OPENROUTER_API_KEY -u GOOGLE_API_KEY -u GROQ_API_KEY -u XAI_API_KEY \
  PI_CODING_AGENT_DIR="$P" \
  npm run tui-driver -- start --name fe1348-populated-posture-r1 --cols 120 --rows 40 -- \
  npm run dev-cli -- --workspace "$W" --no-webui
```

The real dialog rendered and completed all posture stages before the product reached the no-provider warning. Thus no assistant turn could establish or obscure posture.

## Exact dialog choices

Through the real source TUI:

1. At `Choose a specification`, select `Start a new specification`.
2. Enter title `Populated Posture Proof`.
3. At `What does this specification own?`, select `Feature — owns a part of this codebase`.
4. At `Does this build on the existing code here?`, accept `Yes — this is brownfield`.

Only after the terminal posture choice did the product activate the session and report:

```text
Warning: No provider auth is available, so Brunch did not start an assistant turn. Run /login, then try
/brunch:continue again.
```

The footer showed `model no model | thinking off | context ?%`.

## Canonical readback

After normal TUI shutdown, the public source stdio `workspace.state` read returned:

```json
{
  "status": "ready",
  "spec": {
    "id": 1,
    "title": "Populated Posture Proof",
    "kind": "feature",
    "origin": "brownfield",
    "relatesToSpecId": null
  },
  "session": {
    "id": "019feb63-9bd3-7472-8c7d-20dae300dd86",
    "file": ".brunch/sessions/2026-08-10T11-16-41-555Z_019feb63-9bd3-7472-8c7d-20dae300dd86.jsonl"
  }
}
```

A read-only `better-sqlite3` query of canonical `.brunch/brunch-v1.db` independently returned:

```text
id: 1
name: Populated Posture Proof
slug: populated-posture-proof
kind: feature
origin: brownfield
relates_to_spec_id: null
```

The canonical JSONL contained only five structural entries: `session`, `brunch.session_binding`, `session_info`, `thinking_level_change`, and `brunch.agent_runtime_state`. It contained no user or assistant message.

## Authority analysis

The product dialog—not an agent, seed, prompt, or inferred database rewrite—collected the explicit `feature` and `brownfield` choices before activation. The public projection and canonical spec row agree exactly. `relatesToSpecId` / `relates_to_spec_id` remained `null`, proving that choosing feature scope and brownfield origin did not invent a relationship to another spec or any unsupported ownership authority. The unchanged pre-existing files show Brunch persisted posture only in its cwd-scoped canonical state.

## Cleanup and protected-state proof

The row stopped and removed its named driver session; `npm run tui-driver -- list` returned `no sessions`. It removed only the fresh row-owned workspace and Pi profile. All three paths were absent:

```text
.fixtures/scratch/fe1348-populated-posture-r1
.fixtures/scratch/fe1348-populated-posture-pi-r1
.fixtures/scratch/tui-driver/fe1348-populated-posture-r1
```

Protected paths remained unchanged:

```text
9a88610ff5725c86759f4163e824cd50ca473101ea43b49fe16ec671347ad028  .pi/settings.json
a6bf0354bf2443f74b1bba6bba729d9a8893e4e61e0f55e9e5a832e82d6a1bc9  src/dev/__tests__/interactive-shell-config.test.ts
08a0d881461dde5840c1671f89705b6f51437e6544c110ac65c5061257e08045  git diff -- .pi/settings.json
```

No fixture, seed, promoted run, production source, config, package, tooling file, or other sweep row was changed.
