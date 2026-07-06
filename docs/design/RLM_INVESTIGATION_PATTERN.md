# RLM investigation pattern — evaluation note

Status: captured idea, not scheduled. Candidate mechanism for the acquisition-subagent arm (SPEC A34-L), evaluated 2026-07-06 against Isaac Flath's RLM writeup (<http://isaacflath.com/writing/rlm>; paper: arxiv 2512.24601, Zhang/Kraska/Khattab).

## The pattern, in Brunch terms

A blocking tool call runs an isolated investigation loop: an investigator LLM writes code into a persistent REPL namespace across turns; builtins in the namespace fan work out to a cheaper analyst model (`llm_query`, batched), re-query a corpus, and recurse (`rlm_query`, downgrading to plain calls at the depth limit); a `FINAL()` answer is the only content that returns to the caller. Budget is shared across the call tree; models differ by depth.

Brunch already owns the seam this would occupy: the sealed SDK child-session `subagent` tool (D44-L/D91-L/D92-L) with semaphore-bounded fan-out, per-child model resolution, and last-assistant-message-only handback into the `present_digest` review flow (D82-L, D110-L). What Brunch lacks and the RLM adds: **persistent manipulable state across the child's own turns** (search results become variables to sort/slice/fan out over) and **recursive delegation**.

## Verdict at evaluation time

Not suitable for adoption now. Reasons, in force order:

1. **No current problem at this scale.** Brunch's canonical data is a small structured SQLite graph with typed readers, not a large fuzzy corpus. The only RLM-shaped workload is acquisition (brownfield explore-and-characterize, referenced-document research), and A34-L is open precisely because evidence that flat subagent delegation is insufficient does not exist yet.
2. **Unsandboxed model-authored code execution** conflicts with the sealed-profile (D39-L) and authority-matrix (D40-L) posture. Children deliberately lack `bash`/nesting; an open `exec` namespace is a categorically different trust posture requiring a sandbox decision first.
3. **Runtime dependency.** The reference implementation's REPL host is a Python subprocess; Brunch must stay a single installable CLI.

## Adoption path, if A34-L evidence demands it

- **Seam stays put:** implement behind the existing `subagent` tool; digest handback and review vocabulary unchanged. No new exchange kinds or SPEC contract.
- **TypeScript/JavaScript runtime, not Python** (user direction, 2026-07-06): the investigation REPL should be a JS isolate with a persistent evaluation context — Cloudflare-style lightweight sandboxing is the reference point. Candidates to spike, in rough preference order: `workerd`/workers-runtime locally; an embedded isolate (`isolated-vm`, QuickJS via WASM — e.g. `quickjs-emscripten` — which is itself sandboxed by construction); `node:vm` only as a non-security-boundary fallback. The namespace builtins (`graph_read`, `llm_query`, `llm_query_batched`, recursion, `FINAL`) become host functions injected into the isolate — in-process SDK calls, so the reference implementation's two-channel pipe RPC evaporates.
- **Budget/model tiering** maps onto existing `resolveSubagentModel` + `config.json` concurrency; a shared cross-tree spend budget is new and small.
- **Recursion** must carry an explicit depth bound and downgrade-to-plain-call behavior, mirroring the reference design; Brunch children currently cannot recurse by construction, so this is a deliberate widening, not a default.

## Steal independently of the REPL

- **Trace discipline:** one NDJSON event line per investigator turn / code block / host-function call / final answer, convertible to a *live, re-executable* artifact. Aligns with Brunch's probe/fixture discipline (A5-L, `.fixtures/runs/` promotion) and the subagent extension's deferred progress-UI item. The wider Pi-event tracing design this feeds into is captured in [AGENT_TRACING.md](AGENT_TRACING.md).
- **Model tiering by depth** (smart investigator, cheap analysts) is already expressible via subagent frontmatter `model:`; formalizing a cheap-analyst default for fan-out children is config, not architecture.

## Triggers to revisit

- A34-L validation shows one-shot child prompts can't characterize large brownfield sources acceptably (digest quality or context blowout observed on live walkthroughs).
- An execute-mode workload needs stateful multi-turn investigation over a real repo at a scale where grep-shaped exploration demonstrably thrashes.

Until a trigger fires, this note is the entire commitment.
