Related nodes: 13 node(s), 13 relation(s).
Anchors: REQ1 Stage 2 configuration-space requirement (hub anchor)

upstream nodes (3) — review anchors if these change
- depends on A1: Local-only execution assumption
- expresses INV1: No network call invariant
- bounded by CON1: No cloud dependencies constraint

downstream nodes (9) — reconcile these if anchors change
- required by D1: Two-stage split decision {hard}
- implemented by MOD1: SQLite configuration store module
- realized by SCP1: Persist configuration spaces scope
- witnessed by AC1: Airplane-mode acceptance criterion
- challenged by EX1: Network-outage counterexample
- motivated by CTX1: Stakeholder offline-first preference
- opposed by CTX2: Conflicting always-connected note
- part of F1: Configuration-space data frontier
- superseded by REQ2: Revised configuration-space requirement (successor)

lateral nodes (1) — cross-check with anchors if either changes
- related to G1: Offline-first product goal