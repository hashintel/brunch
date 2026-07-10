# WR18 manual testing

## 1. O1 — No-auth behavior

![login guidance and post-login message](<CleanShot 2026-07-10 at 12.40.06@2x.png>)

ISSUES:

1. a side issue, which is that we're still seeing this notification about a conflict between the Shift+Tab keyboard shortcut and the built-in shortcut. We need to undo that design decision, and I'm not sure if that's a later item in this ledger or not?

	```
	[Extension issues]
	inline (temp) <inline:1>
		Extension shortcut 'shift+tab' from <inline:1> conflicts with built-in shortcut. Skipping.
	```
2. we're still restricted, on
	- which providers we can log in to
	- which models we can select

	All of those restrictions should be removed
3. the login warning appears on the intial startup menu. Let's remove it from here. I don't think `brunch login` as a CLI command is what we should use either 

- [x] warning and login guidance
- [x] spec/session creation remains usable;
- [x] no orientation/provider turn before auth;
- [ ] `/brunch:continue` honestly reports no model;
- [ ] no seed/kick appears in `.brunch/debug/`;
- [x] no ambient auth was used.

I didn't know where to find the debug directory

images:


![warning messages on new spec](<CleanShot 2026-07-10 at 12.47.22@2x.png>)

![only two API providers allowed](<CleanShot 2026-07-10 at 12.48.25@2x.png>)

![restriction on model causes error when adding API key](<CleanShot 2026-07-10 at 12.48.54@2x.png>)


## 2. O2–O4 — Login recovery and Run B

NOTES:

- origination entries are duplicated in `.fixtures/workbenches/workspace-alpha-grounding/.brunch/debug/origination.md`
- `system-prompt.md` contains references to the Pi documentation, which it shoudl not
- cancelling out of an `Ask` tool does not provide any hints about commands that can be run.. this was supposed to happen via ctx.ui.notify I think
- `/continue`

- [x] normal orientation and provider turn occur;
- [x] seed precedes the first useful action;
- [x] first action interprets actual seeded facts/readiness;
- [x] `entry-contents.md`, `origination.md`, `system-prompt.md`, session JSONL are legible;
- [x] `/brunch:consult` labels and routing are understandable;
- [x] Escape is inert;
- [ ] cancellation recovery hints make `/continue`, `/consult`, and `/mode` noticeable.

## 3. O5–O6 — Focused WR5 conduct

ISSUES:

- the review-set `present_` and `ask` combo still repeats information
	
	![repeated presentation content](<CleanShot 2026-07-10 at 13.01.53@2x.png>)
- the first pass from the model, as you can see above, was a bit thin; i requested changes including "more theses and stories" and got this:

	![second review-set](<CleanShot 2026-07-10 at 13.01.53@2x-2.png>)

- [ ] the continuation ask avoids duplicating the digest/pretext;
- [x] the model does not author an Other-equivalent option;
- [x] approving the digest leads directly to supported advisory graph mutation rather than broad re-questioning;
- [-] extraction covers entities, relations, and narrative obligations.
