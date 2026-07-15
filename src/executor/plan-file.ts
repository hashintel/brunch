import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import { BRUNCH_DIR } from '../constants.js';
import { assertPlanPreviewVersion, type PlanPreview } from './plan-preview.js';

export interface PlanFilePayload {
  readonly mode: PlanPreview['mode'];
  readonly scope_handoff_required: boolean;
  readonly spec: PlanPreview['spec'];
  readonly epics: PlanPreview['epics'];
  readonly slices: PlanPreview['slices'];
  readonly execution_contract?: PlanPreview['execution_contract'];
}

export interface PlanFileProvenance {
  readonly schemaVersion: 1;
  readonly specId: string;
  readonly mode: PlanPreview['mode'];
  readonly source: {
    readonly graphLsn: number;
    readonly visibility: 'active';
  };
}

export interface PlanFileWriteResult {
  readonly path: string;
  readonly provenancePath: string;
  readonly writeMode: 'overwrite';
  readonly sideEffects: readonly [
    { readonly kind: 'write_file'; readonly path: string; readonly ifExists: 'overwrite' },
    { readonly kind: 'write_file'; readonly path: string; readonly ifExists: 'overwrite' },
  ];
}

export function planFilePath(cwd: string, specId: string): string {
  return join(cwd, BRUNCH_DIR, 'cook', 'specs', specId, 'plan.yaml');
}

export function planProvenancePath(cwd: string, specId: string): string {
  return join(cwd, BRUNCH_DIR, 'cook', 'specs', specId, 'plan.provenance.json');
}

export function planFilePayload(preview: PlanPreview): PlanFilePayload {
  assertPlanPreviewVersion(preview);
  return {
    mode: preview.mode,
    scope_handoff_required: preview.scope_handoff_required,
    spec: preview.spec,
    epics: preview.epics,
    slices: preview.slices,
    ...(preview.execution_contract ? { execution_contract: preview.execution_contract } : {}),
  };
}

export async function readPlanFilePayload(args: {
  readonly cwd: string;
  readonly specId: string;
}): Promise<PlanFilePayload | undefined> {
  try {
    return JSON.parse(await readFile(planFilePath(args.cwd, args.specId), 'utf8')) as PlanFilePayload;
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      return undefined;
    }
    throw error;
  }
}

export function planFileProvenance(args: {
  readonly preview: PlanPreview;
  readonly source: PlanFileProvenance['source'];
}): PlanFileProvenance {
  assertPlanPreviewVersion(args.preview);
  return {
    schemaVersion: 1,
    specId: args.preview.spec.spec_id,
    mode: args.preview.mode,
    source: args.source,
  };
}

export async function readPlanFileProvenance(args: {
  readonly cwd: string;
  readonly specId: string;
}): Promise<PlanFileProvenance | undefined> {
  try {
    return JSON.parse(
      await readFile(planProvenancePath(args.cwd, args.specId), 'utf8'),
    ) as PlanFileProvenance;
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      return undefined;
    }
    throw error;
  }
}

export async function writePlanFile(args: {
  readonly cwd: string;
  readonly preview: PlanPreview;
  readonly source: PlanFileProvenance['source'];
}): Promise<PlanFileWriteResult> {
  const path = planFilePath(args.cwd, args.preview.spec.spec_id);
  const provenancePath = planProvenancePath(args.cwd, args.preview.spec.spec_id);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(planFilePayload(args.preview), null, 2)}\n`, 'utf8');
  await writeFile(
    provenancePath,
    `${JSON.stringify(planFileProvenance({ preview: args.preview, source: args.source }), null, 2)}\n`,
    'utf8',
  );
  return {
    path,
    provenancePath,
    writeMode: 'overwrite',
    sideEffects: [
      { kind: 'write_file', path, ifExists: 'overwrite' },
      { kind: 'write_file', path: provenancePath, ifExists: 'overwrite' },
    ],
  };
}
