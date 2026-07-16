import {
  appendElicitationStyleEntry,
  type ElicitationStyle,
  type ElicitationStyleEntryManager,
} from '../../../session/elicitation-style.js';
import {
  appendProcessMoveEntry,
  type ProcessMove,
  type ProcessMoveEntryManager,
} from '../../../session/process-move.js';
import type { OperationalModeId } from '../../../session/schema/kinds.js';
import type { ConsultMenuResult } from '../../components/consult-menu.js';

export type SessionOrientationChoice = ElicitationStyle | ProcessMove | 'dismissed';
export type SessionOrientationTrigger = 'entry' | 'mode-switch' | 'consult';

export interface ProcessMoveAvailability {
  readonly move_to_execution: boolean;
  readonly prepare_execution: boolean;
  readonly compile_plan: boolean;
  readonly execute_plan: boolean;
}

export const DETERMINISTIC_PROCESS_MOVE_AVAILABILITY: Readonly<
  Record<OperationalModeId, ProcessMoveAvailability>
> = {
  specify: { move_to_execution: false, prepare_execution: false, compile_plan: false, execute_plan: false },
  execute: { move_to_execution: false, prepare_execution: true, compile_plan: false, execute_plan: false },
};

export interface SessionOrientationMenuItem {
  readonly id: SessionOrientationChoice;
  readonly label: string;
  readonly description?: string;
  readonly current?: boolean;
}
export interface SessionOrientationMenuDescriptor {
  readonly title: string;
  readonly topLabel?: string;
  readonly bottomLabel?: string;
  readonly initialSelectedId?: SessionOrientationChoice;
  readonly items: readonly SessionOrientationMenuItem[];
}

export const SESSION_ORIENTATION_MENU = {
  title: 'Choose how Specify mode should work',
  topLabel: '[ Specify ]',
  items: [
    {
      id: 'interrogate',
      label: 'Work via intent',
      description: 'Surface and resolve the decisions that shape product intent.',
    },
    {
      id: 'disambiguate',
      label: 'Work via examples',
      description: 'Use examples and counterexamples to collapse ambiguity.',
    },
    {
      id: 'propose',
      label: 'Work via proposals',
      description: 'Offer candidate directions for you to compare and refine.',
    },
  ],
} as const satisfies SessionOrientationMenuDescriptor;

const MOVE_MENU_ITEMS = {
  move_to_execution: {
    id: 'move_to_execution',
    label: 'Move to execution',
    description: 'Switch to Execute when the specification is ready for implementation.',
  },
  prepare_execution: {
    id: 'prepare_execution',
    label: 'Prepare execution',
    description: 'Close design, verification, and commitment gaps.',
  },
  compile_plan: {
    id: 'compile_plan',
    label: 'Compile a plan',
    description: 'Turn ready committed scope into an executable plan.',
  },
  execute_plan: {
    id: 'execute_plan',
    label: 'Execute the plan',
    description: 'Validate the current plan and begin only the next safe scoped unit.',
  },
} as const satisfies Record<ProcessMove, SessionOrientationMenuItem>;

export const CODE_SESSION_ORIENTATION_MENU = {
  title: 'Choose how Execute mode should continue',
  topLabel: '[ Execute ]',
  items: [MOVE_MENU_ITEMS.prepare_execution],
} as const satisfies SessionOrientationMenuDescriptor;

export function buildSessionOrientationMenu(input: {
  readonly mode: OperationalModeId;
  readonly currentStyle?: ElicitationStyle;
  readonly availability?: unknown;
}): SessionOrientationMenuDescriptor {
  const supplied = availabilityFrom(input.availability);
  const availability = supplied ?? DETERMINISTIC_PROCESS_MOVE_AVAILABILITY[input.mode];
  if (input.mode === 'execute') {
    return {
      ...CODE_SESSION_ORIENTATION_MENU,
      items: [
        MOVE_MENU_ITEMS.prepare_execution,
        ...(availability.compile_plan ? [MOVE_MENU_ITEMS.compile_plan] : []),
        ...(availability.execute_plan ? [MOVE_MENU_ITEMS.execute_plan] : []),
      ],
    };
  }

  const styleItems = SESSION_ORIENTATION_MENU.items.map((item) =>
    item.id === input.currentStyle ? { ...item, current: true as const } : item,
  );
  return {
    ...SESSION_ORIENTATION_MENU,
    ...(input.currentStyle ? { initialSelectedId: input.currentStyle } : {}),
    items: [...styleItems, ...(availability.move_to_execution ? [MOVE_MENU_ITEMS.move_to_execution] : [])],
  };
}

function availabilityFrom(value: unknown): Partial<ProcessMoveAvailability> | undefined {
  if (!value || typeof value !== 'object' || value instanceof Error) return undefined;
  const candidate = value as Record<string, unknown>;
  return {
    move_to_execution: candidate.move_to_execution === true,
    prepare_execution: candidate.prepare_execution === true,
    compile_plan: candidate.compile_plan === true,
    execute_plan: candidate.execute_plan === true,
  };
}

export interface SessionOrientationDialogUi {
  select(title: string, options: string[]): Promise<string | undefined>;
  customMenu?(menu: SessionOrientationMenuDescriptor): Promise<ConsultMenuResult | undefined>;
}

export async function runSessionOrientationDialog(
  ui: SessionOrientationDialogUi,
  options: { readonly menu?: SessionOrientationMenuDescriptor } = {},
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

export type SessionOrientationEntryManager = ElicitationStyleEntryManager & ProcessMoveEntryManager;

export async function runAndRecordSessionOrientation(input: {
  readonly hasUI: boolean;
  readonly ui: SessionOrientationDialogUi;
  readonly trigger: SessionOrientationTrigger;
  readonly manager: SessionOrientationEntryManager;
  readonly currentStyle?: ElicitationStyle;
  readonly onAppendError?: (error: unknown) => void;
  readonly menu?: SessionOrientationMenuDescriptor;
}): Promise<
  | { readonly choice: SessionOrientationChoice; readonly recorded: boolean; readonly appendFailed: boolean }
  | undefined
> {
  if (!input.hasUI) return undefined;
  const choice = await runSessionOrientationDialog(input.ui, input.menu ? { menu: input.menu } : {});
  if (choice === 'dismissed' || choice === input.currentStyle) {
    return { choice, recorded: false, appendFailed: false };
  }
  try {
    if (choice === 'interrogate' || choice === 'disambiguate' || choice === 'propose') {
      appendElicitationStyleEntry(input.manager, choice);
    } else {
      appendProcessMoveEntry(input.manager, choice);
    }
    return { choice, recorded: true, appendFailed: false };
  } catch (error) {
    input.onAppendError?.(error);
    return { choice, recorded: false, appendFailed: true };
  }
}
