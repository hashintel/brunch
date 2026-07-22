import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  prepareBrunchExecutionWorkspace,
  type PreparedBrunchExecutionWorkspace,
} from '../execution-comparison/brunch-lane.js';
import { materializeExactExecutionPacket } from './public-packet.js';
import { assertControllerIsolation } from './study-contract.js';
import { containedPath } from './validation.js';

export interface ExecutionLaunch {
  readonly command: string;
  readonly args: readonly string[];
  readonly cwd: string;
}

export function createBrunchExecutionLaunch(input: {
  readonly workspaceDir: string;
  readonly specId: number;
  readonly forbiddenRoots: readonly string[];
}): ExecutionLaunch {
  return {
    command: 'npx',
    args: [
      'tsx',
      'src/dev/execution-comparison-brunch.ts',
      '--workspace',
      input.workspaceDir,
      '--spec-id',
      String(input.specId),
      '--solution-isolation',
      'v1',
      ...input.forbiddenRoots.flatMap((root) => ['--forbidden-root', root]),
    ],
    cwd: repositoryRoot(),
  };
}

export async function prepareBrunchExecutionCell(input: {
  readonly cellRoot: string;
  readonly workspaceDir: string;
  readonly controllerRoot: string;
  readonly specificationPath: string;
  readonly publicContractTemplatePath: string;
}): Promise<{
  readonly prepared: PreparedBrunchExecutionWorkspace;
  readonly launch: ExecutionLaunch;
}> {
  assertControllerIsolation({
    controllerRoot: input.controllerRoot,
    targetRoots: [input.cellRoot, input.workspaceDir],
  });
  if (containedPath(input.controllerRoot, input.specificationPath)) {
    throw new Error('specification may not come from the controller root');
  }
  const materialized = await materializeExactExecutionPacket({
    specificationPath: input.specificationPath,
    publicContractTemplatePath: input.publicContractTemplatePath,
    packetDir: join(input.cellRoot, 'public-packet'),
  });
  const prepared = await prepareBrunchExecutionWorkspace({
    workspaceDir: input.workspaceDir,
    caseDir: materialized.packetDir,
    specificationMode: 'opaque',
  });
  const forbiddenRoots = [input.controllerRoot, repositoryRoot()].filter(
    (root) => !containedPath(root, input.workspaceDir) && !containedPath(input.workspaceDir, root),
  );
  return {
    prepared,
    launch: createBrunchExecutionLaunch({
      workspaceDir: input.workspaceDir,
      specId: prepared.specId,
      forbiddenRoots,
    }),
  };
}

function repositoryRoot(): string {
  return fileURLToPath(new URL('../../../', import.meta.url));
}
