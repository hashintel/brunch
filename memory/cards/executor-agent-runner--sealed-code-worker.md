# executor-agent-runner — sealed CODE worker tracer slice

## Orientation

- Containing seam: `orchestrator-cutover` real-execution substrate; FE-1111 now has the `AgentRunnerPort` contract and Pi injection path, but the default app-layer runner still fails closed.
- Frontier item: `executor-agent-runner` (FE-1111) on `ka/fe-1111-executor-agent-runner`, stacked on `ka/fe-1109-cook-sandbox`.
- Handoff state: no `HANDOFF.md` present; the built port slice proved `execute_agent_result` no longer reads prewritten `result.json` and failure does not advance metadata.
- Main open risk: the real worker needs Pi execution context plus write capability without reopening ambient `~/.pi`, parent conversation, or unrestricted shell/write access.

## Scope Weight

Full scope card. This slice implements the first real write-capable worker over the sealed subagent substrate and may refine the `AgentRunnerPort` args to carry Pi model context.

## Target Behavior

`execute_agent_result` can launch a sealed CODE worker that writes a real sandbox-worktree change for the active slice.

## Boundary Crossings

```text
execute_agent_result Pi tool
→ AgentRunnerPort args carrying run/worktree/request/result paths plus Pi model context
→ src/app/agent-runner-port.ts concrete runner
→ src/.pi/extensions/subagents sealed child-session runner/catalog
→ src/agents/subagents/worker.md body/frontmatter
→ sandbox worktree file diff
```

## Risks and Assumptions

- RISK: write-capable subagent grants accidentally expose ambient filesystem or shell authority. → MITIGATION: add only a bounded Brunch-owned worktree write/edit tool to the subagent catalog; do not grant shell in this slice.
- RISK: the app-layer runner cannot build a child session from the port args because model/modelRegistry/signal currently live in the Pi tool execution context, not the core run metadata. → MITIGATION: thread only the required Pi execution context through `execute_agent_result` into `AgentRunnerPort.run`; keep executor core unaware of SDK implementation types where possible and isolate SDK-specific types to the Pi/app boundary if needed.
- RISK: a live model run is too expensive/flaky for the inner loop. → MITIGATION: prove the worker through the existing injectable child-session/faux-provider path, with a deterministic fake child that calls the bounded write tool and returns a summary; leave real-provider/manual evidence for a later witness if needed.
- ASSUMPTION: a single bounded write/edit tool is enough to prove real sandbox diffs before adding shell or richer patch application. → VALIDATE: focused test observes an actual file change under the worktree after `execute_agent_result`.

## Acceptance Criteria

✓ `src/.pi/extensions/subagents/__tests__/agents.test.ts` or adjacent subagent tests — a `worker` background definition is registry-owned, validates frontmatter, and is not spawnable by SPEC/elicitor delegation.

✓ `src/.pi/extensions/subagents/__tests__/agents.test.ts` or adjacent subagent tests — the worker grant resolves only bounded worktree read/write tools needed for this tracer and does not include shell, ambient discovery, graph mutation, or `subagent` nesting.

✓ `src/app/__tests__/agent-runner-port.test.ts` — the concrete app-layer `AgentRunnerPort` launches the sealed worker over the requested worktree and produces an actual file change under that worktree using a deterministic fake child-session path.

✓ `src/.pi/extensions/__tests__/registry.test.ts` — `execute_agent_result` threads the required Pi model context/signal into the injected runner while preserving the existing metadata/report transition and failure posture.

✓ `src/executor/agent-result.ts` / architecture checks — executor core remains free of `src/app`, `.pi`, SDK, git, subprocess, and shell implementation imports.

## Verification Approach

- Inner: focused Vitest tests for subagent definition/catalog grants, app-layer runner contract, and Pi registry context threading.
- Middle: `npm run fix` after edits.
- Gate: `npm run verify` before commit.

## Promotion Checklist

- [x] Does this change a requirement? It materializes FE-1111's real change-producing worker layer.
- [x] Does this create, retire, or invalidate an assumption? It validates whether bounded write/edit authority is enough before shell.
- [x] Does this make or reverse a non-trivial design decision? It chooses a bounded worktree write/edit tracer rather than immediate shell authority.
- [x] Does this establish a new seam-level invariant? Worker write authority is catalog-bounded and op-mode/delegation-gated, not ambient.
- [x] Does it cross more than two major seams?
- [ ] Is this the first touch in an unfamiliar seam from a fresh thread?
- [ ] Can you not name the containing seam or current rationale from the live docs?

## Recommended Next Route

Build it with `ln-build`.
