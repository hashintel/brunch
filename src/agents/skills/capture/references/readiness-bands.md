# Readiness bands

The current model derives a **readiness band** per kind over four bands — `grounding`, `elicitation`, `projection`, `commitment`. 

Bands guide questioning and projection; **they do not gate graph truth.** If the user states a later-band item early, capture it honestly with the right kind and basis.

| Band            | What it gathers        | Kinds (intent unless noted)                                                                                      |
| --------------- | ---------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `grounding`     | the starting frame     | `goal`, `thesis`, `context`, `constraint`                                                                        |
| `elicitation`   | the working middle     | `context`, `story`, `unknown`, `assumption`, `constraint`, `invariant`, `decision`                               |
| `projection`    | materialized structure | oracle + design plane kinds (`check`, `vv_method`, `evidence`, `vv_obligation`, `module`, `interface`, `entity`) |
| `commitment`    | hardened obligations   | `requirement`, `criterion`; plan plane (`milestone`, `frontier`, `slice`)                                        |
| `—` (band-less) | always-available       | `term`, `example`, `sketch`                                                                                      |

The conceptual shift the old doc anticipated holds: **hardening is requirements + invariants + criteria + examples**, with preservation claims and witness claims durable rather than conversational. Operationally, the runtime exposes only two modes (D98-L): **`SPEC`** runs the elicitor (the band ladder above); **`CODE`** runs the executor. The old per-phase "materialized at review acceptance" column is now the `basis` distinction (below) plus review-set acceptance.
