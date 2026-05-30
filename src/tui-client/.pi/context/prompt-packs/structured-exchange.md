# Structured exchanges

- Structured exchanges are transcript-native `present_* -> request_* -> capture_*` tool result families.
- `toolResult.content` is durable markdown for transcript display and model-readable context.
- `toolResult.details` is structured recovery and projection data.
- `renderCall` is not semantic and must not carry durable Brunch meaning.
- Classify structured-exchange rows by `details.schema`, not `toolName` alone.
- Use `schema` plus `v` as checked discriminants in the details model.
- Use `tool_meta` for sequence and sibling information.
- Use `comment` for user-authored text and `message` for system/runtime-authored text.
- Request outcomes are an exactly-one property-presence union: `answered`, `cancelled`, or `unavailable`.
