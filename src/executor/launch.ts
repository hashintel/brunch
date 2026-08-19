import { resolve } from 'node:path';

import { pathExists } from './path-exists.js';
import { planFilePath, readPlanFileProvenance, type PlanFileProvenance } from './plan-file.js';

export type LaunchStatus =
  | 'invalid_plan_path'
  | 'missing_plan'
  | 'blocked_projection'
  | 'missing_provenance'
  | 'stale_plan'
  | 'ready';

export interface LaunchResult {
  readonly status: LaunchStatus;
  readonly runStatus: 'not_started';
  readonly planPath: string;
  readonly current?: LaunchCurrentProjection;
  readonly provenance?: PlanFileProvenance;
  readonly sideEffects: readonly [];
}

export interface LaunchCurrentProjection {
  readonly specId: string;
  readonly mode: PlanFileProvenance['mode'];
  readonly source: PlanFileProvenance['source'];
  readonly checkStatus: 'ok' | 'blocked';
}

export async function prepareLaunch(args: {
  readonly cwd: string;
  readonly specId: string;
  readonly planPath?: string;
  readonly current?: LaunchCurrentProjection;
}): Promise<LaunchResult> {
  const planPath = args.planPath ?? planFilePath(args.cwd, args.specId);
  const current = args.current;
  if (args.planPath && !isSelectedSpecPlanPath({ cwd: args.cwd, specId: args.specId, planPath })) {
    return {
      status: 'invalid_plan_path',
      runStatus: 'not_started',
      planPath,
      ...(current ? { current } : {}),
      sideEffects: [],
    };
  }
  if (!(await pathExists(planPath))) {
    return {
      status: 'missing_plan',
      runStatus: 'not_started',
      planPath,
      ...(current ? { current } : {}),
      sideEffects: [],
    };
  }

  if (current?.checkStatus === 'blocked') {
    return {
      status: 'blocked_projection',
      runStatus: 'not_started',
      planPath,
      current,
      sideEffects: [],
    };
  }

  if (current) {
    const provenance = await readPlanFileProvenance({ cwd: args.cwd, specId: args.specId });
    if (!provenance) {
      return {
        status: 'missing_provenance',
        runStatus: 'not_started',
        planPath,
        current,
        sideEffects: [],
      };
    }

    if (!provenanceMatchesCurrent(provenance, current)) {
      return {
        status: 'stale_plan',
        runStatus: 'not_started',
        planPath,
        current,
        provenance,
        sideEffects: [],
      };
    }

    return {
      status: 'ready',
      runStatus: 'not_started',
      planPath,
      current,
      provenance,
      sideEffects: [],
    };
  }

  return {
    status: 'ready',
    runStatus: 'not_started',
    planPath,
    sideEffects: [],
  };
}

function provenanceMatchesCurrent(provenance: PlanFileProvenance, current: LaunchCurrentProjection): boolean {
  return (
    provenance.schemaVersion === 1 &&
    provenance.specId === current.specId &&
    provenance.mode === current.mode &&
    provenance.source.visibility === current.source.visibility &&
    provenance.source.graphLsn === current.source.graphLsn
  );
}

function isSelectedSpecPlanPath(args: {
  readonly cwd: string;
  readonly specId: string;
  readonly planPath: string;
}): boolean {
  return resolve(args.planPath) === resolve(planFilePath(args.cwd, args.specId));
}
