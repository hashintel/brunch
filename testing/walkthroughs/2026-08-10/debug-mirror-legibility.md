# Debug-mirror legibility

Date: 2026-08-10
Commit under test: `6f19cc4bedff1ee021722e5b15d7355b6c131c6f`
Host: Darwin 25.6.0 arm64
Node: v24.19.0
npm: 12.0.2

## Entry path

Used the documented deterministic faux/tier-2 loops from `src/dev/README.md` and `src/dev/TOPOLOGY.md`. Tier-2 retains the real Brunch/Pi boot, session construction, extension registration, transcript wiring, and origination choreography while substituting auth/model/provider services. This did not launch a provider campaign.

```sh
npm test -- src/.pi/extensions/__tests__/dev-mode-introspection.test.ts \
  src/dev/__tests__/tier-2-harness.test.ts \
  src/session/__tests__/transcript-markdown.test.ts \
  src/dev/__tests__/trajectory-report.test.ts
```

Result: 4 test files passed; 44 tests passed; duration 3.86s.

## Mirror inventory and canonical comparison

The inventory is the documented `<workspace>/.brunch/debug/` tree in `src/dev/README.md`. A mirror is not required before its documented trigger.

| Mirror | Operator question | Deterministic evidence and canonical comparison | Disposition |
| --- | --- | --- | --- |
| `entry-contents.md` | Which Brunch-owned custom entries/messages were appended at the source seam, even before a provider call? | `tier-2-harness.test.ts` — “a seeded-but-unkicked session…” produces the mirror with zero provider calls and matches the real session's `brunch.context_seed` content (`Context seeded for spec`, `ELICITATION SCRATCHPAD`). “mirrors the wired manual-trigger continuation…” additionally matches `brunch.context_seed` and `Boot seam` from the boot session. | Produced; legible; agrees with canonical session entries. |
| `origination.md` | Why did Brunch start, continue, idle, or skip an assistant turn, and what was its outcome? | `tier-2-harness.test.ts` — “records the origination decision and outcome…” compares mirror records with the real boot outcomes for new-session fired, resume-debt fired, idle/no-debt, and no-model skipped. The manual-trigger test proves decision-before-outcome ordering and `status=fired` while the provider boundary is held. | Produced; legible; agrees with runtime origination state/order. |
| `system-prompt.md` | What exact final system prompt crossed the provider boundary most recently? | `dev-mode-introspection.test.ts` — “mirrors the latest captured final system prompt…” emits two provider-request events and asserts the file is exactly `second final prompt`; “captures the post-mutation payload…” proves capture occurs after provider mutators. | Produced; legible; byte-agrees with the final provider payload. |
| `tool-contents.md` | What explicit Brunch-owned text tool-result content was returned? | `dev-mode-introspection.test.ts` — “appends only explicit Brunch-owned text tool results…” emits `read_graph`, built-in `read`, and `brunch_session_query` events, then asserts the mirror is exactly the two allowlisted Brunch results in event order and excludes the built-in result. | Produced; legible; byte-agrees with allowed runtime tool-result events. |
| `trajectory.ndjson` | What bounded normalized provider/read/message events were observed, in order? | `trajectory-report.test.ts` — “projects an advertised production resource read…” records provider requests, a real skill resource read, and message end; reads the persisted NDJSON back through its runtime validator; then joins it to the Pi session file. Introspection tests also prove event ordering, correlation-gap persistence, and provider-secret stripping. | Produced; parseable; agrees with recorder events and canonical active Pi branch. |
| `trajectory.json` | What machine-readable joined attribution follows from trajectory events plus the active Pi branch? | `trajectory-report.test.ts` projects the persisted NDJSON together with `SessionManager.getSessionFile()` and runtime-validates the landed report shape; the production-resource case matches the advertised/read/provider-visible resource and the canonical assistant transcript effect. | Produced by the supported joiner path; agrees with normalized events and active-branch JSONL. |
| `trajectory-report.md` | What human-readable attribution can an operator inspect for the same joined run? | The same trajectory-report suite exercises the latest-wins report writer and verifies directive states/transcript effects are derived only from the active Pi branch, with loud failure on missing or ambiguous event correlation. The Markdown and JSON are sibling projections of one validated report object. | Produced by the supported joiner path; agrees with `trajectory.json`, NDJSON, and active-branch JSONL. |
| `transcript.md` | What text-visible transcript does the faux/tier-2 debug loop render from Pi history? | `transcript-markdown.test.ts` — “renders projected transcript messages…” formats a `ProjectedTranscriptContext`, preserving user/assistant/tool-result text and excluding private thinking; malformed JSONL is rejected at its physical line. `tier-2-harness.test.ts` also asserts the real boot loop returns the debug transcript path after driving a faux-provider turn and inspecting session entries. | Supported harness-only optional mirror; legible and derived from Pi JSONL projection. Its absence in an ordinary TUI launch is explicitly accepted by `src/dev/README.md`. |

Documented trigger-qualified absence remains acceptable for `system-prompt.md` before a provider request, `tool-contents.md` before an allowlisted Brunch text result, and `transcript.md` outside faux/tier-2 harness loops. No other documented mirror was treated as optional.

## Authority and scope

All inspected files are passive/latest-wins projections. The tests derive comparisons from the provider payload, runtime events, `SessionManager` active branch/session JSONL, or `ProjectedTranscriptContext`; no test reads a debug mirror back as product state. This row does not claim seed, TUI lifecycle, RPC, or product-interaction closure.

## Cleanup and protected state

The focused suites generated only test-temporary `brunch-introspection-*`, `brunch-trajectory-*`, and `brunch-production-trajectory-*` directories under the host temporary directory. Their exact paths were removed after capture; a bounded repeat search returned no matching recent directories. No `.brunch/debug/**` or `.fixtures/scratch/**` state remains in the repository. Pre-existing ignored `.fixtures/workbenches/workspace-alpha-grounding/.brunch/brunch-v1.db` was observed and left untouched.

Protected paths after the run:

- `.pi/settings.json` content SHA-256: `9a88610ff5725c86759f4163e824cd50ca473101ea43b49fe16ec671347ad028`
- `.pi/settings.json` diff SHA-256: `08a0d881461dde5840c1671f89705b6f51437e6544c110ac65c5061257e08045`
- `src/dev/__tests__/interactive-shell-config.test.ts` SHA-256: `a6bf0354bf2443f74b1bba6bba729d9a8893e4e61e0f55e9e5a832e82d6a1bc9`
