# Method: run-structured-exchange

Use Brunch structured exchanges for typed human responses: questions, single-choice, multi-choice, freeform, and review outcomes.

Each exchange should have a clear reason, a compact prompt, and response options that map to the current goal. Do not rely on ambient chat when a typed exchange is needed.

Transcript/projection rules:

- Structured exchanges are transcript-native `present_* -> request_* -> capture_*` tool result families.
- `toolResult.content` is durable markdown for transcript display and model-readable context.
- `toolResult.details` is structured recovery/projection data; classify rows by `details.schema` plus `v`, not by tool name alone.
- `renderCall` is display-only and must not carry durable Brunch meaning.
- Use `tool_meta` for sequence/sibling facts.
- Use `comment` for user-authored text and `message` for system/runtime-authored text.
- Request outcomes are an exactly-one property-presence union: `answered`, `cancelled`, or `unavailable`.
