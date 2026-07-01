import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import { cookRunDir, cookRunMetadataPath, readCookRunMetadata, type CookRunMetadata } from './cook-run.js';

export type CookPromotionPrepareResult =
  | {
      readonly status: 'missing_run';
      readonly runStatus: 'not_started';
      readonly runId: string;
      readonly metadataPath: string;
      readonly sideEffects: readonly [];
    }
  | {
      readonly status: 'run_not_promotable';
      readonly runStatus: CookRunMetadata['status'];
      readonly runId: string;
      readonly metadataPath: string;
      readonly sideEffects: readonly [];
    }
  | {
      readonly status: 'promotion_prepared';
      readonly runStatus: 'promotion_prepared';
      readonly runId: string;
      readonly metadataPath: string;
      readonly promotionPath: string;
      readonly sideEffects: readonly [
        { readonly kind: 'mkdir'; readonly path: string },
        { readonly kind: 'write_file'; readonly path: string; readonly ifExists: 'overwrite' },
        { readonly kind: 'write_file'; readonly path: string; readonly ifExists: 'overwrite' },
      ];
    };

export function promotionReportPath(cwd: string, runId: string): string {
  return join(cookRunDir(cwd, runId), 'promotion', 'promotion.json');
}

export async function prepareCookPromotion(args: {
  readonly cwd: string;
  readonly runId: string;
}): Promise<CookPromotionPrepareResult> {
  const metadataPath = cookRunMetadataPath(args.cwd, args.runId);
  const metadata = await readCookRunMetadata(metadataPath);
  if (!metadata)
    return {
      status: 'missing_run',
      runStatus: 'not_started',
      runId: args.runId,
      metadataPath,
      sideEffects: [],
    };
  if (metadata.status !== 'petri_exported')
    return {
      status: 'run_not_promotable',
      runStatus: metadata.status,
      runId: args.runId,
      metadataPath,
      sideEffects: [],
    };

  const path = promotionReportPath(args.cwd, args.runId);
  const dir = dirname(path);
  const report = {
    runId: args.runId,
    specId: metadata.specId,
    petriPath: metadata.petriPath ?? null,
    reportsPath: metadata.reportsPath ?? null,
    completedSliceIds: metadata.completedSliceIds ?? [],
  };
  const updated: CookRunMetadata = { ...metadata, status: 'promotion_prepared', promotionPath: path };
  await mkdir(dir, { recursive: true });
  await writeFile(path, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  await writeFile(metadataPath, `${JSON.stringify(updated, null, 2)}\n`, 'utf8');
  return {
    status: 'promotion_prepared',
    runStatus: 'promotion_prepared',
    runId: args.runId,
    metadataPath,
    promotionPath: path,
    sideEffects: [
      { kind: 'mkdir', path: dir },
      { kind: 'write_file', path, ifExists: 'overwrite' },
      { kind: 'write_file', path: metadataPath, ifExists: 'overwrite' },
    ],
  };
}
