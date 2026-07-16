import * as z from 'zod';

import { zAskQuestionEcho, zQuestionnaireQuestion } from '../exchanges/schemas/index.js';
import { OPEN_ASK_MODES, type OpenAsk } from '../session/live-ask-registry.js';
import type { LiveSessionEvent } from '../session/live-session-host.js';

export const LIVE_SESSION_EVENT_METHOD = 'brunch.liveSessionEvent';

// specId min 1 mirrors the server's inbound TypeBox target (Type.Integer minimum 1);
// the client rejects any echoed target below it as a malformed frame.
const zSessionTarget = z.object({ specId: z.number().int().min(1), sessionId: z.string().min(1) }).strict();
const zOpenAsk = z
  .object({
    exchangeId: z.string().min(1),
    mode: z.enum(OPEN_ASK_MODES),
    question: z.union([
      zAskQuestionEcho.extend({ questions: z.array(zQuestionnaireQuestion).min(1) }),
      zAskQuestionEcho,
    ]),
  })
  .strict();
const zSessionPresentationDelta = z.discriminatedUnion('type', [
  z.object({ type: z.literal('assistant_text_delta'), runId: z.string(), text: z.string() }).strict(),
  z.object({ type: z.literal('agent_settled') }).strict(),
  z.object({ type: z.literal('ask_opened'), ask: zOpenAsk }).strict(),
]);

export const liveSessionEventSchema = z
  .object({ target: zSessionTarget, seq: z.number().int().nonnegative(), delta: zSessionPresentationDelta })
  .strict() satisfies z.ZodType<LiveSessionEvent>;

export const openAsksResultSchema = z.object({ openAsks: z.array(zOpenAsk) }).strict() satisfies z.ZodType<{
  openAsks: OpenAsk[];
}>;
export type OpenAsksResult = z.infer<typeof openAsksResultSchema>;

export interface LiveSessionEventFrame {
  readonly jsonrpc: '2.0';
  readonly method: typeof LIVE_SESSION_EVENT_METHOD;
  readonly params: LiveSessionEvent;
}

export function createLiveSessionEventFrame(event: LiveSessionEvent): LiveSessionEventFrame {
  return { jsonrpc: '2.0', method: LIVE_SESSION_EVENT_METHOD, params: event };
}
