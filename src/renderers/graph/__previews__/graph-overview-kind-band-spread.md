Graph overview (LSN 2): 24 nodes, 7 edges

legend: G=goal, TH=thesis, T=term, CTX=context, ST=story, UNK=unknown, REQ=requirement, A=assumption, CON=constraint, INV=invariant, D=decision, AC=criterion, EX=example, CH=check, VV=vv_method, E=evidence, O=vv_obligation, MOD=module, API=interface, ENT=entity, SKT=sketch, M=milestone, F=frontier, S=slice

nodes — intent · grounding (5)
| code | id | title |
| - | - | - |
| G1 | 1 | Anchor the product problem |
| TH1 | 2 | A graph-native workspace can hold evolving specification truth |
| T1 | 3 | Workspace |
| CTX1 | 4 | The POC favors deterministic local fixtures over ambient state |
| CON1 | 8 | Preview harnesses must not bypass the command layer |

nodes — intent · elicitation (6)
| code | id | title |
| - | - | - |
| ST1 | 5 | A preview story groups renderer-facing checks |
| UNK1 | 6 | The renderer audience's next preferred grouping is unknown |
| A1 | 7 | Seed fixtures should stay small enough to eyeball |
| INV1 | 13 | Rendered edges should not leak raw database ids |
| D1 | 11 | Golden files co-locate with renderer tests |
| EX1 | 12 | A neighborhood preview for R1 is human-reviewable |

nodes — intent · commitment (2)
| code | id | title |
| - | - | - |
| REQ1 | 9 | Renderers should emit stable graph-node codes |
| AC1 | 10 | A preview can be locked as a diffable golden file |

nodes — oracle · elicitation (2)
| code | id | title |
| - | - | - |
| VV1 | 14 | Seed fixture smoke test |
| O1 | 17 | Keep preview artifacts readable in PR diffs |

nodes — oracle · commitment (2)
| code | id | title |
| - | - | - |
| CH1 | 15 | Verify every set loads through seedFixture |
| E1 | 16 | Render preview writes a stable markdown file |

nodes — design · elicitation (4)
| code | id | title |
| - | - | - |
| MOD1 | 18 | Graph preview harness |
| API1 | 19 | render-preview CLI |
| ENT1 | 20 | Preview fixture record |
| SKT1 | 21 | Renderer output sketch |

nodes — plan · commitment (3)
| code | id | title |
| - | - | - |
| M1 | 22 | Cross-cut render feedback loop |
| F1 | 23 | Preview harness slice |
| S1 | 24 | Lock one neighborhood preview |

edges (sorted by upstream)
| id | upstream | relation | downstream |
| - | - | - | - |
| 5 | AC1 | witnessed by | E1 |
| 2 | CON1 | bounds | MOD1 |
| 6 | F1 | part of | M1 |
| 4 | MOD1 | realized by | REQ1 |
| 1 | REQ1 | motivated by | G1 |
| 3 | REQ1 | required by | AC1 |
| 7 | S1 | part of | F1 |