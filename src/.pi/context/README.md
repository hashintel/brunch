# Legacy Brunch prompt context

This directory is legacy from the pre-D58 prompt-pack composer. Product prompt composition now lives in `src/agents/compose.ts` and is registered through `src/.pi/extensions/prompting.ts`; `.pi/extensions/` adapts the Pi event only.

The remaining files here are not a product load path and must not be imported by Brunch runtime code. They exist only until the rest of the `agents-composition-layer` frontier finishes rehoming or deleting old prompt-pack content.

Do not add new prompt assets here. Brunch-owned prompt resources now belong under `src/agents/{definitions,goals,strategies,lenses,methods}/` and their manifest metadata is code-owned in `src/agents/state.ts`, not discovered from the filesystem.
