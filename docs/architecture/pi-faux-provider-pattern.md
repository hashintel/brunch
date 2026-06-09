### re faux — what it's good for, and how pi uses it

The cleanest evidence is that pi's *own* test suite is exactly this pattern. Look at `packages/coding-agent/test/suite/` — every file boots a faux-provider `AgentSession` (their `harness.ts`, which is the thing our `createBrunchFauxHarness` is modeled on) and asserts on behavior. The categories map directly onto what you'd want to prove about the Brunch wrapper:

```matrix
| pi suite file (faux-driven)              | what it proves                          | Brunch analogue you'd write             |
| ---------------------------------------- | --------------------------------------- | --------------------------------------- |
| agent-session-prompt                     | tool-call turn, multi-tool, skill/      | does a Brunch skill command expand?     |
| template expansion, ext-command dispatch | does /brunch-* dispatch w/o a turn?     |
| agent-session-model-extension            | ext can BLOCK a tool_call, MODIFY a     | does elicit op_mode deny bash/edit?     |
| tool_result, MODIFY context msgs         | does prompt-mutator change payload?     |
| agent-session-queue                      | steering vs follow-up ordering          | does a structured-exchange queue right? |
| agent-session-retry-events               | transient retry, exhaust, non-retryable | (mostly pi's concern)                   |
| agent-session-compaction                 | manual/auto compaction, abort           | does Brunch compaction policy hold?     |
| agent-session-runtime                    | fork/resume/switch lifecycle + cancel   | session-boundary refresh, binding       |
| regressions/NNNN-*.test.ts               | one issue → one pinned behavior         | one Brunch bug → one faux regression    |
```

The faux registration hands you three assertion surfaces that make this possible:

```data-shape
FauxProviderRegistration:
  setResponses(steps) / appendResponses(steps)   # script the model's next turns
  state.callCount: number                         # how many provider calls happened
  contexts: ProviderContext[]                     # the EXACT requests that were sent
```

That last one is the quiet superpower: `contexts` is what the provider actually received, so you can assert on the system prompt, the tool JSON schemas, and your D58-L manifest *without* a real model. (The introspection tap is the runtime cousin of this same idea.)

**Concrete Brunch tests/probes worth writing this way** (Observed — all feasible today with `createBrunchFauxHarness`):

- **Tool gating:** script a `fauxToolCall("bash", …)` in elicit mode, assert it's denied — proves D40-L tool authority.
- **Prompt manifest gating:** boot with a given runtime state/grade, prompt, then inspect the captured context — assert `<available_strategies>` excludes `freestyle` under AUTO (R16).
- **Capture pipeline:** prompt with labeled user text, assert it routed through `CommandExecutor.commitGraph({ basis: explicit })`.
- **Structured-exchange ordering:** you already have this as a subprocess probe; a faux in-process version would be far cheaper.
- **Extension hooks:** assert your `before_provider_request` mutators actually transform the payload (and that introspection, registered last, sees the mutated form).

The rule of thumb: **faux for anything where "what did Brunch send / how did Brunch react to a scripted model" is the question.** Reserve real providers for "is the *content* any good."
