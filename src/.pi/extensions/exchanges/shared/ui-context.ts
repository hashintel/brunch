import type { LabTheme } from '../../../components/tui-lab/index.js';
import type { EntryLike } from './recovery.js';

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
  };
  readonly sessionManager?: {
    readonly getBranch: () => readonly EntryLike[];
  };
}
