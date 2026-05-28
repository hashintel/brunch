import { runCompiledOrchestrator } from './engine-run.js';
import type { Orchestrator, OrchestratorInput, OrchestratorResult } from './types.js';

// ---------------------------------------------------------------------------
// PetriOrchestrator — compiled net; serial in Phase 0, parallel in Phase 2.
// ---------------------------------------------------------------------------

export class PetriOrchestrator implements Orchestrator {
  run(input: OrchestratorInput): Promise<OrchestratorResult> {
    // Phase 2: switch to 'parallel' once the interpreter supports it.
    return runCompiledOrchestrator(input, 'serial');
  }
}
