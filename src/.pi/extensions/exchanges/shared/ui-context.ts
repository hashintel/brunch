import type { EntryLike } from '../../../../exchanges/recovery.js';
import type { LabTheme } from '../../../components/tui-lab/index.js';

/**
 * The slice of the Pi tool `ctx` the structured-exchange response collectors
 * use. One shared structural type so request_response casts the runtime ctx
 * once at the boundary and every collector (answer / choice / choices / review)
 * reads the same surface — no per-source ctx interface drift, no `as unknown`
 * double-cast. `sessionManager.getBranch` is the production transcript seam
 * (the same one brunch_session_query reads).
 */
export interface StructuredExchangeUiContext {
  readonly hasUI?: boolean;
  readonly ui?: {
    readonly editor?: (prompt: string) => Promise<string | undefined>;
    readonly select?: (prompt: string, choices: readonly string[]) => Promise<string | undefined>;
    readonly input?: (prompt: string, placeholder?: string) => Promise<string | undefined>;
    readonly custom?: <T>(
      factory: (tui: unknown, theme: LabTheme, keybindings: unknown, done: (result: T) => void) => unknown,
      options?: unknown,
    ) => Promise<T>;
    readonly setWorkingVisible?: (visible: boolean) => void;
  };
  readonly sessionManager?: {
    readonly getBranch: () => readonly EntryLike[];
  };
}

/**
 * Hide the streaming "Working..." status indicator while a collector blocks
 * on user input, restoring it afterwards. The indicator's spinner requests a
 * re-render every animation frame, and those repeated terminal writes snap
 * scrollback to the bottom — locking the user out of re-reading the material
 * they are being asked about. While the turn waits on the user there is no
 * work to indicate; pi re-shows the indicator only if the session is still
 * streaming when restored.
 */
export async function withWorkingIndicatorHidden<T>(
  ctx: StructuredExchangeUiContext,
  collect: () => Promise<T>,
): Promise<T> {
  ctx.ui?.setWorkingVisible?.(false);
  try {
    return await collect();
  } finally {
    ctx.ui?.setWorkingVisible?.(true);
  }
}
