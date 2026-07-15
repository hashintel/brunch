import {
  runSubagent as defaultRunSubagent,
  type BrunchSubagentsDeps,
  type SubagentRunContext,
} from '../.pi/extensions/subagents/index.js';
import type { PlannerPort } from '../executor/execution-ports.js';

export interface PlannerPortOptions {
  readonly subagents?: BrunchSubagentsDeps;
  readonly cwd?: string;
}

export function createPlannerPort(options: PlannerPortOptions = {}): PlannerPort {
  return {
    async synthesize(args) {
      const subagents = options.subagents;
      if (!subagents) {
        return {
          status: 'failed',
          message:
            'PlannerPort has no subagent deps injected in this launch, so the sealed planner cannot run.',
        };
      }
      const planner = subagents.definitions.get('planner');
      if (!planner) {
        return { status: 'failed', message: 'PlannerPort planner definition is not loaded.' };
      }
      if (!args.runtime?.modelRegistry) {
        return { status: 'failed', message: 'PlannerPort requires Pi model context to launch the planner.' };
      }
      const runSubagent = subagents.runSubagent ?? defaultRunSubagent;
      const result = await runSubagent({
        definition: planner,
        task: renderPlannerTask(args),
        ctx: {
          cwd: options.cwd ?? '.',
          modelRegistry: args.runtime.modelRegistry,
          model: args.runtime.model,
          signal: args.runtime.signal,
        } as SubagentRunContext,
        deps: subagents,
      });
      if (result.status === 'error') {
        return { status: 'failed', message: result.text };
      }
      return { status: 'synthesized', candidate: extractCandidateText(result.text) };
    },
  };
}

function renderPlannerTask(args: {
  readonly projection: unknown;
  readonly capabilityVocabulary?: readonly string[];
  readonly findings?: readonly { readonly code: string; readonly message: string }[];
  readonly priorCandidate?: unknown;
}): string {
  return [
    'Planning projection (approved specification truth):',
    JSON.stringify(args.projection, null, 2),
    '',
    `Supported capability ids: ${
      args.capabilityVocabulary && args.capabilityVocabulary.length > 0
        ? args.capabilityVocabulary.join(', ')
        : 'none'
    }`,
    'Use a supported id only when it genuinely matches the committed stack. If no supported id matches, emit a descriptive id (e.g. rust.cargo-test) — it will surface as an explicit blocked requirement, which is correct. Never map a commitment onto a supported id from a different ecosystem.',
    ...(args.findings && args.findings.length > 0
      ? [
          '',
          'Your prior candidate failed validation. Findings:',
          ...args.findings.map((finding) => `- ${finding.code}: ${finding.message}`),
          '',
          'Prior candidate:',
          JSON.stringify(args.priorCandidate ?? null, null, 2),
          '',
          'Return the full corrected candidate JSON.',
        ]
      : ['', 'Return the candidate JSON.']),
  ].join('\n');
}

// Models occasionally wrap the JSON in prose or fences; recover the outermost object
// deterministically and let parseCandidatePlan fail closed on anything else.
function extractCandidateText(text: string): string {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1 || end < start) return text;
  return text.slice(start, end + 1);
}
