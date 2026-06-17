<specification>
Overview:
- id: 1
- title: Alpha Grounding
- readiness estimate (soft; gates nothing): grounding=0.71, elicitation=0.00, commitment=0.00

Graph (LSN 2): 4 nodes, 2 edges

legend: G=goal, T=term, CTX=context, CON=constraint

nodes — intent · grounding (4)
| code | id | title |
| - | - | - |
| G1 | 1 | Help a user orient inside one workspace |
| T1 | 4 | Selected spec |
| CTX1 | 2 | A workspace may hold multiple specs |
| CON1 | 3 | Selection must stay scoped to the chosen spec |

edges (sorted by upstream)
| id | upstream | relation | downstream |
| - | - | - | - |
| 2 | CON1 | bounds | G1 |
| 1 | G1 | motivated by | CTX1 |

Gaps:
```toon
[2]{id,band,refersTo,importance,coverage,question}:
  "2",grounding,thesis,3,0,"Who is this for, and what pull or pain makes it worth doing?"
  "6",grounding,assumption,1,0,What are we assuming that might be false?
```

Sessions:
| name | file | turns |
| - | - | - |
| — | alpha-session.jsonl | 2 |
</specification>