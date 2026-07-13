import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { petriDirPath } from './petri-events.js';
import { parsePetriProjection, type PetriProjection } from './petri-projection.js';
import type { RunMetadata } from './run.js';

export interface PetriMarkingLifecycleProvenance {
  readonly runStatus: RunMetadata['status'];
  readonly activeSliceId?: string;
  readonly completedSliceIds?: readonly string[];
}

export interface PetriMarkingSnapshot extends PetriProjection {
  readonly lifecycleProvenance?: PetriMarkingLifecycleProvenance;
  readonly parallelSliceBatch?: ParallelSliceBatchSnapshot;
}

export interface ParallelSliceBatchSnapshot {
  readonly claimedSliceIds: readonly string[];
  readonly settledSliceIds: readonly string[];
}

export function petriMarkingPath(cwd: string, runId: string): string {
  return join(petriDirPath(cwd, runId), 'marking.json');
}

export async function writePetriMarkingSnapshot(args: {
  readonly cwd: string;
  readonly runId: string;
  readonly snapshot: PetriMarkingSnapshot;
}): Promise<void> {
  await mkdir(petriDirPath(args.cwd, args.runId), { recursive: true });
  const path = petriMarkingPath(args.cwd, args.runId);
  const tempPath = `${path}.tmp`;
  await writeFile(tempPath, `${JSON.stringify(args.snapshot, null, 2)}\n`, 'utf8');
  try {
    await rename(tempPath, path);
  } catch (error) {
    await rm(tempPath, { force: true });
    throw error;
  }
}

export async function readPetriMarkingSnapshot(args: {
  readonly cwd: string;
  readonly runId: string;
}): Promise<PetriMarkingSnapshot | undefined> {
  try {
    return asPetriMarkingSnapshot(JSON.parse(await readFile(petriMarkingPath(args.cwd, args.runId), 'utf8')));
  } catch {
    return undefined;
  }
}

export function petriMarkingLifecycleProvenance(metadata: RunMetadata): PetriMarkingLifecycleProvenance {
  return {
    runStatus: metadata.status,
    ...(metadata.activeSliceId === undefined ? {} : { activeSliceId: metadata.activeSliceId }),
    ...(metadata.completedSliceIds === undefined ? {} : { completedSliceIds: metadata.completedSliceIds }),
  };
}

export function petriMarkingSnapshotMatchesRunMetadata(
  snapshot: PetriMarkingSnapshot,
  metadata: RunMetadata,
): boolean {
  const provenance = snapshot.lifecycleProvenance;
  if (!provenance) return false;
  if (provenance.runStatus !== metadata.status) return false;
  if (provenance.activeSliceId !== metadata.activeSliceId) return false;
  const snapshotCompleted = provenance.completedSliceIds ?? [];
  const metadataCompleted = metadata.completedSliceIds ?? [];
  return (
    snapshotCompleted.length === metadataCompleted.length &&
    snapshotCompleted.every((sliceId, index) => sliceId === metadataCompleted[index])
  );
}

function asPetriMarkingSnapshot(value: unknown): PetriMarkingSnapshot | undefined {
  if (!isRecord(value)) return undefined;
  const projection = parsePetriProjection(value);
  if (!projection) return undefined;
  const lifecycleProvenance = asLifecycleProvenance(value.lifecycleProvenance);
  if (value.lifecycleProvenance !== undefined && lifecycleProvenance === undefined) return undefined;
  const parallelSliceBatch = asParallelSliceBatch(value.parallelSliceBatch);
  if (value.parallelSliceBatch !== undefined && parallelSliceBatch === undefined) return undefined;

  return {
    ...projection,
    ...(lifecycleProvenance === undefined ? {} : { lifecycleProvenance }),
    ...(parallelSliceBatch === undefined ? {} : { parallelSliceBatch }),
  };
}

function asParallelSliceBatch(value: unknown): ParallelSliceBatchSnapshot | undefined {
  if (!isRecord(value) || !isStringArray(value.claimedSliceIds) || !isStringArray(value.settledSliceIds)) {
    return undefined;
  }
  const claimedSliceIds = value.claimedSliceIds;
  const settledSliceIds = value.settledSliceIds;
  if (new Set(claimedSliceIds).size !== claimedSliceIds.length) return undefined;
  if (settledSliceIds.some((sliceId) => !claimedSliceIds.includes(sliceId))) return undefined;
  return { claimedSliceIds, settledSliceIds };
}

function asLifecycleProvenance(value: unknown): PetriMarkingLifecycleProvenance | undefined {
  if (!isRecord(value) || typeof value.runStatus !== 'string') return undefined;
  if (value.activeSliceId !== undefined && typeof value.activeSliceId !== 'string') return undefined;
  if (value.completedSliceIds !== undefined && !isStringArray(value.completedSliceIds)) return undefined;
  return {
    runStatus: value.runStatus as RunMetadata['status'],
    ...(value.activeSliceId === undefined ? {} : { activeSliceId: value.activeSliceId }),
    ...(value.completedSliceIds === undefined ? {} : { completedSliceIds: value.completedSliceIds }),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isStringArray(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string');
}
