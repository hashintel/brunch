import {
  SessionManager,
  type ExtensionAPI,
} from "@earendil-works/pi-coding-agent"

export type BrunchSessionBoundaryHandler = (
  sessionManager: SessionManager,
) => Promise<void> | void

export async function bindBrunchSessionBoundary(
  sessionManager: SessionManager,
  onSessionBoundary?: BrunchSessionBoundaryHandler,
): Promise<void> {
  await onSessionBoundary?.(sessionManager)
}

export function registerBrunchSessionBoundaryRefreshHandlers(
  pi: ExtensionAPI,
  onSessionBoundary?: BrunchSessionBoundaryHandler,
): void {
  pi.on("before_agent_start", async (_event, ctx) => {
    await bindBrunchSessionBoundary(
      ctx.sessionManager as SessionManager,
      onSessionBoundary,
    )
  })
  pi.on("message_start", async (event, ctx) => {
    if (event.message.role === "assistant") {
      await bindBrunchSessionBoundary(
        ctx.sessionManager as SessionManager,
        onSessionBoundary,
      )
    }
  })
}

export const brunchExtensionMeta = {
  productStatus: "ready",
  loadOrder: 10,
} as const

export function registerBrunchProductExtension(
  pi: ExtensionAPI,
  context: { onSessionBoundary?: BrunchSessionBoundaryHandler },
): void {
  pi.on("session_start", async (_event, ctx) => {
    await bindBrunchSessionBoundary(
      ctx.sessionManager as SessionManager,
      context.onSessionBoundary,
    )
  })
  registerBrunchSessionBoundaryRefreshHandlers(pi, context.onSessionBoundary)
}

export default registerBrunchSessionBoundaryRefreshHandlers
