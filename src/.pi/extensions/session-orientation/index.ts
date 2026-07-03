/**
 * Session orientation dialog — Pi-facing adapter over the domain choice
 * schema (`session/session-orientation.ts`). Owns the SPEC-mode menu labels,
 * the `ctx.ui.select`-shaped dialog function, and the entry/degraded-mode
 * rules from the decision-flow chart (session-entry-orientation frontier):
 *
 * - Entry rule: an entry is written on every dialog resolution, including
 *   escape/timeout (`select` returning `undefined`) mapping to `continue`.
 *   No entry is written when the dialog is not shown at all (`hasUI` false).
 * - Append is best-effort: a failed `appendCustomEntry` is reported through
 *   `onAppendError` and never blocks the caller (boot/kick must not stall on
 *   a ledger-write failure).
 *
 * This module is UI-source-agnostic: it accepts anything shaped like
 * `ExtensionUIContext['select']`, so both the extension-bound `ctx.ui`
 * (mid-session junctures, J2-J6) and any other select-shaped dialog surface
 * can drive the same choice/entry logic.
 */

import {
  appendSessionOrientationEntry,
  SESSION_ORIENTATION_CHOICES,
  type SessionOrientationChoice,
  type SessionOrientationEntrySessionManager,
  type SessionOrientationTrigger,
} from '../../../session/session-orientation.js';

const SESSION_ORIENTATION_MENU_LABELS: Record<SessionOrientationChoice, string> = {
  continue: 'continue',
  elicit_decisions: 'continue via decision-driven questions [elicit/grill-style]',
  elicit_examples: 'continue via example-driven questions [elicit/disambiguate-style]',
  propose_intent: 'propose candidate spec designs [propose:intent]',
  propose_design: 'propose technical designs [propose/project:design]',
  propose_oracle: 'propose verification designs [propose/project:oracle]',
  ingest: 'ingest source material [ingest]',
};

export const SESSION_ORIENTATION_MENU: readonly {
  readonly id: SessionOrientationChoice;
  readonly label: string;
}[] = SESSION_ORIENTATION_CHOICES.map((id) => ({ id, label: SESSION_ORIENTATION_MENU_LABELS[id] }));

export interface SessionOrientationDialogUi {
  select(title: string, options: string[]): Promise<string | undefined>;
}

/** Runs the SPEC-mode menu and maps escape/timeout (`undefined`) to `continue`. */
export async function runSessionOrientationDialog(
  ui: SessionOrientationDialogUi,
  title = 'How should this session continue?',
): Promise<SessionOrientationChoice> {
  const picked = await ui.select(
    title,
    SESSION_ORIENTATION_MENU.map((item) => item.label),
  );
  return SESSION_ORIENTATION_MENU.find((item) => item.label === picked)?.id ?? 'continue';
}

export interface RunAndRecordSessionOrientationInput {
  readonly hasUI: boolean;
  readonly ui: SessionOrientationDialogUi;
  readonly trigger: SessionOrientationTrigger;
  readonly manager: SessionOrientationEntrySessionManager;
  readonly onAppendError?: (error: unknown) => void;
  readonly title?: string;
}

/**
 * Runs the dialog, then records the resolution (entry rule). Returns
 * `undefined` only when the dialog was never shown (degraded mode).
 */
export async function runAndRecordSessionOrientation(
  input: RunAndRecordSessionOrientationInput,
): Promise<SessionOrientationChoice | undefined> {
  if (!input.hasUI) return undefined;

  const choice = await runSessionOrientationDialog(input.ui, input.title);
  try {
    appendSessionOrientationEntry(input.manager, { choice, trigger: input.trigger });
  } catch (error: unknown) {
    input.onAppendError?.(error);
  }
  return choice;
}
