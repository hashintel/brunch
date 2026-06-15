Graph overview (LSN 2): 20 nodes, 7 edges

legend: G=goal, TH=thesis, T=term, CTX=context, REQ=requirement, A=assumption, CON=constraint, INV=invariant, D=decision, AC=criterion, EX=example, CH=check, VV=validation_method, E=evidence, O=obligation, MOD=module, API=interface, M=milestone, F=frontier, S=slice

nodes — intent · grounding (5)
| code | id | title |
| - | - | - |
| G1 | 1 | Anchor the product problem |
| TH1 | 2 | A graph-native workspace can hold evolving specification truth |
| T1 | 3 | Workspace |
| CTX1 | 4 | The POC favors deterministic local fixtures over ambient state |
| CON1 | 6 | Preview harnesses must not bypass the command layer |

nodes — intent · elicitation (4)
| code | id | title |
| - | - | - |
| A1 | 5 | Seed fixtures should stay small enough to eyeball |
| INV1 | 11 | Rendered edges should not leak raw database ids |
| D1 | 9 | Golden files co-locate with renderer tests |
| EX1 | 10 | A neighborhood preview for R1 is human-reviewable |

nodes — intent · commitment (2)
| code | id | title |
| - | - | - |
| REQ1 | 7 | Renderers should emit stable graph-node codes |
| AC1 | 8 | A preview can be locked as a diffable golden file |

nodes — oracle · elicitation (2)
| code | id | title |
| - | - | - |
| VV1 | 12 | Seed fixture smoke test |
| O1 | 15 | Keep preview artifacts readable in PR diffs |

nodes — oracle · commitment (2)
| code | id | title |
| - | - | - |
| CH1 | 13 | Verify every set loads through seedFixture |
| E1 | 14 | Render preview writes a stable markdown file |

nodes — design · elicitation (2)
| code | id | title |
| - | - | - |
| MOD1 | 16 | Graph preview harness |
| API1 | 17 | render-preview CLI |

nodes — plan · commitment (3)
| code | id | title |
| - | - | - |
| M1 | 18 | Cross-cut render feedback loop |
| F1 | 19 | Preview harness slice |
| S1 | 20 | Lock one neighborhood preview |

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