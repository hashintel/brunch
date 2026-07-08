/**
 * Synthetic exchange tool-call pair minting — the provider-legality half of the
 * structured-exchange loop. Imported by `accepted-response.ts` (toolResult
 * pairing) and re-exported from the public `structured-exchange-loop.ts` root.
 */

/**
 * Synthetic assistant tool-call message pairing a synthetic exchange
 * toolResult. Real providers require every `tool_result` to reference a
 * `tool_use` from the immediately preceding assistant message — an orphan
 * toolResult is a 400 — so product-originated exchange tuples persist the
 * same call+result pair an LLM-driven exchange produces. Provenance fields
 * are honest sentinels (`brunch-exchange`), never a real provider id.
 */
export interface SyntheticExchangeToolCallMessage {
  role: 'assistant';
  content: [{ type: 'toolCall'; id: string; name: string; arguments: Record<string, unknown> }];
  api: string;
  provider: string;
  model: string;
  usage: {
    input: 0;
    output: 0;
    cacheRead: 0;
    cacheWrite: 0;
    totalTokens: 0;
    cost: { input: 0; output: 0; cacheRead: 0; cacheWrite: 0; total: 0 };
  };
  stopReason: 'toolUse';
  timestamp: 0;
}

/**
 * Anthropic constrains `tool_use_id` to `^[a-zA-Z0-9_-]+$`, so the synthetic
 * id joins exchange id and tool name with `__` (never `:`).
 */
export function exchangeToolCallId(exchangeId: string, toolName: string): string {
  return `${exchangeId}__${toolName}`;
}

export function syntheticExchangeToolCallMessage(
  exchangeId: string,
  toolName: string,
): SyntheticExchangeToolCallMessage {
  return {
    role: 'assistant',
    content: [
      {
        type: 'toolCall',
        id: exchangeToolCallId(exchangeId, toolName),
        name: toolName,
        arguments: toolName === 'ask' ? { continues: exchangeId } : { exchangeId },
      },
    ],
    api: 'brunch-exchange',
    provider: 'brunch',
    model: 'brunch-structured-exchange',
    usage: {
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
      totalTokens: 0,
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
    },
    stopReason: 'toolUse',
    timestamp: 0,
  };
}
