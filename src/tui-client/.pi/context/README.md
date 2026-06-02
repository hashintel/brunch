# Brunch private context and prompt packs

This directory contains private Brunch product context and prompt assets for the embedded Pi runtime.

It is intentionally under `.pi/context/`, not `.pi/prompts/`, so these files are not Pi prompt-template resources and are not user-invoked slash-command prompt templates. Product code imports and composes prompt packs deterministically through `compose-brunch-prompt.ts` and the `registerBrunchPrompting` extension.

`prompt-packs/` contains Brunch-owned markdown fragments. They are product control-plane assets, not ambient Pi skills or templates, and must never be returned from `resources_discover.promptPaths`.

Future dynamic context renderers live under `builders/`. Builders should project already-canonical state into prompt text; they must not become hidden stores, query ambient Pi resources, or invent uncaptured facts.
