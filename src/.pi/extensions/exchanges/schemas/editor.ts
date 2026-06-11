import * as z from 'zod';

/**
 * Editor wire envelope for `request_choices`.
 *
 * `request_choices` is the one structured-exchange request whose response
 * payload cannot ride a Pi UI built-in, and Pi's `ctx.ui.custom` cannot cross
 * RPC. The tool therefore prefills this JSON envelope into `ctx.ui.editor` and
 * parses the edited document back.
 *
 * The `status` string here is editor wire state only. Transcript result
 * details (`request.ts`) carry their outcome as key presence —
 * `answered` / `cancelled` / `unavailable` — never a status string.
 */
export const STRUCTURED_EXCHANGE_REQUEST_CHOICES_EDITOR_SCHEMA =
  'brunch.structured_exchange.request_choices.editor' as const;
export const STRUCTURED_EXCHANGE_REQUEST_CHOICES_EDITOR_VERSION = 1 as const;

/**
 * A choice reference inside the editor envelope. The prefill lists the offered
 * choices with labels; the edited response only owes back ids, so `label` is
 * optional on the way in.
 */
export const zRequestChoicesEditorChoice = z.object({
  id: z.string().min(1),
  label: z.string().optional(),
});
export type RequestChoicesEditorChoice = z.infer<typeof zRequestChoicesEditorChoice>;

export const zRequestChoicesEditorResponse = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('cancelled'),
    choices: z.array(zRequestChoicesEditorChoice).optional(),
    comment: z.string().optional(),
  }),
  z.object({
    status: z.literal('answered'),
    choices: z.array(zRequestChoicesEditorChoice),
    comment: z.string(),
  }),
]);
export type RequestChoicesEditorResponse = z.infer<typeof zRequestChoicesEditorResponse>;

export const zRequestChoicesEditorEnvelope = z.object({
  schema: z.literal(STRUCTURED_EXCHANGE_REQUEST_CHOICES_EDITOR_SCHEMA),
  schemaVersion: z.literal(STRUCTURED_EXCHANGE_REQUEST_CHOICES_EDITOR_VERSION),
  prompt: z.string(),
  mode: z.literal('multi-choice'),
  choices: z.array(zRequestChoicesEditorChoice),
  instructions: z.array(z.string()),
  commentPrompt: z.string(),
  response: zRequestChoicesEditorResponse,
});
export type RequestChoicesEditorEnvelope = z.infer<typeof zRequestChoicesEditorEnvelope>;
export type RequestChoicesEditorEnvelopeInput = z.input<typeof zRequestChoicesEditorEnvelope>;

/**
 * The edited document only owes back a valid `response`; the rest of the
 * envelope is instructional scaffolding the client may leave untouched.
 */
export const zRequestChoicesEditorReply = zRequestChoicesEditorEnvelope.pick({ response: true });
