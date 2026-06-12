import type { ExtensionCommandContext, ExtensionContext } from '@earendil-works/pi-coding-agent';

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
  options: { waitForIdle?: boolean } = {},
): Promise<void> {
  if (options.waitForIdle !== false && canWaitForIdle(ctx)) {
    await ctx.waitForIdle();
  }
  const inventory = await coordinator.inspectWorkspace();
  const decision = await ctx.ui.custom<SpecSessionActivationDecision>(
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

  await switchToActivatedWorkspace(ctx, activated);
}

function canWaitForIdle(
  ctx: BrunchWorkspaceActionContext,
): ctx is BrunchWorkspaceActionContext & { waitForIdle: () => Promise<void> } {
  return typeof ctx.waitForIdle === 'function';
}

async function switchToActivatedWorkspace(
  ctx: BrunchWorkspaceActionContext,
  activated: WorkspaceSessionReadyState,
): Promise<void> {
  if (typeof ctx.switchSession !== 'function') {
    ctx.ui.notify(
      'Use /brunch:switch to switch specs or sessions; this Pi context cannot switch sessions.',
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
