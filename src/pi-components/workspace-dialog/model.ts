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
      label: `Start new session in ${spec.title}`,
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
        label: `Open ${spec.title}`,
        description: sessionDescription(session, "Open existing session"),
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
    label: "Create workspace",
    description: "Name a new specification workspace",
    kind: "newSpec",
  })
  options.push({
    id: "cancel",
    label: "Cancel",
    description: "Exit without opening a Brunch workspace",
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

function sessionDescription(
  session: WorkspaceLaunchSession,
  prefix: string,
): string {
  return `${prefix} · ${session.id}`
}
