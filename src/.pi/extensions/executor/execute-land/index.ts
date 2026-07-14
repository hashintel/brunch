import { readdir } from 'node:fs/promises';
import { join } from 'node:path';

import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { Type, type Static } from 'typebox';

import type { GitHostLandPort } from '../../../../executor/execution-ports.js';
import {
  applyLanding,
  preflightLanding,
  type LandingApplyResult,
  type LandingPreflightResult,
} from '../../../../executor/landing.js';
import { readRunMetadata, runMetadataPath } from '../../../../executor/run.js';
import { BRUNCH_EXECUTE_LAND_PREFLIGHT_TOOL } from '../../../../session/schema/tool-names.js';
import { BRUNCH_LAND_COMMAND } from '../../commands/names.js';
import { defineBrunchTool } from '../../shared/define-brunch-tool.js';
import { toolParameters } from '../../shared/tool-schema.js';

export { BRUNCH_EXECUTE_LAND_PREFLIGHT_TOOL } from '../../../../session/schema/tool-names.js';

const ExecuteLandPreflightParams = Type.Object({ runId: Type.String() });
type ExecuteLandPreflightParams = Static<typeof ExecuteLandPreflightParams>;

interface ExecuteLandPreflightDetails {
  readonly result: LandingPreflightResult;
  readonly sideEffects: LandingPreflightResult['sideEffects'];
}

/** Read-only landing inspection for the agent. Host mutation is command-only. */
export function createExecuteLandPreflightTool() {
  return defineBrunchTool<typeof ExecuteLandPreflightParams, ExecuteLandPreflightDetails>({
    name: BRUNCH_EXECUTE_LAND_PREFLIGHT_TOOL,
    label: 'execute_land_preflight',
    description:
      'Inspect whether a promoted run is ready to land into the host. Read-only: landing itself is user-confirmed through /brunch:land and has no agent-callable tool.',
    parameters: toolParameters(ExecuteLandPreflightParams),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const cwd = ctx?.cwd;
      if (typeof cwd !== 'string' || cwd.trim().length === 0)
        throw new Error('execute_land_preflight requires an active cwd');
      const result = await preflightLanding({ cwd, runId: params.runId });
      return {
        content: [{ type: 'text' as const, text: renderPreflight(result) }],
        details: { result, sideEffects: result.sideEffects },
      };
    },
  });
}

/** The structural slice of Pi's command context the land flow needs. */
export interface LandCommandContext {
  readonly cwd: string;
  readonly hasUI: boolean;
  readonly ui: {
    confirm(title: string, message: string): Promise<boolean>;
    input(title: string, placeholder?: string): Promise<string | undefined>;
    notify(message: string, type?: 'info' | 'warning' | 'error'): void;
  };
}

export async function runBrunchLandCommand(
  args: string,
  ctx: LandCommandContext,
  deps: { readonly gitHostLand: GitHostLandPort },
): Promise<void> {
  if (!ctx.hasUI) {
    ctx.ui.notify('/brunch:land requires an interactive session to confirm the landing.', 'error');
    return;
  }
  const [runIdArg, targetArg] = args.trim().split(/\s+/).filter(Boolean);
  const runId = runIdArg ?? (await resolveSolePromotedRun(ctx));
  if (!runId) return;

  const preflight = await preflightLanding({ cwd: ctx.cwd, runId });
  if (preflight.status !== 'preflight_ready') {
    ctx.ui.notify(renderPreflight(preflight), preflight.status === 'already_landed' ? 'info' : 'warning');
    return;
  }

  let targetDir: string | undefined = targetArg;
  if (preflight.substrate === 'empty_dir' && !targetDir) {
    targetDir = await ctx.ui.input('Land target directory', join(ctx.cwd, runId));
    if (!targetDir) {
      ctx.ui.notify('Landing cancelled: no target directory chosen.', 'info');
      return;
    }
  }

  const summary =
    preflight.substrate === 'empty_dir'
      ? `Materialize the promoted run into ${targetDir ?? ''} as a fresh repository (branch main)?`
      : `Merge ${preflight.reviewBranch} (${preflight.promotionCommitSha.slice(0, 12)}) into the checked-out branch of ${ctx.cwd}?`;
  const confirmed = await ctx.ui.confirm(`Land run ${runId}`, summary);
  if (!confirmed) {
    ctx.ui.notify(`Landing of ${runId} declined; nothing changed.`, 'info');
    return;
  }

  // The acceptance is bound to the exact promoted commit the user just saw;
  // applyLanding re-derives and refuses on any drift.
  const result = await applyLanding({
    cwd: ctx.cwd,
    runId,
    acceptance: { promotedCommitSha: preflight.promotionCommitSha },
    ...(targetDir === undefined ? {} : { targetDir }),
    gitHostLand: deps.gitHostLand,
  });
  ctx.ui.notify(renderApply(runId, result), result.status === 'landed' ? 'info' : 'warning');
}

export function registerBrunchExecuteLand(pi: ExtensionAPI, gitHostLand: GitHostLandPort): void {
  pi.registerTool(createExecuteLandPreflightTool() as never);
  pi.registerCommand(BRUNCH_LAND_COMMAND, {
    description: 'Review and land a promoted run into the host (user-confirmed)',
    handler: async (args, ctx) => {
      await runBrunchLandCommand(args ?? '', ctx as unknown as LandCommandContext, { gitHostLand });
    },
  });
}

async function resolveSolePromotedRun(ctx: LandCommandContext): Promise<string | undefined> {
  const runsDir = join(ctx.cwd, '.brunch', 'cook', 'runs');
  let entries: string[];
  try {
    entries = await readdir(runsDir);
  } catch {
    entries = [];
  }
  const promoted: string[] = [];
  for (const entry of entries) {
    const metadata = await readRunMetadata(runMetadataPath(ctx.cwd, entry));
    if (metadata?.status === 'promotion_prepared') promoted.push(entry);
  }
  if (promoted.length === 1) return promoted[0];
  if (promoted.length === 0) {
    ctx.ui.notify('No promotion_prepared run to land. Usage: /brunch:land <runId> [targetDir]', 'warning');
    return undefined;
  }
  ctx.ui.notify(
    `Multiple promoted runs: ${promoted.sort().join(', ')}. Usage: /brunch:land <runId> [targetDir]`,
    'warning',
  );
  return undefined;
}

function renderPreflight(result: LandingPreflightResult): string {
  const lines = [`execute_land_preflight: ${result.status}`, `run id: ${result.runId}`];
  if (result.status === 'preflight_ready') {
    lines.push(
      `substrate: ${result.substrate}`,
      `run base: ${result.runBaseSha}`,
      `promoted commit: ${result.promotionCommitSha}`,
      `review branch: ${result.reviewBranch}`,
      'Landing is user-confirmed: run /brunch:land to review and land this run.',
    );
  }
  if (result.status === 'already_landed') {
    lines.push(`landed sha: ${result.landedSha ?? 'unknown'}`, `target: ${result.landedTarget ?? 'unknown'}`);
  }
  if ('message' in result) lines.push(`message: ${result.message}`);
  lines.push(`side effects: ${result.sideEffects.length === 0 ? 'none' : 'unexpected'}`);
  return lines.join('\n');
}

function renderApply(runId: string, result: LandingApplyResult): string {
  switch (result.status) {
    case 'landed':
      return `Landed ${runId} (${result.via}) at ${result.landedSha} into ${result.landedTarget}. The brunch/review ref is preserved.`;
    case 'landing_conflict':
      return `Landing ${runId} conflicted on: ${result.conflictedPaths.join(', ')}. The host was restored; merge ${runId}'s review branch manually or replan.`;
    case 'landing_refused':
      return `Landing ${runId} refused (${result.reason}${'paths' in result && result.paths ? `: ${result.paths.join(', ')}` : ''}). Nothing changed.`;
    case 'landing_failed':
      return `Landing ${runId} failed: ${result.message}. Nothing was recorded.`;
    case 'acceptance_stale':
      return `Landing ${runId} refused: the promoted commit changed since review (${result.promotionCommitSha}). Re-run /brunch:land.`;
    case 'target_required':
      return `Landing ${runId} needs a target directory.`;
    case 'already_landed':
      return `Run ${runId} already landed at ${result.landedSha ?? 'unknown'}.`;
    default:
      return `Landing ${runId}: ${result.status}${'message' in result ? ` — ${result.message}` : ''}`;
  }
}
