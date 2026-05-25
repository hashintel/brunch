import { runCompiledOrchestrator } from './engine-run.js';
import type { Orchestrator, OrchestratorInput, OrchestratorResult } from './types.js';

// ---------------------------------------------------------------------------
// ProceduralOrchestrator — compiled net with serial firing policy.
// Phase 2 keeps proc serial while petri gains parallel concurrency.
// ---------------------------------------------------------------------------

export class ProceduralOrchestrator implements Orchestrator {
  run(input: OrchestratorInput): Promise<OrchestratorResult> {
    return runCompiledOrchestrator(input, 'serial');
  }
}
