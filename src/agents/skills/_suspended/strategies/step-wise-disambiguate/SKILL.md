---
name: step-wise-disambiguate
description: "Suspended historical contrastive-elicitation source; not a live strategy."
---

# step-wise-disambiguate — suspended

This file is historical source material from the retired strategy axis. It is not a live prompt resource and does not authorize graph writes.

Surviving guidance was lifted into `src/agents/skills/elicit/SKILL.md`: collapse meaningful ambiguity with two or three concrete contrasts that differ on one graph-relevant axis, then use the user's answer as evidence for the next question or for a current ingest/map capture path only when the exact claim is approved.

The old `present_options` wording was retired. Current contrastive elicitation uses `present_question -> request_response` unless a future current exchange tool explicitly owns a richer option surface.
