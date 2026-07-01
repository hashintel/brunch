<specification>
Overview:
- id: 1
- title: Alpha Grounding

Graph (LSN 2): 5 nodes, 3 edges

legend: G=goal, TH=thesis, T=term, CTX=context, CON=constraint

nodes — intent · grounding (2)
| code | id | title |
| - | - | - |
| G1 | 1 | Help a user orient inside one workspace |
| TH1 | 5 | Orientation comes from the selected spec's graph state, not the whole workspace at once |

nodes — intent · elicitation (2)
| code | id | title |
| - | - | - |
| CTX1 | 2 | A workspace may hold multiple specs |
| CON1 | 3 | Selection must stay scoped to the chosen spec |

nodes — intent · unbanded (1)
| code | id | title |
| - | - | - |
| T1 | 4 | Selected spec |

edges (sorted by upstream)
| id | upstream | relation | downstream |
| - | - | - | - |
| 2 | CON1 | bounds | G1 |
| 1 | G1 | motivated by | CTX1 |
| 3 | G1 | motivated by | TH1 |

Graph facts:
- lsn: 2
- node counts by kind: constraint=1, context=1, goal=1, term=1, thesis=1
- zero-count kinds: story (band=none), unknown (band=elicitation), requirement (band=projection), assumption (band=elicitation), invariant (band=elicitation), decision (band=elicitation), criterion (band=commitment), example (band=none), check (band=projection), vv_method (band=projection), evidence (band=projection), vv_obligation (band=projection), module (band=projection), interface (band=projection), entity (band=projection), sketch (band=none), milestone (band=commitment), frontier (band=commitment), slice (band=commitment)

ELICITATION SCRATCHPAD (empty)

Sessions:
| name | file | turns |
| - | - | - |
| — | alpha-session.jsonl | 2 |
</specification>