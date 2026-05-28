import type {
  WorkspaceLaunchInventory,
  WorkspaceLaunchSession,
  SpecSessionActivationDecision,
} from "../../../../workspace-session-coordinator.js"

export type WorkspaceSelectionStage = { stage: "home" } | {
  stage: "newSpecTitle"
  title: string
} | { stage: "specList" } | {
  stage: "specAction"
  specId: string
} | {
  stage: "sessionList"
  specId: string
}

export interface WorkspaceSelectionOption {
  id: string
  label: string
  description: string
  kind: "continue" | "newSpec" | "resumeSpec" | "cancel" | "spec" | "newSession" | "resumeSession" | "session"
  decision?: SpecSessionActivationDecision
  nextStage?: WorkspaceSelectionStage
}

export interface WorkspaceSelectionView {
  stage: WorkspaceSelectionStage["stage"]
  title: string
  options: WorkspaceSelectionOption[]
  specId?: string
}

export interface WorkspaceSelectionViewOptions {
  includeContinue?: boolean
}

export type WorkspaceSelectionResult = {
  decision: SpecSessionActivationDecision
} | {
  view: WorkspaceSelectionView
}

export function buildWorkspaceSelectionView(
  inventory: WorkspaceLaunchInventory,
  stage: WorkspaceSelectionStage = { stage: "home" },
  options: WorkspaceSelectionViewOptions = {},
): WorkspaceSelectionView {
  if (stage.stage === "newSpecTitle") {
    return {
      stage: "newSpecTitle",
      title: "Create new specification",
      options: [],
    }
  }

  if (stage.stage === "specList") {
    return {
      stage: "specList",
      title: "Choose a specification",
      options: inventory.specs.map(({ spec }) => ({
        id: `spec:${spec.id}`,
        label: spec.title,
        description: "Choose how to continue this specification",
        kind: "spec",
        nextStage: { stage: "specAction", specId: spec.id },
      })),
    }
  }

  if (stage.stage === "specAction") {
    const spec = findSpec(inventory, stage.specId)
    const options: WorkspaceSelectionOption[] = [
      {
        id: `new-session:${stage.specId}`,
        label: "Create new session",
        description: "Start a binding-only session for this specification",
        kind: "newSession",
        decision: { action: "newSession", specId: stage.specId },
      },
    ]
    if ((spec?.sessions.length ?? 0) > 0) {
      options.push({
        id: `resume-session:${stage.specId}`,
        label: "Resume existing session",
        description: "Choose a prior session transcript explicitly",
        kind: "resumeSession",
        nextStage: { stage: "sessionList", specId: stage.specId },
      })
    }
    return {
      stage: "specAction",
      specId: stage.specId,
      title: spec ? `Continue ${spec.spec.title}` : "Continue specification",
      options,
    }
  }

  if (stage.stage === "sessionList") {
    const spec = findSpec(inventory, stage.specId)
    return {
      stage: "sessionList",
      specId: stage.specId,
      title: spec
        ? `Choose a session for ${spec.spec.title}`
        : "Choose a session",
      options: (spec?.sessions ?? []).map((session) => ({
        id: `session:${session.file}`,
        label: session.name ?? session.id,
        description: sessionDescription(session, "Open existing session"),
        kind: "session",
        decision: {
          action: "openSession",
          specId: stage.specId,
          sessionFile: session.file,
        },
      })),
    }
  }

  return buildHomeSelectionView(inventory, options)
}

export function selectWorkspaceSelectionOption(
  view: WorkspaceSelectionView,
  index: number,
  inventory?: WorkspaceLaunchInventory,
  options: WorkspaceSelectionViewOptions = {},
): WorkspaceSelectionResult {
  const option = view.options[index]
  if (!option) return { decision: { action: "cancel" } }
  if (option.decision) return { decision: option.decision }
  if (!inventory) {
    return { view: stageOnlyView(option.nextStage ?? { stage: "home" }) }
  }
  return {
    view: buildWorkspaceSelectionView(inventory, option.nextStage, options),
  }
}

function stageOnlyView(stage: WorkspaceSelectionStage): WorkspaceSelectionView {
  return {
    stage: stage.stage,
    title: stage.stage === "newSpecTitle" ? stage.title : "",
    ...("specId" in stage ? { specId: stage.specId } : {}),
    options: [],
  }
}

function buildHomeSelectionView(
  inventory: WorkspaceLaunchInventory,
  viewOptions: WorkspaceSelectionViewOptions,
): WorkspaceSelectionView {
  const selectionOptions: WorkspaceSelectionOption[] = []
  const currentSession = findCurrentSession(inventory)

  if (
    viewOptions.includeContinue !== false &&
    currentSession &&
    inventory.currentSpec
  ) {
    selectionOptions.push({
      id: `continue:${currentSession.file}`,
      label: "Continue your latest spec and session",
      description: `${inventory.currentSpec.title} · ${currentSession.id}`,
      kind: "continue",
      decision: {
        action: "continue",
        specId: inventory.currentSpec.id,
        sessionFile: currentSession.file,
      },
    })
  }

  const newSpecOption: WorkspaceSelectionOption = {
    id: "new-spec",
    label: "Start a new specification",
    description: "Name a new spec and create its first session",
    kind: "newSpec",
    nextStage: { stage: "newSpecTitle", title: "" },
  }
  const resumeSpecOption: WorkspaceSelectionOption | null =
    inventory.specs.length > 0
      ? {
          id: "resume-spec",
          label:
            viewOptions.includeContinue === false
              ? "Switch to another specification"
              : "Continue another existing specification",
          description: "Choose a spec, then create or resume a session",
          kind: "resumeSpec",
          nextStage: { stage: "specList" },
        }
      : null
  const cancelOption: WorkspaceSelectionOption = {
    id: "cancel",
    label: "Cancel",
    description: "Exit without activating a spec/session",
    kind: "cancel",
    decision: { action: "cancel" },
  }

  if (viewOptions.includeContinue === false) {
    if (resumeSpecOption) selectionOptions.push(resumeSpecOption)
    selectionOptions.push(newSpecOption, cancelOption)
  } else {
    if (resumeSpecOption) selectionOptions.push(resumeSpecOption)
    selectionOptions.push(newSpecOption, cancelOption)
  }

  return {
    stage: "home",
    title: "Choose a specification",
    options: selectionOptions,
  }
}

function findCurrentSession(
  inventory: WorkspaceLaunchInventory,
): WorkspaceLaunchSession | undefined {
  if (!inventory.currentSessionFile) {
    return undefined
  }
  for (const spec of inventory.specs) {
    const session = spec.sessions.find(
      (candidate) => candidate.file === inventory.currentSessionFile,
    )
    if (session) {
      return session
    }
  }
  return undefined
}

function findSpec(
  inventory: WorkspaceLaunchInventory,
  specId: string,
): WorkspaceLaunchInventory["specs"][number] | undefined {
  return inventory.specs.find((candidate) => candidate.spec.id === specId)
}

function sessionDescription(
  session: WorkspaceLaunchSession,
  prefix: string,
): string {
  return `${prefix} · ${session.id}`
}
