import type { ExtensionAPI } from "@earendil-works/pi-coding-agent"

export const BRUNCH_BRANCH_FLOW_BLOCKED_MESSAGE =
  "Brunch does not support Pi session branches in this POC. Use /new to continue within the selected spec."

export function registerBrunchBranchPolicyHandlers(pi: ExtensionAPI): void {
  pi.on("session_before_tree", (_event, ctx) => {
    ctx.ui.notify(BRUNCH_BRANCH_FLOW_BLOCKED_MESSAGE, "warning")
    return { cancel: true }
  })
  pi.on("session_before_fork", (_event, ctx) => {
    ctx.ui.notify(BRUNCH_BRANCH_FLOW_BLOCKED_MESSAGE, "warning")
    return { cancel: true }
  })
}

export default registerBrunchBranchPolicyHandlers
