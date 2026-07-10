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
  readonly topLabel?: string;
  readonly bottomLabel?: string;
  readonly items: readonly SessionOrientationMenuItem[];
  /** A resolved choice that records an orientation entry but suppresses the live kick. */
  readonly noKickChoice?: SessionOrientationChoice;
}

export const SESSION_ORIENTATION_MENU = {
  title: 'Choose how Specify mode should continue',
  topLabel: '[ Specify ]',
  noKickChoice: 'continue',
  items: [
    {
      id: 'elicit_decisions',
      label: 'Work by decision',
      description: 'Use grill-style pressure to resolve product and architectural choices.',
    },
    {
      id: 'elicit_examples',
      label: 'Work by example',
      description: 'Use examples and counterexamples to collapse ambiguity.',
    },
    {
      id: 'propose_intent',
      label: 'Propose a spec direction',
      description: 'Project product-intent alternatives before choosing one.',
    },
    {
      id: 'propose_design',
      label: 'Prep technical design for execution',
      description: 'Compare implementation shapes and tradeoffs before Execute mode takes over.',
    },
    {
      id: 'propose_oracle',
      label: 'Prep verification for execution',
      description: 'Design the test and evidence strategy for this frontier.',
    },
    {
      id: 'ingest',
      label: 'Ingest source material',
      description: 'Fold supplied context into Brunch truth before asking anything else.',
    },
    { id: 'continue', label: 'Wait for me', description: 'Stay inert until your next instruction.' },
  ],
} as const satisfies SessionOrientationMenuDescriptor;

export const CODE_SESSION_ORIENTATION_MENU = {
  title: 'Choose how Execute mode should continue',
  topLabel: '[ Execute ]',
  items: [
    {
      id: 'prepare_execution',
      label: 'Design / oracle / commit work',
      description:
        'Assess preparation evidence, recommend one design/oracle/commitment path, and ask before beginning it.',
    },
    {
      id: 'compile_plan',
      label: 'Plan compilation readiness',
      description: 'Assess readiness, name gaps, then offer compile-now versus backfill-first.',
    },
    {
      id: 'execute_plan',
      label: 'Plan execution',
      description: 'Validate the plan is fresh and ready, then begin only the next safe scoped unit.',
    },
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
