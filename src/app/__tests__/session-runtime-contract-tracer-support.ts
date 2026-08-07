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
