import { SPEC_KINDS, type SpecKind, type SpecOrigin } from '../../../graph/schema/kinds.js';
import { decideSpecEstablishmentAsks, inferredOriginFor } from '../../../session/spec-establishment.js';
import type {
  WorkspaceLaunchInventory,
  WorkspaceLaunchSession,
  SpecSessionActivationDecision,
} from '../../../session/workspace-session-coordinator.js';

/** An activation held while the shared D118-L establishment stages run. */
type ResumableActivationDecision = Extract<
  SpecSessionActivationDecision,
  { action: 'continue' | 'openSession' | 'newSession' }
>;
type PendingActivationAction =
  | Extract<SpecSessionActivationDecision, { action: 'newSpec' }>
  | ResumableActivationDecision;

export type WorkspaceSelectionStage =
  | { stage: 'home' }
  | {
      stage: 'newSpecTitle';
      title: string;
    }
  /** D118-L establishment: populated cwd asks kind before confirming origin. */
  | {
      stage: 'establishmentKind';
      pending: PendingActivationAction;
    }
  /** D118-L establishment: the terminal ask/confirm before activation fires. */
  | {
      stage: 'establishmentOrigin';
      pending: PendingActivationAction;
      kind?: SpecKind;
    }
  | { stage: 'specList' }
  | {
      stage: 'specAction';
      specId: number;
    }
  | {
      stage: 'sessionList';
      specId: number;
    };

interface WorkspaceSelectionOption {
  id: string;
  label: string;
  /** Optional inline annotation (rendered dim after the label); only for information the label lacks. */
  detail?: string;
  kind:
    | 'continue'
    | 'newSpec'
    | 'resumeSpec'
    | 'cancel'
    | 'spec'
    | 'newSession'
    | 'resumeSession'
    | 'session'
    | 'establishKind'
    | 'establishOrigin';
  decision?: SpecSessionActivationDecision;
  nextStage?: WorkspaceSelectionStage;
}

export interface WorkspaceSelectionView {
  stage: WorkspaceSelectionStage['stage'];
  title: string;
  options: WorkspaceSelectionOption[];
  specId?: number;
}

export interface WorkspaceSelectionViewOptions {
  includeContinue?: boolean;
}

export type WorkspaceSelectionResult =
  | {
      decision: SpecSessionActivationDecision;
    }
  | {
      view: WorkspaceSelectionView;
      stage: WorkspaceSelectionStage;
    };

/**
 * The stage after title entry, deterministically branching per D118-L: a
 * populated cwd asks kind before confirming origin; a bare cwd skips
 * straight to the origin confirm (nothing else is inferable).
 */
export function nextStageAfterTitle(
  title: string,
  inventory: WorkspaceLaunchInventory,
): WorkspaceSelectionStage {
  const asks = decideSpecEstablishmentAsks({
    currentOrigin: null,
    workspacePopulated: inventory.workspacePopulated ?? false,
  });
  const pending = { action: 'newSpec', title } as const;
  return asks[0] === 'confirmKind'
    ? { stage: 'establishmentKind', pending }
    : { stage: 'establishmentOrigin', pending };
}

const SPEC_KIND_LABELS: Record<SpecKind, string> = {
  product: 'Full product — owns the whole codebase',
  feature: 'Feature — owns a part of this codebase',
  function: 'Function — a focused verification area',
};

function flipOrigin(origin: SpecOrigin): SpecOrigin {
  return origin === 'greenfield' ? 'brownfield' : 'greenfield';
}

/** The shared D118-L origin ask/confirm — one wording for create and resume. */
function originConfirmViewParts(
  inventory: WorkspaceLaunchInventory,
  decisionFor: (origin: SpecOrigin) => SpecSessionActivationDecision,
): Pick<WorkspaceSelectionView, 'title' | 'options'> {
  const inferred = inferredOriginFor({ workspacePopulated: inventory.workspacePopulated ?? false });
  const flipped = flipOrigin(inferred);
  return {
    title:
      inferred === 'brownfield'
        ? 'Does this build on the existing code here?'
        : 'Is this a fresh, greenfield specification?',
    options: [
      {
        id: `establish-origin:${inferred}`,
        label: inferred === 'brownfield' ? 'Yes — this is brownfield' : 'Yes — this is greenfield',
        kind: 'establishOrigin',
        decision: decisionFor(inferred),
      },
      {
        id: `establish-origin:${flipped}`,
        label: flipped === 'brownfield' ? 'No — this is brownfield' : 'No — treat as greenfield',
        kind: 'establishOrigin',
        decision: decisionFor(flipped),
      },
    ],
  };
}

/**
 * Route a resume-shaped decision: fire directly when the target spec's
 * posture is established; interpose the D118-L establishment stages when it
 * is not (a spec created outside the dialog — seed, RPC — gets the
 * establishment step once at next resume).
 */
function resumeRouting(
  inventory: WorkspaceLaunchInventory,
  decision: ResumableActivationDecision,
): Pick<WorkspaceSelectionOption, 'decision' | 'nextStage'> {
  const spec = findSpec(inventory, decision.specId);
  const asks = decideSpecEstablishmentAsks({
    currentOrigin: spec?.spec.origin ?? null,
    workspacePopulated: inventory.workspacePopulated ?? false,
  });
  if (asks.length === 0) return { decision };
  return {
    nextStage:
      asks[0] === 'confirmKind'
        ? { stage: 'establishmentKind', pending: decision }
        : { stage: 'establishmentOrigin', pending: decision },
  };
}

function establishedDecision(
  pending: PendingActivationAction,
  kind: SpecKind | undefined,
  origin: SpecOrigin,
): SpecSessionActivationDecision {
  if (pending.action === 'newSpec') {
    return { ...pending, ...(kind ? { kind } : {}), origin };
  }
  return { ...pending, establish: { origin, ...(kind ? { kind } : {}) } };
}

export function buildWorkspaceSelectionView(
  inventory: WorkspaceLaunchInventory,
  stage: WorkspaceSelectionStage = { stage: 'home' },
  options: WorkspaceSelectionViewOptions = {},
): WorkspaceSelectionView {
  if (stage.stage === 'newSpecTitle') {
    return {
      stage: 'newSpecTitle',
      title: 'Create new specification',
      options: [],
    };
  }

  if (stage.stage === 'establishmentKind') {
    return {
      stage: 'establishmentKind',
      title: 'What does this specification own?',
      options: SPEC_KINDS.map((kind) => ({
        id: `establish-kind:${kind}`,
        label: SPEC_KIND_LABELS[kind],
        kind: 'establishKind',
        nextStage: { stage: 'establishmentOrigin', pending: stage.pending, kind },
      })),
    };
  }

  if (stage.stage === 'establishmentOrigin') {
    return {
      stage: 'establishmentOrigin',
      ...originConfirmViewParts(inventory, (origin) =>
        establishedDecision(stage.pending, stage.kind, origin),
      ),
    };
  }

  if (stage.stage === 'specList') {
    return {
      stage: 'specList',
      title: 'Choose a specification',
      options: inventory.specs.map(({ spec }) => ({
        id: `spec:${spec.id}`,
        label: spec.title,
        kind: 'spec',
        nextStage: { stage: 'specAction', specId: spec.id },
      })),
    };
  }

  if (stage.stage === 'specAction') {
    const spec = findSpec(inventory, stage.specId);
    const options: WorkspaceSelectionOption[] = [
      {
        id: `new-session:${stage.specId}`,
        label: 'Create new session',
        kind: 'newSession',
        ...resumeRouting(inventory, { action: 'newSession', specId: stage.specId }),
      },
    ];
    if ((spec?.sessions.length ?? 0) > 0) {
      options.push({
        id: `resume-session:${stage.specId}`,
        label: 'Resume existing session',
        kind: 'resumeSession',
        nextStage: { stage: 'sessionList', specId: stage.specId },
      });
    }
    return {
      stage: 'specAction',
      specId: stage.specId,
      title: spec ? `Continue ${spec.spec.title}` : 'Continue specification',
      options,
    };
  }

  if (stage.stage === 'sessionList') {
    const spec = findSpec(inventory, stage.specId);
    return {
      stage: 'sessionList',
      specId: stage.specId,
      title: spec ? `Choose a session for ${spec.spec.title}` : 'Choose a session',
      options: (spec?.sessions ?? []).map((session) => ({
        id: `session:${session.file}`,
        label: session.name ?? session.id,
        ...(session.name ? { detail: session.id } : {}),
        kind: 'session',
        ...resumeRouting(inventory, {
          action: 'openSession',
          specId: stage.specId,
          sessionFile: session.file,
        }),
      })),
    };
  }

  return buildHomeSelectionView(inventory, options);
}

export function selectWorkspaceSelectionOption(
  view: WorkspaceSelectionView,
  index: number,
  inventory?: WorkspaceLaunchInventory,
  options: WorkspaceSelectionViewOptions = {},
): WorkspaceSelectionResult {
  const option = view.options[index];
  if (!option) return { decision: { action: 'cancel' } };
  if (option.decision) return { decision: option.decision };
  const nextStage = option.nextStage ?? { stage: 'home' };
  if (!inventory) {
    return { view: stageOnlyView(nextStage), stage: nextStage };
  }
  return {
    view: buildWorkspaceSelectionView(inventory, nextStage, options),
    stage: nextStage,
  };
}

function stageOnlyView(stage: WorkspaceSelectionStage): WorkspaceSelectionView {
  return {
    stage: stage.stage,
    title: 'title' in stage ? stage.title : '',
    ...('specId' in stage ? { specId: stage.specId } : {}),
    options: [],
  };
}

function buildHomeSelectionView(
  inventory: WorkspaceLaunchInventory,
  viewOptions: WorkspaceSelectionViewOptions,
): WorkspaceSelectionView {
  const selectionOptions: WorkspaceSelectionOption[] = [];
  const currentSession = findCurrentSession(inventory);

  if (viewOptions.includeContinue !== false && currentSession && inventory.currentSpec) {
    selectionOptions.push({
      id: `continue:${currentSession.file}`,
      label: 'Continue your latest spec and session',
      detail: `${inventory.currentSpec.title} · ${currentSession.id}`,
      kind: 'continue',
      ...resumeRouting(inventory, {
        action: 'continue',
        specId: inventory.currentSpec.id,
        sessionFile: currentSession.file,
      }),
    });
  }

  const newSpecOption: WorkspaceSelectionOption = {
    id: 'new-spec',
    label: 'Start a new specification',
    kind: 'newSpec',
    nextStage: { stage: 'newSpecTitle', title: '' },
  };
  const resumeSpecOption: WorkspaceSelectionOption | null =
    inventory.specs.length > 0
      ? {
          id: 'resume-spec',
          label:
            viewOptions.includeContinue === false
              ? 'Switch to another specification'
              : 'Continue another existing specification',
          kind: 'resumeSpec',
          nextStage: { stage: 'specList' },
        }
      : null;
  const cancelOption: WorkspaceSelectionOption = {
    id: 'cancel',
    label: 'Cancel',
    kind: 'cancel',
    decision: { action: 'cancel' },
  };

  if (viewOptions.includeContinue === false) {
    if (resumeSpecOption) selectionOptions.push(resumeSpecOption);
    selectionOptions.push(newSpecOption, cancelOption);
  } else {
    if (resumeSpecOption) selectionOptions.push(resumeSpecOption);
    selectionOptions.push(newSpecOption, cancelOption);
  }

  return {
    stage: 'home',
    title: 'Choose a specification',
    options: selectionOptions,
  };
}

function findCurrentSession(inventory: WorkspaceLaunchInventory): WorkspaceLaunchSession | undefined {
  if (!inventory.currentSessionFile) {
    return undefined;
  }
  for (const spec of inventory.specs) {
    const session = spec.sessions.find((candidate) => candidate.file === inventory.currentSessionFile);
    if (session) {
      return session;
    }
  }
  return undefined;
}

function findSpec(
  inventory: WorkspaceLaunchInventory,
  specId: number,
): WorkspaceLaunchInventory['specs'][number] | undefined {
  return inventory.specs.find((candidate) => candidate.spec.id === specId);
}
