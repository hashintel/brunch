# Method: explore and characterize

Use this acquisition mode when the session needs an initial map of a brownfield codebase, product area, or unfamiliar territory before precise graph claims can be made. Exploration is bounded reconnaissance by the foreground elicitor using legal read tools; delegated subagents are a future seam and not required here.

## Use when

- The situating gap or user says this is a brownfield codebase or existing system.
- The user asks Brunch to understand an area before asking detailed questions.
- The current gap cannot be answered until you know the shape of files, docs, routes, APIs, or tests.
- A digest of the territory would let the capture sweep produce grounded graph truth or better gaps.

## Conduct

Start with the smallest useful reconnaissance: list or search only the named area, read nearby README or topology notes first, then inspect a few files that answer the current orientation question. Keep exploration bounded by the user's stated area and the current gap. Use `web_search` / `web_fetch` only for external references that are actually needed; local brownfield reading should prefer local read/search tools.

After exploring, write an assistant-authored characterization digest in the transcript. The digest is the handoff artifact to capture: it should name the area inspected, the observed topology, high-confidence facts, and open uncertainties. The capture sweep then commits high-confidence material or spawns gaps. Raw file listings, search hits, and tool outputs stay background.

```pseudo
chain explore-and-characterize:
  brownfield orientation need
    -> bounded local/web reads
    -> assistant characterization digest
    -> capture sweep over digest
    -> next question from updated graph + gaps
```

## Digest shape

- Scope: paths, docs, or external pages inspected.
- Topology: main modules, owners, interfaces, and direction of dependency when visible.
- Grounded claims: facts safe enough to become graph truth if useful.
- Open risks: missing readers, ambiguous ownership, stale docs, contradictions, or claims needing human confirmation.
- Next acquisition mode: ask a question, ingest a paste, read a named document, or continue bounded exploration.

## Anti-goals

- Do not crawl the whole repository for symmetry or completeness.
- Do not revive observer/auditor queues or product extraction passes.
- Do not treat speculation about intent as graph truth.
- Do not use subagents in this slice; delegated acquisition is the separate `subagent-adoption` frontier.
