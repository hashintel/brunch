/**
 * Session orientation dialog — Pi-facing adapter over the domain choice
 * schema (`session/session-orientation.ts`). Owns menu descriptors, the
 * `ctx.ui.select`-shaped dialog function, and the entry/degraded-mode rules
 * from the deterministic-orientation decision-flow charts.
 *
 * - Entry rule: an entry is written on every dialog resolution, including
 *   escape/timeout (`select` returning `undefined`) mapping to the menu's
 *   default choice. No entry is written when the dialog is not shown at all
 *   (`hasUI` false).
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
  type SessionOrientationChoice,
  type SessionOrientationEntrySessionManager,
  type SessionOrientationTrigger,
} from '../../../session/session-orientation.js';

export interface SessionOrientationMenuItem {
  readonly id: SessionOrientationChoice;
  readonly label: string;
}

export interface SessionOrientationMenuDescriptor {
  readonly title: string;
  readonly items: readonly SessionOrientationMenuItem[];
  readonly defaultChoice: SessionOrientationChoice;
  /** A resolved choice that records an orientation entry but suppresses the live kick. */
  readonly noKickChoice?: SessionOrientationChoice;
}

export const SESSION_ORIENTATION_MENU = {
  title: 'How should this session continue?',
  defaultChoice: 'continue',
  noKickChoice: 'continue',
  items: [
    { id: 'continue', label: 'continue' },
    { id: 'elicit_decisions', label: 'continue via decision-driven questions [elicit/grill-style]' },
    { id: 'elicit_examples', label: 'continue via example-driven questions [elicit/disambiguate-style]' },
    { id: 'propose_intent', label: 'propose candidate spec designs [propose:intent]' },
    { id: 'propose_design', label: 'propose technical designs [propose/project:design]' },
    { id: 'propose_oracle', label: 'propose verification designs [propose/project:oracle]' },
    { id: 'ingest', label: 'ingest source material [ingest]' },
  ],
} as const satisfies SessionOrientationMenuDescriptor;

export const CODE_SESSION_ORIENTATION_MENU = {
  title: 'How should Execute mode start?',
  defaultChoice: 'proceed',
  items: [
    { id: 'proceed', label: 'proceed with a readiness assessment' },
    { id: 'backfill', label: 'backfill missing information via questions [Negotiate/Ask]' },
    { id: 'design_first', label: 'design the technical approach first [propose/project:design]' },
    { id: 'oracle_first', label: 'design the verification approach first [propose/project:oracle]' },
    { id: 'project_plan', label: 'project a frontier-level plan and proceed [project]' },
  ],
} as const satisfies SessionOrientationMenuDescriptor;

export interface SessionOrientationDialogUi {
  select(title: string, options: string[]): Promise<string | undefined>;
}

export interface RunSessionOrientationDialogOptions {
  readonly menu?: SessionOrientationMenuDescriptor;
}

/** Runs a menu and maps escape/timeout (`undefined`) to that menu's default. */
export async function runSessionOrientationDialog(
  ui: SessionOrientationDialogUi,
  options: RunSessionOrientationDialogOptions = {},
): Promise<SessionOrientationChoice> {
  const menu = options.menu ?? SESSION_ORIENTATION_MENU;
  const picked = await ui.select(
    menu.title,
    menu.items.map((item) => item.label),
  );
  return menu.items.find((item) => item.label === picked)?.id ?? menu.defaultChoice;
}

export interface RunAndRecordSessionOrientationInput {
  readonly hasUI: boolean;
  readonly ui: SessionOrientationDialogUi;
  readonly trigger: SessionOrientationTrigger;
  readonly manager: SessionOrientationEntrySessionManager;
  readonly onAppendError?: (error: unknown) => void;
  readonly menu?: SessionOrientationMenuDescriptor;
}

/**
 * Runs the dialog, then records the resolution (entry rule). Returns
 * `undefined` only when the dialog was never shown (degraded mode).
 */
export async function runAndRecordSessionOrientation(
  input: RunAndRecordSessionOrientationInput,
): Promise<SessionOrientationChoice | undefined> {
  if (!input.hasUI) return undefined;

  const choice = await runSessionOrientationDialog(
    input.ui,
    input.menu !== undefined ? { menu: input.menu } : {},
  );
  try {
    appendSessionOrientationEntry(input.manager, { choice, trigger: input.trigger });
  } catch (error: unknown) {
    input.onAppendError?.(error);
  }
  return choice;
}
