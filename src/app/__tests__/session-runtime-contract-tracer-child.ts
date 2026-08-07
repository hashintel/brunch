/**
 * Child entry for the production TUI PTY witness.
 *
 * It calls the real `runBrunchTui` with **no** `launchInteractive` override, so
 * the default `launchPiInteractive` path builds the sealed Brunch runtime and a
 * real Pi `InteractiveMode`. Exactly three things are test-owned: which
 * workspace is activated, the provider backend behind `agentServices`, and the
 * single JSON report that hands sidecar URL and readiness back to the parent.
 * Everything else — writer authority, sidecar composition, extension binding,
 * origination choreography, JSONL truth — is production wiring.
 *
 * usage: node --import tsx session-runtime-contract-tracer-child.ts <cwd> <reportPath>
 */

import { writeFile } from 'node:fs/promises';
import process from 'node:process';

import { fauxAssistantMessage } from '@earendil-works/pi-ai';
import { registerFauxProvider } from '@earendil-works/pi-ai/compat';

import { createBrunchFauxModelRuntime, defaultBrunchFauxModel } from '../../probes/faux-provider.js';
import { runBrunchTui } from '../brunch-tui.js';
import {
  TRACER_OPENING_REPLY,
  TRACER_PROBE_PROMPT,
  TRACER_PROBE_REPLY,
  TRACER_SPEC_TITLE,
  type ProductionTracerReport,
} from './session-runtime-contract-tracer-support.js';

/**
 * Enough queued steps to cover the product's opening turn, the parent's
 * ordinary turn, and any extra provider call the composition makes; every step
 * is the same content-addressed responder, so ordering cannot make the witness
 * pass by accident.
 */
const QUEUED_RESPONSES = 8;

const [cwd, reportPath] = process.argv.slice(2);
if (!cwd || !reportPath) {
  throw new Error('session-runtime-contract-tracer-child requires <cwd> <reportPath>');
}

async function report(next: ProductionTracerReport): Promise<void> {
  await writeFile(reportPath!, `${JSON.stringify(next, null, 2)}\n`);
}

const fauxModel = defaultBrunchFauxModel();
const provider = registerFauxProvider({
  provider: fauxModel.provider,
  api: `${fauxModel.api}-production-pty`,
  models: [{ id: fauxModel.modelId, name: fauxModel.modelName, input: ['text'] }],
});
provider.setResponses(
  Array.from(
    { length: QUEUED_RESPONSES },
    () => (context: unknown) =>
      fauxAssistantMessage(
        JSON.stringify(context).includes(TRACER_PROBE_PROMPT) ? TRACER_PROBE_REPLY : TRACER_OPENING_REPLY,
      ),
  ),
);
const { modelRuntime, registeredModel } = await createBrunchFauxModelRuntime(fauxModel, provider);

try {
  await runBrunchTui({
    cwd,
    agentServices: { modelRuntime, model: registeredModel },
    runWorkspaceDialogPreflight: async () => ({ action: 'newSpec', title: TRACER_SPEC_TITLE }),
    // File-based, because anything written to stdout would corrupt the PTY the
    // parent renders its assertions from.
    advertiseWebSidecar: (webSidecarUrl) => {
      void report({ status: 'ready', cwd, webSidecarUrl });
    },
  });
} catch (error) {
  await report({
    status: 'failed',
    cwd,
    error: error instanceof Error ? (error.stack ?? error.message) : String(error),
  });
  throw error;
} finally {
  provider.unregister();
}
