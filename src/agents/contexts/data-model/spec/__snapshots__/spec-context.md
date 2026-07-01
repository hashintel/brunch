<specification>
Overview:
- id: 1
- title: Alpha Grounding
- readiness estimate (soft; gates nothing): grounding=0.76, elicitation=0.00, projection=0.00, commitment=0.00

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

Gaps:
```toon
[2]{id,band,refersTo,importance,coverage,question}:
  "2",grounding,context,3,0,"Is this new-from-scratch, a brownfield codebase, or a continuation of a prior thread?"
  "7",grounding,assumption,1,0,What are we assuming that might be false?
```

Sessions:
| name | file | turns |
| - | - | - |
| — | alpha-session.jsonl | 2 |
</specification>