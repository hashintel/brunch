import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import {
  containedPath,
  exactSet,
  nonempty,
  nonnegativeInteger,
  positiveInteger,
  record,
  safeId,
  safeRelativePath,
  sha256,
} from './validation.js';

export const SPEC_SOURCES = ['brunch_spec', 'claude_spec'] as const;
export const EXECUTORS = ['brunch', 'claude_code'] as const;

export type SpecSource = (typeof SPEC_SOURCES)[number];
export type Executor = (typeof EXECUTORS)[number];

interface ContentAddressedPath {
  readonly path: string;
  readonly sha256: string;
}

export interface EndToEndStudyContract {
  readonly schemaVersion: 1;
  readonly id: string;
  readonly caseId: string;
  readonly mission: ContentAddressedPath;
  readonly sharedBaseline: ContentAddressedPath;
  readonly requirementRegistry: ContentAddressedPath;
  readonly executionContractTemplate: ContentAddressedPath;
  readonly oracle: {
    readonly id: string;
    readonly manifestPath: string;
    readonly manifestSha256: string;
  };
  readonly budgets: {
    readonly elicitation: {
      readonly qualifyingQuestions: number;
      readonly targetTurns: number;
      readonly elapsedMinutes: number;
      readonly mechanicalInterventions: number;
    };
    readonly execution: {
      readonly elapsedMinutes: number;
      readonly mechanicalInterventions: number;
      readonly substantiveHumanInterventions: 0;
    };
  };
  readonly actorRecipes: {
    readonly elicitation: string;
    readonly execution: Readonly<Record<Executor, string>>;
  };
  readonly specSources: readonly SpecSource[];
  readonly executors: readonly Executor[];
}

export function parseEndToEndStudyContract(value: unknown): EndToEndStudyContract {
  if (!record(value)) invalid();
  const mission = child(value, 'mission');
  const baseline = child(value, 'sharedBaseline');
  const requirementRegistry = child(value, 'requirementRegistry');
  const executionContractTemplate = child(value, 'executionContractTemplate');
  const oracle = child(value, 'oracle');
  const budgets = child(value, 'budgets');
  const elicitationBudget = child(budgets, 'elicitation');
  const executionBudget = child(budgets, 'execution');
  const actorRecipes = child(value, 'actorRecipes');
  const executionRecipes = child(actorRecipes, 'execution');

  if (
    value['schemaVersion'] !== 1 ||
    !safeId(value['id']) ||
    !safeId(value['caseId']) ||
    !addressedPath(mission) ||
    !addressedPath(baseline) ||
    !addressedPath(requirementRegistry) ||
    !addressedPath(executionContractTemplate) ||
    !safeId(oracle['id']) ||
    !safeRelativePath(oracle['manifestPath']) ||
    !sha256(oracle['manifestSha256']) ||
    !positiveInteger(elicitationBudget['qualifyingQuestions']) ||
    !positiveInteger(elicitationBudget['targetTurns']) ||
    !positiveInteger(elicitationBudget['elapsedMinutes']) ||
    !nonnegativeInteger(elicitationBudget['mechanicalInterventions']) ||
    !positiveInteger(executionBudget['elapsedMinutes']) ||
    !nonnegativeInteger(executionBudget['mechanicalInterventions']) ||
    executionBudget['substantiveHumanInterventions'] !== 0 ||
    !nonempty(actorRecipes['elicitation']) ||
    !nonempty(executionRecipes['brunch']) ||
    !nonempty(executionRecipes['claude_code']) ||
    !exactSet(value['specSources'], SPEC_SOURCES) ||
    !exactSet(value['executors'], EXECUTORS)
  ) {
    invalid();
  }
  return value as unknown as EndToEndStudyContract;
}

export function hashEndToEndStudyContract(contract: EndToEndStudyContract): string {
  const parsed = parseEndToEndStudyContract(contract);
  return `sha256:${createHash('sha256').update(JSON.stringify(parsed)).digest('hex')}`;
}

export async function loadEndToEndStudyContract(input: {
  readonly repositoryRoot: string;
  readonly contractPath: string;
}): Promise<{
  readonly contract: EndToEndStudyContract;
  readonly contractSha256: string;
}> {
  if (!containedPath(input.repositoryRoot, input.contractPath)) {
    throw new Error('end-to-end study contract must stay inside the repository');
  }
  const raw = await readFile(input.contractPath);
  const contract = parseEndToEndStudyContract(parseJson(raw.toString('utf8')));
  for (const addressed of [
    contract.mission,
    contract.sharedBaseline,
    contract.requirementRegistry,
    contract.executionContractTemplate,
    {
      path: contract.oracle.manifestPath,
      sha256: contract.oracle.manifestSha256,
    },
  ]) {
    const selected = resolve(input.repositoryRoot, addressed.path);
    if (!containedPath(input.repositoryRoot, selected)) {
      throw new Error(`study artifact escapes repository: ${addressed.path}`);
    }
    const bytes = await readFile(selected);
    const actual = `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
    if (actual !== addressed.sha256) {
      throw new Error(`study artifact hash drifted: ${addressed.path}`);
    }
  }
  return {
    contract,
    contractSha256: `sha256:${createHash('sha256').update(raw).digest('hex')}`,
  };
}

export function assertControllerIsolation(input: {
  readonly controllerRoot: string;
  readonly targetRoots: readonly string[];
}): void {
  const controllerRoot = resolve(input.controllerRoot);
  const targets = input.targetRoots.map((target) => resolve(target));
  if (
    targets.length === 0 ||
    new Set(targets).size !== targets.length ||
    targets.some((target) => containedPath(controllerRoot, target) || containedPath(target, controllerRoot))
  ) {
    throw new Error('controller and target roots must be disjoint');
  }
}

function addressedPath(value: Record<string, unknown>): boolean {
  return safeRelativePath(value['path']) && sha256(value['sha256']);
}

function child(value: Record<string, unknown>, key: string): Record<string, unknown> {
  const selected = value[key];
  if (!record(selected)) invalid();
  return selected;
}

function parseJson(raw: string): unknown {
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    throw new Error('invalid end-to-end study contract JSON');
  }
}

function invalid(): never {
  throw new Error('invalid end-to-end study contract');
}
