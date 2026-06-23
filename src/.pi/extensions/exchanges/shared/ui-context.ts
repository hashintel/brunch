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
  };
  readonly sessionManager?: {
    readonly getBranch: () => readonly EntryLike[];
  };
}
