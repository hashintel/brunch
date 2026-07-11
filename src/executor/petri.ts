import { mkdir, open, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import { compileExecutorTopology, type SchedulerPlan } from './orchestrate-topology.js';
import { petriEventsPath } from './petri-events.js';
import { readPetriRuntimePlan } from './petri-runtime-plan.js';
import { petriTopologyToSdcpnFile } from './petrinaut/sdcpn.js';
import { runDirPath, runMetadataPath, persistRunMetadata, readRunMetadata, type RunMetadata } from './run.js';

export type PetriExportResult =
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
      readonly sideEffects: readonly [
        { readonly kind: 'mkdir'; readonly path: string },
        { readonly kind: 'write_file'; readonly path: string; readonly ifExists: 'overwrite' },
        { readonly kind: 'write_file'; readonly path: string; readonly ifExists: 'overwrite' },
        { readonly kind: 'write_file'; readonly path: string; readonly ifExists: 'overwrite' },
      ];
    };

export function petriNetPath(cwd: string, runId: string): string {
  return join(runDirPath(cwd, runId), 'petrinaut', 'net.json');
}

export function petriSdcpnPath(cwd: string, runId: string): string {
  return join(runDirPath(cwd, runId), 'petrinaut', 'net.sdcpn.json');
}

async function readExportPlan(cwd: string, metadata: RunMetadata): Promise<SchedulerPlan | undefined> {
  return readPetriRuntimePlan(cwd, metadata);
}

export async function preparePetriObservation(args: {
  readonly cwd: string;
  readonly runId: string;
}): Promise<void> {
  const metadata = await readRunMetadata(runMetadataPath(args.cwd, args.runId));
  if (!metadata) throw new Error(`Cannot prepare Petrinaut observation for missing run: ${args.runId}`);
  const plan = await readExportPlan(args.cwd, metadata);
  if (!plan) throw new Error(`Cannot prepare Petrinaut observation without a readable plan: ${args.runId}`);
  const artifacts = compilePetriArtifacts(args.runId, plan);
  await writePetriArtifacts({ cwd: args.cwd, runId: args.runId, artifacts });
  const journal = await open(petriEventsPath(args.cwd, args.runId), 'a');
  await journal.close();
}

export async function exportPetri(args: {
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
  await writePetriArtifacts({ cwd: args.cwd, runId: args.runId, artifacts });
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
      { kind: 'write_file', path, ifExists: 'overwrite' },
      { kind: 'write_file', path: sdcpnPath, ifExists: 'overwrite' },
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
}): Promise<void> {
  const path = petriNetPath(args.cwd, args.runId);
  const sdcpnPath = petriSdcpnPath(args.cwd, args.runId);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(args.artifacts.net, null, 2)}\n`, 'utf8');
  await writeFile(sdcpnPath, `${JSON.stringify(args.artifacts.sdcpn, null, 2)}\n`, 'utf8');
}
