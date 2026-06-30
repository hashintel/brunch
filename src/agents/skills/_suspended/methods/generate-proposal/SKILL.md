---
name: generate-proposal
description: "Suspended legacy method. Current proposal generation conduct lives in the live propose skill."
---

# generate-proposal — suspended

Disposition: **lifted into `src/agents/skills/propose/`**.

The shared fan-out / compare / fan-in spine, `present_candidates` recognition boundary, `present_review_set` review boundary, and intent/design/oracle branch conduct now live in the activity-named `propose` home and its references.

Keep this file suspended only as a historical marker for the retired strategy/lens/method taxonomy. The live elicitor should not route here, and filesystem presence under `_suspended/` does not make this method active.

Remaining intentionally suspended residue:

- `probes.md` remains a future eval seed until the live skill family has stable probe wiring.
- Any old method-axis dispatch language is retired by D98-L.
