import type { ExtensionCommandContext, ExtensionContext } from '@earendil-works/pi-coding-agent';

import { selectedSessionProductUpdates, type ProductUpdatePublisher } from '../../../rpc/product-updates.js';
import {
  type WorkspaceSessionReadyState,
  type SpecSessionActivationCoordinator,
  type SpecSessionActivationDecision,
} from '../../../session/workspace-session-coordinator.js';
import {
  WORKSPACE_DIALOG_WIDTH,
  createWorkspaceDialogComponent,
} from '../../components/workspace-dialog/index.js';
import { chromeStateForWorkspace, renderBrunchChrome } from '../chrome/index.js';

export interface BrunchSpecSessionPickerOptions {
  coordinator: SpecSessionActivationCoordinator;
  /**
   * Shared product-update publisher. TUI-driven spec/session switches publish
   * the same `selectedSessionProductUpdates` payload as the RPC
   * `workspace.activate` handler, so attached web sidecars learn that
   * workspace defaults changed (SPEC assumption 12 corollary).
   */
  productUpdates?: ProductUpdatePublisher;
}

/**
 * Context accepted by the workspace picker action. Command contexts carry
 * `waitForIdle`/`switchSession`; Pi shortcut contexts do not, so both are
 * optional and the action degrades gracefully (no idle wait; cross-session
 * switches warn instead of switching).
 */
export type BrunchWorkspaceActionContext = ExtensionContext &
  Partial<Pick<ExtensionCommandContext, 'waitForIdle' | 'switchSession'>>;

export async function runBrunchWorkspaceCommand(
  ctx: ExtensionCommandContext,
  coordinator: SpecSessionActivationCoordinator,
): Promise<void> {
  await runBrunchWorkspaceAction(ctx, coordinator);
}

export async function runBrunchWorkspaceAction(
  ctx: BrunchWorkspaceActionContext,
  coordinator: SpecSessionActivationCoordinator,
  options: { waitForIdle?: boolean; productUpdates?: ProductUpdatePublisher } = {},
): Promise<void> {
  if (options.waitForIdle !== false && canWaitForIdle(ctx)) {
    await ctx.waitForIdle();
  }
  if (!canShowWorkspaceDialog(ctx)) {
    ctx.ui.notify('Spec/session switch requires interactive UI.', 'warning');
    return;
  }
  const inventory = await coordinator.inspectWorkspace();
  const decision = await ctx.ui.custom!<SpecSessionActivationDecision>(
    (_tui, theme, _keybindings, done) =>
      createWorkspaceDialogComponent({
        inventory,
        theme,
        onDecision: done,
        includeContinue: false,
      }),
    {
      overlay: true,
      overlayOptions: {
        anchor: 'center',
        width: WORKSPACE_DIALOG_WIDTH,
        maxHeight: '90%',
        margin: 1,
      },
    },
  );
  const activated = await coordinator.activateWorkspace(decision);

  if (activated.status === 'cancelled') {
    ctx.ui.notify('Spec/session switch cancelled.', 'info');
    return;
  }
  if (activated.status === 'needs_human') {
    ctx.ui.notify(activated.reason, 'warning');
    return;
  }

  // Workspace defaults changed (activateWorkspace wrote them); notify attached
  // sidecars regardless of whether the Pi-level session switch below succeeds.
  options.productUpdates?.publish(
    selectedSessionProductUpdates({ specId: activated.spec.id, sessionId: activated.session.id }),
  );

  await switchToActivatedWorkspace(ctx, activated);
}

function canWaitForIdle(
  ctx: BrunchWorkspaceActionContext,
): ctx is BrunchWorkspaceActionContext & { waitForIdle: () => Promise<void> } {
  return typeof ctx.waitForIdle === 'function';
}

function canShowWorkspaceDialog(ctx: BrunchWorkspaceActionContext): boolean {
  return ctx.hasUI !== false && typeof ctx.ui.custom === 'function';
}

async function switchToActivatedWorkspace(
  ctx: BrunchWorkspaceActionContext,
  activated: WorkspaceSessionReadyState,
): Promise<void> {
  if (typeof ctx.switchSession !== 'function') {
    ctx.ui.notify(
      'Use /brunch:spec-menu to switch specs or sessions; this Pi context cannot switch sessions.',
      'warning',
    );
    return;
  }
  const targetFile = activated.session.file;
  if (ctx.sessionManager.getSessionFile() === targetFile) {
    renderBrunchChrome(ctx.ui, chromeStateForWorkspace(activated));
    ctx.ui.notify('Already using the selected Brunch spec/session.', 'info');
    return;
  }

  const targetSessionId = activated.session.id;
  const targetSpecTitle = activated.spec.title;
  const targetChrome = chromeStateForWorkspace(activated);

  const result = await ctx.switchSession(targetFile, {
    withSession: async (replacementCtx) => {
      renderBrunchChrome(replacementCtx.ui, targetChrome);
      replacementCtx.ui.notify(
        `Switched Brunch spec/session to ${targetSpecTitle} (${targetSessionId}).`,
        'info',
      );
    },
  });

  if (result.cancelled) {
    ctx.ui.notify('Spec/session switch was cancelled by Pi.', 'warning');
  }
}
