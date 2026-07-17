# Saved comparison missions

This directory holds editable, product-neutral comparison missions for operators and maintainers who browse or hand-revise them. Start the conversational workflow with `/compare-specs`, or pass a mission id/path as `/compare-specs [mission-id-or-path]` to review, revise, or run an existing mission.

A mission is readable Markdown containing six input groups:

1. the opening ask shared with each target;
2. simulated-user knowledge and the exact reveal policy for private facts;
3. the useful-document expectation, ready condition, and requested Markdown filename;
4. the selected contenders from the concrete v1 roster—Brunch, Claude Code, Codex, Cursor, and Pi (Cursor/agent is one contender);
5. the approved exact shared framing visible to every contender; and
6. the approved per-harness framing: Brunch's visible built-in Specify-mode conduct and exact added text, plus the exact initial text each selected generic harness receives, including an explicit empty addition when appropriate.

The `/compare-specs` conversation first elicits the mission in ordinary product language, then drafts this comparable framing for the operator to inspect and tweak. Its default makes explicit the conduct Brunch gets implicitly from Specify mode: ask about consequential missing information instead of guessing, separate known facts from uncertainty, surface recommendations and tradeoffs, produce the requested review-ready specification document, and stop at the approved ready condition. The operator explicitly approves the complete framing before it is saved; they may edit exact text but need not author technical prompts from scratch.

Missions are not Brunch seeds and do not encode Brunch graph state. Do not place them under `.fixtures/seeds/`, and do not turn them into controller YAML. Controller-only reveal material must remain outside target workspaces and retained target-visible artifacts.

Files here remain editable. A revision affects future runs only: it must never rewrite an existing immutable approved snapshot or report under `.fixtures/runs/agent-as-user-comparison/`. Ephemeral run assembly belongs under `.fixtures/scratch/comparisons/`. The complete launch, isolation, cleanup, and report procedure lives in `/compare-specs`, not in mission files.
