# agents/contexts/ — agent-visible context text

SPEC decisions: D52-L, D58-L, D60-L, D76-L, D78-L, D91-L

## Owns

`src/agents/contexts/` owns Brunch-authored text that is placed into an agent's model context outside the static prompt body/resource system.

```text
contexts/
└── seeds/          per-turn pushed context blocks and origination seed payloads
```

## Boundary rules

```pseudo
rules:
  agents/contexts/ -> graph/, session/, renderers/ [render already-read facts as agent-visible text]
  .pi/extensions/* -> agents/contexts/             [adapters gather data, then ask for text]
  session/         -> agents/contexts/             [origination choreography asks for seed payload text]
  agents/contexts/ x> .pi/                         [no Pi hook/tool registration]
```

## Migration note

Only seed context composition has moved here so far. Later refactor items move reusable agent-visible renderers and adapter-local tool-result text into this subtree.
