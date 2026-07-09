/**
 * Session orientation dialog — Pi-facing adapter over the domain choice
 * schema (`session/session-orientation.ts`). Owns menu descriptors, the
 * `ctx.ui.select`-shaped dialog function, and the entry/degraded-mode rules
 * from the deterministic-orientation decision-flow charts.
 *
 * - Entry rule: an entry is written on every dialog resolution, including
 *   escape/timeout (`select` returning `undefined`) resolving to the inert
 *   `dismissed` choice. No entry is written when the dialog is not shown at
 *   all (`hasUI` false).
 * - Dismissal rule: escape/timeout means "leave me inert" — the entry records
 *   `dismissed`, no kick fires, and no opening-turn directive is seeded. Only
 *   an explicit menu selection routes anything.
 * - Append is required for directed choices: a failed `appendCustomEntry` is
 *   reported through `onAppendError`; inert/no-UI boot may still proceed, but a
 *   non-inert directed kick must not depend on an entry that failed to persist.
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
import type { ConsultMenuResult } from '../../components/consult-menu.js';

export interface SessionOrientationMenuItem {
  readonly id: SessionOrientationChoice;
  readonly label: string;
  readonly description?: string;
}

export interface SessionOrientationMenuDescriptor {
  readonly title: string;
  readonly items: readonly SessionOrientationMenuItem[];
  /** A resolved choice that records an orientation entry but suppresses the live kick. */
  readonly noKickChoice?: SessionOrientationChoice;
}

export const SESSION_ORIENTATION_MENU = {
  title: 'How should this session continue?',
  noKickChoice: 'continue',
  items: [
    { id: 'continue', label: 'Continue', description: 'Stay inert until your next instruction.' },
    {
      id: 'elicit_decisions',
      label: 'Ask decision-driven questions',
      description: 'Use the elicitor/grill style to resolve product and architectural choices.',
    },
    {
      id: 'elicit_examples',
      label: 'Ask example-driven questions',
      description: 'Use examples and counterexamples to collapse ambiguity.',
    },
    {
      id: 'propose_intent',
      label: 'Propose candidate spec designs',
      description: 'Project product intent alternatives before choosing one.',
    },
    {
      id: 'propose_design',
      label: 'Propose technical designs',
      description: 'Project implementation shapes and tradeoffs.',
    },
    {
      id: 'propose_oracle',
      label: 'Propose verification designs',
      description: 'Project test and evidence strategies for this frontier.',
    },
    {
      id: 'ingest',
      label: 'Ingest source material',
      description: 'Fold supplied context into Brunch truth.',
    },
  ],
} as const satisfies SessionOrientationMenuDescriptor;

export const CODE_SESSION_ORIENTATION_MENU = {
  title: 'How should Execute mode start?',
  items: [
    { id: 'proceed', label: 'Proceed with readiness assessment' },
    {
      id: 'backfill',
      label: 'Backfill missing information',
      description: 'Negotiate or ask before executing.',
    },
    { id: 'design_first', label: 'Design the technical approach first' },
    { id: 'oracle_first', label: 'Design the verification approach first' },
    { id: 'project_plan', label: 'Project a frontier-level plan and proceed' },
  ],
} as const satisfies SessionOrientationMenuDescriptor;

export interface SessionOrientationDialogUi {
  select(title: string, options: string[]): Promise<string | undefined>;
  customMenu?(menu: SessionOrientationMenuDescriptor): Promise<ConsultMenuResult | undefined>;
}

export interface RunSessionOrientationDialogOptions {
  readonly menu?: SessionOrientationMenuDescriptor;
}

/** Runs a menu and maps escape/timeout (`undefined`) to the inert `dismissed`. */
export async function runSessionOrientationDialog(
  ui: SessionOrientationDialogUi,
  options: RunSessionOrientationDialogOptions = {},
): Promise<SessionOrientationChoice> {
  const menu = options.menu ?? SESSION_ORIENTATION_MENU;
  if (ui.customMenu) {
    const picked = await ui.customMenu(menu);
    return menu.items.find((item) => item.id === picked?.id)?.id ?? 'dismissed';
  }
  const picked = await ui.select(
    menu.title,
    menu.items.map((item) => item.label),
  );
  return menu.items.find((item) => item.label === picked)?.id ?? 'dismissed';
}

export interface RunAndRecordSessionOrientationInput {
  readonly hasUI: boolean;
  readonly ui: SessionOrientationDialogUi;
  readonly trigger: SessionOrientationTrigger;
  readonly manager: SessionOrientationEntrySessionManager;
  readonly onAppendError?: (error: unknown) => void;
  readonly menu?: SessionOrientationMenuDescriptor;
}

export interface RunAndRecordSessionOrientationResult {
  readonly choice: SessionOrientationChoice;
  readonly recorded: boolean;
}

/**
 * Runs the dialog, then records the resolution (entry rule). Returns
 * `undefined` only when the dialog was never shown (degraded mode).
 */
export async function runAndRecordSessionOrientation(
  input: RunAndRecordSessionOrientationInput,
): Promise<RunAndRecordSessionOrientationResult | undefined> {
  if (!input.hasUI) return undefined;

  const choice = await runSessionOrientationDialog(
    input.ui,
    input.menu !== undefined ? { menu: input.menu } : {},
  );
  try {
    appendSessionOrientationEntry(input.manager, { choice, trigger: input.trigger });
    return { choice, recorded: true };
  } catch (error: unknown) {
    input.onAppendError?.(error);
    return { choice, recorded: false };
  }
}
