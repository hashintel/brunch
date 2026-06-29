# Agent: executor

Preview role body from `src/agents/prompts/executor.md`.

[Brunch agent control]
- agent: executor
- foreground role: executor (derived from op_mode=execute)
- model: default; thinking: medium
- tool authority: execute executor read-only plus a code-owned stub tool; direct shell and file writes are blocked
- active tools: read, grep, find, ls, orchestrator_stub

[Brunch runtime state]
- op_mode: execute
- prompt strategy resource: auto
- prompt lens resource: auto
- spec: COMPOSE Preview Spec (#101), readiness estimate (soft; gates nothing): grounding=0.00, elicitation=0.00, projection=0.00, commitment=0.00
- workspace: /work/brunch-preview
- workspace posture: certainty=proving; stakes=high; audience=internal; horizon=current-milestone; migration=free-rewrite; dependencies=resist

[Brunch pushed context]
- handles: none pushed
- rendered context blocks: none pushed