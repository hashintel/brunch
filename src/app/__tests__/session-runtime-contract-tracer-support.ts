/**
 * Shared vocabulary for the production TUI PTY witness, which spans two
 * processes: the Vitest parent drives a PTY through `src/dev/tui-driver`, and
 * `session-runtime-contract-tracer-child.ts` boots the real `runBrunchTui`
 * inside it.
 *
 * The report is deliberately the whole cross-process channel: sidecar URL and
 * readiness, nothing else. The durable target and transcript truth stay owned
 * by the production canonical-session reader, so the witness cannot read its
 * postconditions out of a second store.
 */

/** Report filename inside the parent-owned scratch directory. */
export const TRACER_REPORT_FILE = 'production-tracer-report.json';

/** Spec title the child activates; also the deterministic on-screen chrome marker. */
export const TRACER_SPEC_TITLE = 'Production PTY tracer';

/** Assistant text for the product's own opening turn. */
export const TRACER_OPENING_REPLY = 'Opening turn from the production PTY tracer.';

/** The one ordinary turn the parent types into the real Pi editor. */
export const TRACER_PROBE_PROMPT = 'Confirm the production PTY tracer turn.';

/** Assistant text the faux backend returns for exactly that prompt. */
export const TRACER_PROBE_REPLY = 'Acknowledged the production PTY tracer turn.';

/**
 * The turn typed after a rival standalone-web composition has been refused the
 * TUI-owned target. It shares no substring with the other prompts, because the
 * child's responder is content-addressed over the whole accumulated context.
 */
export const TRACER_RIVAL_PROMPT = 'Carry on after the refused second window.';

/** Assistant text the faux backend returns for exactly that prompt. */
export const TRACER_RIVAL_REPLY = 'Carried on with the sole writable runtime.';

/** The turn that makes the real assistant call the production `ask` tool. */
export const TRACER_ASK_PROMPT = 'Open a structured question for the production PTY tracer.';

/** Exchange id and question body the queued `ask` tool call carries. */
export const TRACER_ASK_EXCHANGE_ID = 'production-pty-tracer-ask';
export const TRACER_ASK_BODY = 'Which shape should the production PTY tracer prove?';

/** The answer the parent types into the real Pi ask editor. */
export const TRACER_ASK_ANSWER = 'The observe-only announcement shape.';

/** Assistant text the faux backend returns once the ask has been answered. */
export const TRACER_ASK_REPLY = 'Recorded the production PTY tracer answer.';

export type ProductionTracerReport =
  | {
      readonly status: 'ready';
      readonly cwd: string;
      readonly webSidecarUrl: string;
    }
  | {
      readonly status: 'failed';
      readonly cwd: string;
      readonly error: string;
    };
