import { mkdir, open, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import { compileExecutorTopology, projectSchedulerPlan, type SchedulerPlan } from './orchestrate-topology.js';
import { inspectPetriTransitionJournal, petriEventsPath } from './petri-events.js';
import { freezePetriPlanSnapshot } from './petri-plan-snapshot.js';
import { readPetriRuntimePlan } from './petri-runtime-plan.js';
import { petriTopologyToSdcpnFile } from './petrinaut/sdcpn.js';
import {
  runExecutionActive,
  withRunExecutionAuthority,
  type RunExecutionActiveResult,
} from './run-execution-authority.js';
import { runDirPath, runMetadataPath, persistRunMetadata, readRunMetadata, type RunMetadata } from './run.js';

export type PetriExportResult =
  | RunExecutionActiveResult
  | {
      readonly status: 'missing_run';
      readonly runStatus: 'not_started';
      readonly runId: string;
      readonly metadataPath: string;
      readonly sideEffects: readonly [];
    }
  | {
      readonly status: 'run_not_completed';
      readonly runStatus: RunMetadata['status'];
      readonly runId: string;
      readonly metadataPath: string;
      readonly sideEffects: readonly [];
    }
  | {
      readonly status: 'petri_input_unreadable';
      readonly runStatus: 'run_completed';
      readonly runId: string;
      readonly metadataPath: string;
      readonly sideEffects: readonly [];
    }
  | {
      readonly status: 'petri_exported';
      readonly runStatus: 'petri_exported';
      readonly runId: string;
      readonly metadataPath: string;
      readonly petriPath: string;
      readonly petriSdcpnPath: string;
      readonly sideEffects: readonly (
        | { readonly kind: 'mkdir'; readonly path: string }
        | { readonly kind: 'write_file'; readonly path: string; readonly ifExists: 'overwrite' }
      )[];
    };

export function petriNetPath(cwd: string, runId: string): string {
  return join(runDirPath(cwd, runId), 'petrinaut', 'net.json');
}

export function petriSdcpnPath(cwd: string, runId: string): string {
  return join(runDirPath(cwd, runId), 'petrinaut', 'net.sdcpn.json');
}

export class PetriObservationInputError extends Error {}

async function readExportPlan(cwd: string, metadata: RunMetadata): Promise<SchedulerPlan | undefined> {
  return readPetriRuntimePlan(cwd, metadata);
}

export async function preparePetriObservation(args: {
  readonly cwd: string;
  readonly runId: string;
}): Promise<SchedulerPlan> {
  const metadata = await readRunMetadata(runMetadataPath(args.cwd, args.runId));
  if (!metadata) throw new Error(`Cannot prepare Petrinaut observation for missing run: ${args.runId}`);
  await mkdir(dirname(petriNetPath(args.cwd, args.runId)), { recursive: true });
  const frozenPlan = await freezePetriPlanSnapshot({
    cwd: args.cwd,
    runId: args.runId,
    sourcePath: metadata.planPath,
  });
  let plan: SchedulerPlan | undefined;
  try {
    plan = projectSchedulerPlan(JSON.parse(frozenPlan));
  } catch {
    // Normalized below to distinguish invalid topology from observer I/O failure.
  }
  if (!plan) throw new PetriObservationInputError(`Invalid Petrinaut plan input: ${args.runId}`);
  let artifacts: ReturnType<typeof compilePetriArtifacts>;
  try {
    artifacts = compilePetriArtifacts(args.runId, plan);
  } catch {
    throw new PetriObservationInputError(`Invalid Petrinaut topology input: ${args.runId}`);
  }
  const artifactWrites = await writePetriArtifacts({ cwd: args.cwd, runId: args.runId, artifacts });
  if (artifactWrites.net || artifactWrites.sdcpn) {
    const journal = await open(petriEventsPath(args.cwd, args.runId), 'a');
    await journal.close();
  } else {
    const journal = await inspectPetriTransitionJournal(args);
    if (journal.status === 'missing' || journal.status === 'unavailable') {
      throw new PetriObservationInputError(`Petrinaut journal is ${journal.status}: ${args.runId}`);
    }
  }
  return plan;
}

export async function hasPreparedPetriObservation(cwd: string, runId: string): Promise<boolean> {
  try {
    await readFile(petriNetPath(cwd, runId));
    return true;
  } catch {
    return false;
  }
}

export async function exportPetri(args: {
  readonly cwd: string;
  readonly runId: string;
}): Promise<PetriExportResult> {
  return withRunExecutionAuthority({
    cwd: args.cwd,
    runId: args.runId,
    execute: () => exportPetriOwned(args),
    onContended: () => runExecutionActive(args.runId),
  });
}

async function exportPetriOwned(args: {
  readonly cwd: string;
  readonly runId: string;
}): Promise<PetriExportResult> {
  const metadataPath = runMetadataPath(args.cwd, args.runId);
  const metadata = await readRunMetadata(metadataPath);
  if (!metadata)
    return {
      status: 'missing_run',
      runStatus: 'not_started',
      runId: args.runId,
      metadataPath,
      sideEffects: [],
    };
  if (metadata.status !== 'run_completed')
    return {
      status: 'run_not_completed',
      runStatus: metadata.status,
      runId: args.runId,
      metadataPath,
      sideEffects: [],
    };

  const path = petriNetPath(args.cwd, args.runId);
  const sdcpnPath = petriSdcpnPath(args.cwd, args.runId);
  const dir = dirname(path);
  const plan = await readExportPlan(args.cwd, metadata);
  if (!plan) {
    return {
      status: 'petri_input_unreadable',
      runStatus: 'run_completed',
      runId: args.runId,
      metadataPath,
      sideEffects: [],
    };
  }

  const updated: RunMetadata = { ...metadata, status: 'petri_exported', petriPath: path };
  let artifacts: ReturnType<typeof compilePetriArtifacts>;
  try {
    artifacts = compilePetriArtifacts(args.runId, plan);
  } catch {
    return {
      status: 'petri_input_unreadable',
      runStatus: 'run_completed',
      runId: args.runId,
      metadataPath,
      sideEffects: [],
    };
  }
  const artifactWrites = await writePetriArtifacts({ cwd: args.cwd, runId: args.runId, artifacts });
  const metadataEffect = await persistRunMetadata(metadataPath, updated);
  return {
    status: 'petri_exported',
    runStatus: 'petri_exported',
    runId: args.runId,
    metadataPath,
    petriPath: path,
    petriSdcpnPath: sdcpnPath,
    sideEffects: [
      { kind: 'mkdir', path: dir },
      ...(artifactWrites.net ? [{ kind: 'write_file' as const, path, ifExists: 'overwrite' as const }] : []),
      ...(artifactWrites.sdcpn
        ? [{ kind: 'write_file' as const, path: sdcpnPath, ifExists: 'overwrite' as const }]
        : []),
      metadataEffect,
    ],
  };
}

function compilePetriArtifacts(runId: string, plan: SchedulerPlan) {
  const topology = compileExecutorTopology(plan);
  return {
    net: {
      runId,
      ...(topology.epics === undefined ? {} : { epics: topology.epics }),
      subnets: topology.subnets,
      places: topology.places,
      transitions: topology.transitions,
      initialMarking: topology.initialMarking,
    },
    sdcpn: petriTopologyToSdcpnFile({ runId, topology }),
  };
}

async function writePetriArtifacts(args: {
  readonly cwd: string;
  readonly runId: string;
  readonly artifacts: ReturnType<typeof compilePetriArtifacts>;
}): Promise<{ readonly net: boolean; readonly sdcpn: boolean }> {
  const path = petriNetPath(args.cwd, args.runId);
  const sdcpnPath = petriSdcpnPath(args.cwd, args.runId);
  await mkdir(dirname(path), { recursive: true });
  const net = await writeImmutableArtifact(path, `${JSON.stringify(args.artifacts.net, null, 2)}\n`);
  const sdcpn = await writeImmutableArtifact(sdcpnPath, `${JSON.stringify(args.artifacts.sdcpn, null, 2)}\n`);
  return { net, sdcpn };
}

async function writeImmutableArtifact(path: string, content: string): Promise<boolean> {
  try {
    const existing = await readFile(path, 'utf8');
    if (existing !== content) throw new Error(`Petrinaut definition changed after publication: ${path}`);
    return false;
  } catch (error) {
    if (!(error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT')) throw error;
  }
  const tempPath = `${path}.tmp`;
  await rm(tempPath, { force: true });
  await writeFile(tempPath, content, { encoding: 'utf8', flag: 'wx' });
  try {
    await rename(tempPath, path);
  } catch (error) {
    await rm(tempPath, { force: true });
    const raced = await readFile(path, 'utf8').catch(() => undefined);
    if (raced === content) return false;
    throw error;
  }
  return true;
}
