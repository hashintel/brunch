import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { Type, type Static } from 'typebox';

import {
  assertExecuteProjectionPlanReady,
  projectExecuteGraph,
} from '../../../../executor/execute-projection.js';
import type { PlannerPort } from '../../../../executor/execution-ports.js';
import { extractSpecRecipe } from '../../../../executor/execution-recipe.js';
import { writePlanFile } from '../../../../executor/plan-file.js';
import { previewPlan, type PlanPreview } from '../../../../executor/plan-preview.js';
import { synthesizePlan, type SynthesisRound } from '../../../../executor/plan-synthesis.js';
import type { PlanValidationFinding } from '../../../../executor/plan-validation.js';
import { projectPlanningInput } from '../../../../executor/planning-projection.js';
import { detectWorkspaceCapabilities } from '../../../../executor/workspace-detection.js';
import { BRUNCH_EXECUTE_PLAN_FILE_TOOL } from '../../../../session/schema/tool-names.js';
import type { GraphReaders } from '../../brunch-data/graph/index.js';
import { defineBrunchTool } from '../../shared/define-brunch-tool.js';
import { toolParameters } from '../../shared/tool-schema.js';

export { BRUNCH_EXECUTE_PLAN_FILE_TOOL } from '../../../../session/schema/tool-names.js';

const ExecutePlanFileParams = Type.Object({
  mode: Type.Optional(
    Type.Union([Type.Literal('greenfield'), Type.Literal('brownfield')], {
      description:
        'Execution mode carried onto the cook plan file. Defaults to greenfield until spec mode is modeled on alpha.',
    }),
  ),
});

type ExecutePlanFileParams = Static<typeof ExecutePlanFileParams>;

type ExecutePlanFileDetails =
  | {
      readonly preview: PlanPreview;
      readonly artifact: {
        readonly path: string;
        readonly provenancePath: string;
        readonly writeMode: 'overwrite';
      };
      readonly source: { readonly graphLsn: number; readonly visibility: 'active' };
      readonly synthesis?: { readonly rounds: number };
      readonly sideEffects: readonly { readonly kind: 'write_file'; readonly path: string }[];
    }
  | {
      readonly blocked: {
        readonly findings: readonly PlanValidationFinding[];
        readonly history: readonly SynthesisRound[];
      };
      readonly sideEffects: readonly [];
    };

export interface ExecutePlanFileDeps {
  readonly specId: number;
  readonly reads: Pick<GraphReaders, 'queryGraph'>;
  readonly planner?: PlannerPort;
}

export function createExecutePlanFileTool(deps: ExecutePlanFileDeps) {
  return defineBrunchTool<typeof ExecutePlanFileParams, ExecutePlanFileDetails>({
    name: BRUNCH_EXECUTE_PLAN_FILE_TOOL,
    label: 'execute_plan_file',
    description:
      'Write an old-cook-compatible plan.yaml under .brunch/cook/specs/<specId>. Does not create cook runs or worktrees.',
    parameters: toolParameters(ExecutePlanFileParams),
    async execute(_toolCallId, params, signal, _onUpdate, ctx) {
      const cwd = ctx?.cwd;
      if (typeof cwd !== 'string' || cwd.trim().length === 0) {
        throw new Error('execute_plan_file requires an active cwd');
      }
      const graph = deps.reads.queryGraph(undefined, { visibility: 'active' });
      const mode = params.mode ?? 'greenfield';
      const detected = mode === 'brownfield' ? await detectWorkspaceCapabilities(cwd) : [];
      const projection = projectExecuteGraph({
        specId: deps.specId,
        mode,
        graphLsn: graph.lsn,
        nodes: graph.nodes,
        edges: graph.edges,
        detectedCapabilities: detected,
      });
      assertExecuteProjectionPlanReady(projection);
      const modelRegistry = (ctx as { modelRegistry?: unknown } | undefined)?.modelRegistry;
      if (!deps.planner || !modelRegistry) {
        const findings = deterministicContractFindings(projection.executionContract);
        if (findings.length > 0) return blockedPlanResult(findings);
      }
      let preview = projection.planPreview;
      let synthesisRounds: number | undefined;
      let plannerNote: string | undefined;
      if (deps.planner && !modelRegistry) {
        // Explicit, labeled fallback: a planner that cannot run (no model context) is not
        // an invalid model plan — invalid candidates still block with findings below.
        plannerNote = 'planner unavailable (no model context); deterministic lowering used';
      } else if (deps.planner) {
        const planningInput = projectPlanningInput(projection.snapshot);
        const recipe = extractSpecRecipe(planningInput.commitments);
        if (recipe.issues.length > 0) {
          return {
            content: [
              {
                type: 'text' as const,
                text: [
                  'execute_plan_file: plan_synthesis_blocked',
                  ...recipe.issues.map(
                    (issue) => `- malformed_recipe: ${issue.itemId}: ${issue.line} — ${issue.reason}`,
                  ),
                  'No plan was written. Fix the execute.* recipe lines in the spec.',
                ].join('\n'),
              },
            ],
            details: {
              blocked: {
                findings: recipe.issues.map((issue) => ({
                  code: 'capability_unsupported' as const,
                  severity: 'error' as const,
                  itemId: issue.itemId,
                  message: `${issue.line} — ${issue.reason}`,
                })),
                history: [],
              },
              sideEffects: [],
            },
          };
        }
        const synthesis = await synthesizePlan({
          projection: planningInput,
          detected,
          providers: recipe.provider ? [recipe.provider] : [],
          ...(recipe.required.length > 0 ? { baseRequired: recipe.required } : {}),
          planner: deps.planner,
          runtime: {
            modelRegistry,
            model: (ctx as { model?: unknown } | undefined)?.model,
            signal,
          },
        });
        if (synthesis.status === 'blocked') {
          return {
            content: [
              {
                type: 'text' as const,
                text: [
                  'execute_plan_file: plan_synthesis_blocked',
                  ...synthesis.findings.map((finding) => `- ${finding.code}: ${finding.message}`),
                  `repair rounds exhausted: ${synthesis.history.length}`,
                  'No plan was written. Resolve the findings or replan.',
                ].join('\n'),
              },
            ],
            details: {
              blocked: { findings: synthesis.findings, history: synthesis.history },
              sideEffects: [],
            },
          };
        }
        preview = previewPlan(synthesis.draft, { executionContract: synthesis.executionContract });
        synthesisRounds = synthesis.history.length;
      }
      const artifact = await writePlanFile({ cwd, preview, source: projection.source });
      return {
        content: [
          {
            type: 'text' as const,
            text: [
              `execute_plan_file: ${artifact.path}`,
              `epics: ${preview.epics.length}`,
              `slices: ${preview.slices.length}`,
              ...(synthesisRounds === undefined ? [] : [`synthesis rounds: ${synthesisRounds}`]),
              ...(plannerNote === undefined ? [] : [plannerNote]),
              `graph lsn: ${graph.lsn}`,
              `side effects: ${artifact.sideEffects.map((effect) => effect.kind).join(', ')}`,
            ].join('\n'),
          },
        ],
        details: {
          preview,
          artifact: {
            path: artifact.path,
            provenancePath: artifact.provenancePath,
            writeMode: artifact.writeMode,
          },
          source: projection.source,
          ...(synthesisRounds === undefined ? {} : { synthesis: { rounds: synthesisRounds } }),
          sideEffects: artifact.sideEffects,
        },
      };
    },
  });
}

function deterministicContractFindings(
  contract: ReturnType<typeof projectExecuteGraph>['executionContract'],
): readonly PlanValidationFinding[] {
  return [
    ...contract.blocked.map((entry) => ({
      code: 'capability_unsupported' as const,
      severity: 'error' as const,
      ...(entry.source.kind === 'elicited' ? { itemId: entry.source.itemId } : {}),
      message: entry.message ?? `Capability ${entry.id} is blocked (${entry.reason}).`,
    })),
    ...contract.conflicts.map((conflict) => ({
      code: 'capability_conflict' as const,
      severity: 'error' as const,
      itemId: conflict.requiredId,
      message: conflict.message,
    })),
    ...(contract.resolvedActions.verify.length === 0
      ? [
          {
            code: 'no_verification_capability' as const,
            severity: 'error' as const,
            message:
              'No authored execute.verify recipe resolves a verification action; settle an oracle/vv_method named Project execution harness with one plain execute.verify command.',
          },
        ]
      : []),
  ];
}

function blockedPlanResult(findings: readonly PlanValidationFinding[]) {
  return {
    content: [
      {
        type: 'text' as const,
        text: [
          'execute_plan_file: plan_synthesis_blocked',
          ...findings.map((finding) => `- ${finding.code}: ${finding.message}`),
          'No plan was written. Add or repair execute.* recipe lines on the settled Project execution harness V&V method.',
        ].join('\n'),
      },
    ],
    details: { blocked: { findings, history: [] }, sideEffects: [] as const },
  };
}

export function registerBrunchExecutePlanFile(pi: ExtensionAPI, deps: ExecutePlanFileDeps): void {
  pi.registerTool(createExecutePlanFileTool(deps) as never);
}

export default registerBrunchExecutePlanFile;
