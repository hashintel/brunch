import type {
  WorkspaceLaunchInventory,
  WorkspaceLaunchSession,
  WorkspaceSwitchDecision,
} from "../../workspace-session-coordinator.js"

export interface WorkspaceDialogOption {
  id: string
  label: string
  description: string
  kind: "continue" | "openSession" | "newSession" | "newSpec" | "cancel"
  decision?: WorkspaceSwitchDecision
}

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
  decision?: WorkspaceSwitchDecision
  nextStage?: WorkspaceSelectionStage
}

export interface WorkspaceSelectionView {
  stage: WorkspaceSelectionStage["stage"]
  title: string
  options: WorkspaceSelectionOption[]
  specId?: string
}

export type WorkspaceSelectionResult = { decision: WorkspaceSwitchDecision } | {
  view: WorkspaceSelectionView
}

export function buildWorkspaceSelectionView(
  inventory: WorkspaceLaunchInventory,
  stage: WorkspaceSelectionStage = { stage: "home" },
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
    return {
      stage: "specAction",
      specId: stage.specId,
      title: spec ? `Continue ${spec.spec.title}` : "Continue specification",
      options: [
        {
          id: `new-session:${stage.specId}`,
          label: "Create new session",
          description: "Start a binding-only session for this specification",
          kind: "newSession",
          decision: { action: "newSession", specId: stage.specId },
        },
        {
          id: `resume-session:${stage.specId}`,
          label: "Resume existing session",
          description: "Choose a prior session transcript explicitly",
          kind: "resumeSession",
          nextStage: { stage: "sessionList", specId: stage.specId },
        },
      ],
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

  return buildHomeSelectionView(inventory)
}

export function selectWorkspaceSelectionOption(
  view: WorkspaceSelectionView,
  index: number,
  inventory?: WorkspaceLaunchInventory,
): WorkspaceSelectionResult {
  const option = view.options[index]
  if (!option) return { decision: { action: "cancel" } }
  if (option.decision) return { decision: option.decision }
  if (!inventory) {
    return { view: stageOnlyView(option.nextStage ?? { stage: "home" }) }
  }
  return { view: buildWorkspaceSelectionView(inventory, option.nextStage) }
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
): WorkspaceSelectionView {
  const options: WorkspaceSelectionOption[] = []
  const currentSession = findCurrentSession(inventory)

  if (currentSession && inventory.currentSpec) {
    options.push({
      id: `continue:${currentSession.file}`,
      label: "Continue last session",
      description: `${inventory.currentSpec.title} · ${currentSession.id}`,
      kind: "continue",
      decision: {
        action: "continue",
        specId: inventory.currentSpec.id,
        sessionFile: currentSession.file,
      },
    })
  }

  options.push(
    {
      id: "new-spec",
      label: "Create new specification",
      description: "Name a new spec and create its first session",
      kind: "newSpec",
      nextStage: { stage: "newSpecTitle", title: "" },
    },
    {
      id: "resume-spec",
      label: "Resume existing specification",
      description: "Choose a spec, then create or resume a session",
      kind: "resumeSpec",
      nextStage: { stage: "specList" },
    },
    {
      id: "cancel",
      label: "Cancel",
      description: "Exit without activating a spec/session",
      kind: "cancel",
      decision: { action: "cancel" },
    },
  )

  return { stage: "home", title: "Choose a specification", options }
}

export function buildWorkspaceDialogOptions(
  inventory: WorkspaceLaunchInventory,
): WorkspaceDialogOption[] {
  const options: WorkspaceDialogOption[] = []
  const currentSession = findCurrentSession(inventory)

  if (currentSession && inventory.currentSpec) {
    options.push({
      id: `continue:${currentSession.file}`,
      label: `Continue ${inventory.currentSpec.title}`,
      description: sessionDescription(
        currentSession,
        "Resume selected session",
      ),
      kind: "continue",
      decision: {
        action: "continue",
        specId: inventory.currentSpec.id,
        sessionFile: currentSession.file,
      },
    })
  }

  for (const { spec, sessions } of inventory.specs) {
    options.push({
      id: `new-session:${spec.id}`,
      label: `Create new session for ${spec.title}`,
      description: "Create a binding-only session before Pi starts",
      kind: "newSession",
      decision: { action: "newSession", specId: spec.id },
    })

    for (const session of sessions) {
      if (session.file === currentSession?.file) {
        continue
      }
      options.push({
        id: `open:${session.file}`,
        label: `Resume ${spec.title}`,
        description: sessionDescription(session, "Resume existing session"),
        kind: "openSession",
        decision: {
          action: "openSession",
          specId: spec.id,
          sessionFile: session.file,
        },
      })
    }
  }

  options.push({
    id: "new-spec",
    label: "Create new specification",
    description: "Name a new spec and create its first session",
    kind: "newSpec",
  })
  options.push({
    id: "cancel",
    label: "Cancel",
    description: "Exit without activating a spec/session",
    kind: "cancel",
    decision: { action: "cancel" },
  })

  return options
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
