import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

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
      readonly status: 'petri_exported';
      readonly runStatus: 'petri_exported';
      readonly runId: string;
      readonly metadataPath: string;
      readonly petriPath: string;
      readonly sideEffects: readonly [
        { readonly kind: 'mkdir'; readonly path: string },
        { readonly kind: 'write_file'; readonly path: string; readonly ifExists: 'overwrite' },
        { readonly kind: 'write_file'; readonly path: string; readonly ifExists: 'overwrite' },
      ];
    };

export function petriNetPath(cwd: string, runId: string): string {
  return join(runDirPath(cwd, runId), 'petrinaut', 'net.json');
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
  const dir = dirname(path);
  const updated: RunMetadata = { ...metadata, status: 'petri_exported', petriPath: path };
  await mkdir(dir, { recursive: true });
  await writeFile(
    path,
    `${JSON.stringify({ runId: args.runId, places: ['run_completed'], transitions: [] }, null, 2)}\n`,
    'utf8',
  );
  const metadataEffect = await persistRunMetadata(metadataPath, updated);
  return {
    status: 'petri_exported',
    runStatus: 'petri_exported',
    runId: args.runId,
    metadataPath,
    petriPath: path,
    sideEffects: [
      { kind: 'mkdir', path: dir },
      { kind: 'write_file', path, ifExists: 'overwrite' },
      metadataEffect,
    ],
  };
}
