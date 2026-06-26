# agents/docs/ — backstage agent-resource curation notes

SPEC decisions: D52-L, D85-L, D97-L, D98-L

## Owns

`src/agents/docs/` owns backstage notes for curating Brunch-authored agent resources: recovery inventories, source-analysis notes, and judgment-layer drafting material that should inform prompt resources or context references but should not itself be loaded as runtime prompt payload.

It is not a prompt-resource directory, not scanned by the Agent Skills loader, and not copied into packaged runtime assets.

## Boundary rules

```pseudo
rules:
  agents/docs/ -> agents/skills/, agents/contexts/references/ [curation input only]
  agents/docs/ x> runtime resource loading                      [not prompt payload]
  agents/docs/ x> graph mutation                                [notes only]
```

Runtime-eligible shared references live in `src/agents/contexts/references/`. Skill-local progressive-disclosure payloads live under the owning skill's `references/` directory. This directory is only the backstage curation workspace for deciding what belongs in those homes.
