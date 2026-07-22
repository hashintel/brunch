import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { basename, join } from 'node:path';

export interface BrowserExecutionCasePublicContract {
  readonly schemaVersion: 1;
  readonly case: {
    readonly id: 'minimal-petri-net-editor-v1';
    readonly specification: 'spec.md';
    readonly specificationSha256: string;
    readonly provider: 'anthropic';
    readonly model: 'claude-opus-4-8';
    readonly repository: {
      readonly substrate: 'empty_dir';
      readonly base: 'fresh-empty-commit';
    };
  };
  readonly budgets: {
    readonly elapsedMinutes: 90;
    readonly mechanicalInterventions: 2;
    readonly substantiveHumanInterventions: 0;
  };
  readonly delivery: {
    readonly test: CommandContract;
    readonly build: CommandContract;
    readonly staticOutput: 'dist';
    readonly runtimeNetwork: 'forbidden';
    readonly dependencyInstallNetwork: 'package-registry-only';
  };
  readonly accessibility: {
    readonly application: AccessibleNameContract;
    readonly canvas: AccessibleNameContract;
    readonly controls: readonly AccessibleNameContract[];
    readonly dynamic: Readonly<Record<'place' | 'transition' | 'arc', AccessiblePatternContract>>;
    readonly inspectorFields: readonly AccessibleNameContract[];
    readonly feedbackRoles: readonly ('status' | 'alert')[];
  };
  readonly interactions: Readonly<Record<string, string>>;
  readonly rules: readonly string[];
}

export interface BrunchHostLandingExecutionCasePublicContract {
  readonly schemaVersion: 1;
  readonly case: {
    readonly id: 'brunch-host-landing-v1';
    readonly specification: 'spec.md';
    readonly specificationSha256: string;
    readonly provider: 'anthropic';
    readonly model: 'claude-opus-4-8';
    readonly product: 'brunch';
    readonly mode: 'brownfield';
    readonly scope: 'single_feature';
    readonly surface: 'backend';
    readonly repository: {
      readonly substrate: 'pinned_git';
      readonly parentCommit: string;
      readonly parentTree: string;
    };
  };
  readonly budgets: {
    readonly elapsedMinutes: 90;
    readonly mechanicalInterventions: 2;
    readonly substantiveHumanInterventions: 0;
  };
  readonly delivery: {
    readonly runtimeNetwork: 'forbidden';
    readonly dependencyInstallNetwork: 'forbidden';
  };
  readonly acceptance: {
    readonly publicCommand: '/brunch:land';
    readonly executionTerminal: 'promotion_prepared';
  };
  readonly accessibility: Readonly<
    Record<
      | 'view'
      | 'tab'
      | 'create'
      | 'scenario'
      | 'metric'
      | 'direction'
      | 'run'
      | 'cancel'
      | 'status'
      | 'results',
      AccessibleNameContract
    >
  >;
  readonly rules: readonly string[];
}

export type PetrinautMechanicalAddress =
  | { readonly kind: 'roleName'; readonly role: string; readonly name: string }
  | { readonly kind: 'roleValue'; readonly role: string; readonly value: string }
  | { readonly kind: 'roleContents'; readonly role: string; readonly contents: string }
  | { readonly kind: 'exactText'; readonly text: string };

export type PetrinautMechanicalAddressKey =
  | 'skipTour'
  | 'dismissAssistant'
  | 'simulateMode'
  | 'optimizationsNav'
  | 'viewTitle'
  | 'create'
  | 'createDrawer'
  | 'scenario'
  | 'metric'
  | 'metricCode'
  | 'directionMaximize'
  | 'directionMinimize'
  | 'run'
  | 'cancel'
  | 'statusComplete'
  | 'statusError'
  | 'statusCancelled';

export interface PetrinautOptimizationExecutionCasePublicContract {
  readonly schemaVersion: 1;
  readonly case: {
    readonly id: 'petrinaut-optimization-v1';
    readonly specification: 'spec.md';
    readonly specificationSha256: string;
    readonly provider: 'anthropic';
    readonly model: 'claude-opus-4-8';
    readonly product: 'petrinaut';
    readonly mode: 'brownfield';
    readonly scope: 'single_feature';
    readonly surface: 'frontend';
    readonly repository: {
      readonly substrate: 'pinned_git';
      readonly parentCommit: '5c7a2d9db5caa851c38938f4b1bac19005b0e978';
      readonly parentTree: 'a3e08cf75e00cc9016c931f4665341506e03533e';
    };
  };
  readonly budgets: {
    readonly elapsedMinutes: 90;
    readonly mechanicalInterventions: 2;
    readonly substantiveHumanInterventions: 0;
  };
  readonly delivery: {
    readonly runtimeNetwork: 'forbidden';
    readonly dependencyInstallNetwork: 'controller_only';
  };
  readonly acceptance: {
    readonly publicRoute: '/optimization';
    readonly sameOriginApi: '/api/petrinaut-opt/optimize/all';
    readonly executionTerminal: 'promotion_prepared';
  };
  readonly mechanicalAddresses: Readonly<Record<PetrinautMechanicalAddressKey, PetrinautMechanicalAddress>>;
  readonly rules: readonly string[];
}

export type ExecutionCasePublicContract =
  | BrowserExecutionCasePublicContract
  | BrunchHostLandingExecutionCasePublicContract
  | PetrinautOptimizationExecutionCasePublicContract;

export type PinnedExecutionCasePublicContract = Extract<
  ExecutionCasePublicContract,
  { readonly case: { readonly repository: { readonly substrate: 'pinned_git' } } }
>;

export type PinnedExecutionCaseId = PinnedExecutionCasePublicContract['case']['id'];

export function isBrowserExecutionCaseContract(
  value: ExecutionCasePublicContract,
): value is BrowserExecutionCasePublicContract {
  return value.case.id === 'minimal-petri-net-editor-v1';
}

export function isPetrinautOptimizationExecutionCaseContract(
  value: ExecutionCasePublicContract,
): value is PetrinautOptimizationExecutionCasePublicContract {
  return value.case.id === 'petrinaut-optimization-v1';
}

export interface CommandContract {
  readonly command: string;
  readonly args: readonly string[];
}

export interface AccessibleNameContract {
  readonly role: string;
  readonly name: string;
}

export type AccessibleNamePattern =
  | '^Place: .+$'
  | '^Transition: .+ \\((enabled|disabled)\\)$'
  | '^Arc: .+ to .+$';

export interface AccessiblePatternContract {
  readonly role: string;
  readonly namePattern: AccessibleNamePattern;
}

export interface PublicCasePacket {
  readonly contract: ExecutionCasePublicContract;
  readonly files: readonly {
    readonly path: 'public-contract.json' | 'spec.md';
    readonly sha256: string;
  }[];
  readonly packetSha256: string;
}

const CONTROLLER_ONLY_REFERENCE = /(?:^|[/\\])controller[/\\]|oracle-manifest|label-mapping/iu;
const ACCESSIBLE_NAME_PATTERNS = {
  place: '^Place: .+$',
  transition: '^Transition: .+ \\((enabled|disabled)\\)$',
  arc: '^Arc: .+ to .+$',
} as const satisfies Record<'place' | 'transition' | 'arc', AccessibleNamePattern>;

export async function loadPublicCasePacket(caseDir: string): Promise<PublicCasePacket> {
  const contractRaw = await readFile(join(caseDir, 'public-contract.json'), 'utf8');
  const contract = parsePublicCaseContract(parseJson(contractRaw));
  if (basename(contract.case.specification) !== contract.case.specification) {
    throw new Error('public execution contract specification path must stay inside the case root');
  }

  const specRaw = await readFile(join(caseDir, contract.case.specification), 'utf8');
  if (CONTROLLER_ONLY_REFERENCE.test(contractRaw) || CONTROLLER_ONLY_REFERENCE.test(specRaw)) {
    throw new Error('public execution packet contains controller-only material');
  }

  const specDigest = sha256Hex(specRaw);
  if (specDigest !== contract.case.specificationSha256) {
    throw new Error('approved specification hash does not match the public execution contract');
  }

  const files = [
    { path: 'public-contract.json' as const, sha256: `sha256:${sha256Hex(contractRaw)}` },
    { path: 'spec.md' as const, sha256: `sha256:${specDigest}` },
  ];
  const packetSha256 = `sha256:${sha256Hex(files.map((file) => `${file.path}:${file.sha256}\n`).join(''))}`;
  return { contract, files, packetSha256 };
}

export function parsePublicCaseContract(value: unknown): ExecutionCasePublicContract {
  if (!record(value)) invalid();
  if (record(value['case']) && value['case']['id'] === 'brunch-host-landing-v1') {
    return parseBrunchHostLandingContract(value);
  }
  if (record(value['case']) && value['case']['id'] === 'petrinaut-optimization-v1') {
    return parsePetrinautOptimizationContract(value);
  }
  return parsePetriBrowserContract(value);
}

function parsePetriBrowserContract(value: Record<string, unknown>): BrowserExecutionCasePublicContract {
  const caseValue = requiredRecord(value, 'case');
  const repository = requiredRecord(caseValue, 'repository');
  const budgets = requiredRecord(value, 'budgets');
  const delivery = requiredRecord(value, 'delivery');
  const accessibility = requiredRecord(value, 'accessibility');
  const dynamic = requiredRecord(accessibility, 'dynamic');

  if (
    value['schemaVersion'] !== 1 ||
    caseValue['id'] !== 'minimal-petri-net-editor-v1' ||
    caseValue['specification'] !== 'spec.md' ||
    !sha256HexValue(caseValue['specificationSha256']) ||
    caseValue['provider'] !== 'anthropic' ||
    caseValue['model'] !== 'claude-opus-4-8' ||
    repository['substrate'] !== 'empty_dir' ||
    repository['base'] !== 'fresh-empty-commit' ||
    budgets['elapsedMinutes'] !== 90 ||
    budgets['mechanicalInterventions'] !== 2 ||
    budgets['substantiveHumanInterventions'] !== 0 ||
    delivery['staticOutput'] !== 'dist' ||
    delivery['runtimeNetwork'] !== 'forbidden' ||
    delivery['dependencyInstallNetwork'] !== 'package-registry-only' ||
    !command(delivery['test'], 'npm', ['test']) ||
    !command(delivery['build'], 'npm', ['run', 'build']) ||
    !accessibleName(accessibility['application'], 'application', 'Petri net editor') ||
    !accessibleName(accessibility['canvas'], 'region', 'Petri net canvas') ||
    !accessiblePattern(dynamic['place'], ACCESSIBLE_NAME_PATTERNS.place) ||
    !accessiblePattern(dynamic['transition'], ACCESSIBLE_NAME_PATTERNS.transition) ||
    !accessiblePattern(dynamic['arc'], ACCESSIBLE_NAME_PATTERNS.arc) ||
    !accessibleNameArray(accessibility['controls']) ||
    !accessibleNameArray(accessibility['inspectorFields']) ||
    !feedbackRoles(accessibility['feedbackRoles']) ||
    !stringRecord(value['interactions']) ||
    !nonemptyStrings(value['rules'])
  ) {
    invalid();
  }

  const controlNames = (accessibility['controls'] as AccessibleNameContract[]).map((item) => item.name);
  const requiredControls = [
    'Add place',
    'Add transition',
    'Draw arc',
    'Fire selected transition',
    'Delete selection',
    'New net',
    'Reset marking',
    'Export JSON',
    'Import JSON',
  ];
  if (
    controlNames.length !== requiredControls.length ||
    new Set(controlNames).size !== requiredControls.length ||
    requiredControls.some((name) => !controlNames.includes(name))
  ) {
    invalid();
  }

  return value as unknown as BrowserExecutionCasePublicContract;
}

function parseBrunchHostLandingContract(
  value: Record<string, unknown>,
): BrunchHostLandingExecutionCasePublicContract {
  const caseValue = requiredRecord(value, 'case');
  const repository = requiredRecord(caseValue, 'repository');
  const budgets = requiredRecord(value, 'budgets');
  const delivery = requiredRecord(value, 'delivery');
  const acceptance = requiredRecord(value, 'acceptance');
  if (
    !exactKeys(value, ['schemaVersion', 'case', 'budgets', 'delivery', 'acceptance', 'rules']) ||
    !exactKeys(caseValue, [
      'id',
      'specification',
      'specificationSha256',
      'provider',
      'model',
      'product',
      'mode',
      'scope',
      'surface',
      'repository',
    ]) ||
    !exactKeys(repository, ['substrate', 'parentCommit', 'parentTree']) ||
    !exactKeys(budgets, ['elapsedMinutes', 'mechanicalInterventions', 'substantiveHumanInterventions']) ||
    !exactKeys(delivery, ['runtimeNetwork', 'dependencyInstallNetwork']) ||
    !exactKeys(acceptance, ['publicCommand', 'executionTerminal']) ||
    value['schemaVersion'] !== 1 ||
    caseValue['id'] !== 'brunch-host-landing-v1' ||
    caseValue['specification'] !== 'spec.md' ||
    !sha256HexValue(caseValue['specificationSha256']) ||
    caseValue['provider'] !== 'anthropic' ||
    caseValue['model'] !== 'claude-opus-4-8' ||
    caseValue['product'] !== 'brunch' ||
    caseValue['mode'] !== 'brownfield' ||
    caseValue['scope'] !== 'single_feature' ||
    caseValue['surface'] !== 'backend' ||
    repository['substrate'] !== 'pinned_git' ||
    !gitObjectId(repository['parentCommit']) ||
    !gitObjectId(repository['parentTree']) ||
    budgets['elapsedMinutes'] !== 90 ||
    budgets['mechanicalInterventions'] !== 2 ||
    budgets['substantiveHumanInterventions'] !== 0 ||
    delivery['runtimeNetwork'] !== 'forbidden' ||
    delivery['dependencyInstallNetwork'] !== 'forbidden' ||
    acceptance['publicCommand'] !== '/brunch:land' ||
    acceptance['executionTerminal'] !== 'promotion_prepared' ||
    !nonemptyStrings(value['rules'])
  ) {
    invalid();
  }
  return value as unknown as BrunchHostLandingExecutionCasePublicContract;
}

const PETRINAUT_MECHANICAL_ADDRESS_KEYS = [
  'skipTour',
  'dismissAssistant',
  'simulateMode',
  'optimizationsNav',
  'viewTitle',
  'create',
  'createDrawer',
  'scenario',
  'metric',
  'metricCode',
  'directionMaximize',
  'directionMinimize',
  'run',
  'cancel',
  'statusComplete',
  'statusError',
  'statusCancelled',
] as const satisfies readonly PetrinautMechanicalAddressKey[];

const PETRINAUT_MECHANICAL_ADDRESSES = {
  skipTour: { kind: 'roleName', role: 'button', name: 'Skip tour' },
  dismissAssistant: { kind: 'roleName', role: 'button', name: 'Dismiss' },
  simulateMode: { kind: 'roleName', role: 'radio', name: 'Simulate' },
  optimizationsNav: { kind: 'roleValue', role: 'radio', value: 'optimizations' },
  viewTitle: { kind: 'exactText', text: 'Optimizations' },
  create: { kind: 'roleName', role: 'button', name: 'Create' },
  createDrawer: { kind: 'roleName', role: 'dialog', name: 'Create an optimization' },
  scenario: { kind: 'roleContents', role: 'combobox', contents: 'Select a scenario' },
  metric: { kind: 'roleContents', role: 'combobox', contents: 'Select a metric' },
  metricCode: { kind: 'roleName', role: 'textbox', name: 'Editor content' },
  directionMaximize: { kind: 'roleName', role: 'radio', name: 'Maximize' },
  directionMinimize: { kind: 'roleName', role: 'radio', name: 'Minimize' },
  run: { kind: 'roleName', role: 'button', name: 'Run' },
  cancel: { kind: 'roleName', role: 'button', name: 'Cancel' },
  statusComplete: { kind: 'exactText', text: 'Complete' },
  statusError: { kind: 'exactText', text: 'Error' },
  statusCancelled: { kind: 'exactText', text: 'Cancelled' },
} as const satisfies Record<PetrinautMechanicalAddressKey, PetrinautMechanicalAddress>;

function parsePetrinautOptimizationContract(
  value: Record<string, unknown>,
): PetrinautOptimizationExecutionCasePublicContract {
  const caseValue = requiredRecord(value, 'case');
  const repository = requiredRecord(caseValue, 'repository');
  const budgets = requiredRecord(value, 'budgets');
  const delivery = requiredRecord(value, 'delivery');
  const acceptance = requiredRecord(value, 'acceptance');
  const mechanicalAddresses = requiredRecord(value, 'mechanicalAddresses');
  if (
    !exactKeys(value, [
      'schemaVersion',
      'case',
      'budgets',
      'delivery',
      'acceptance',
      'mechanicalAddresses',
      'rules',
    ]) ||
    !exactKeys(caseValue, [
      'id',
      'specification',
      'specificationSha256',
      'provider',
      'model',
      'product',
      'mode',
      'scope',
      'surface',
      'repository',
    ]) ||
    !exactKeys(repository, ['substrate', 'parentCommit', 'parentTree']) ||
    !exactKeys(budgets, ['elapsedMinutes', 'mechanicalInterventions', 'substantiveHumanInterventions']) ||
    !exactKeys(delivery, ['runtimeNetwork', 'dependencyInstallNetwork']) ||
    !exactKeys(acceptance, ['publicRoute', 'sameOriginApi', 'executionTerminal']) ||
    !exactKeys(mechanicalAddresses, PETRINAUT_MECHANICAL_ADDRESS_KEYS) ||
    value['schemaVersion'] !== 1 ||
    caseValue['id'] !== 'petrinaut-optimization-v1' ||
    caseValue['specification'] !== 'spec.md' ||
    !sha256HexValue(caseValue['specificationSha256']) ||
    caseValue['provider'] !== 'anthropic' ||
    caseValue['model'] !== 'claude-opus-4-8' ||
    caseValue['product'] !== 'petrinaut' ||
    caseValue['mode'] !== 'brownfield' ||
    caseValue['scope'] !== 'single_feature' ||
    caseValue['surface'] !== 'frontend' ||
    repository['substrate'] !== 'pinned_git' ||
    repository['parentCommit'] !== '5c7a2d9db5caa851c38938f4b1bac19005b0e978' ||
    repository['parentTree'] !== 'a3e08cf75e00cc9016c931f4665341506e03533e' ||
    budgets['elapsedMinutes'] !== 90 ||
    budgets['mechanicalInterventions'] !== 2 ||
    budgets['substantiveHumanInterventions'] !== 0 ||
    delivery['runtimeNetwork'] !== 'forbidden' ||
    delivery['dependencyInstallNetwork'] !== 'controller_only' ||
    acceptance['publicRoute'] !== '/optimization' ||
    acceptance['sameOriginApi'] !== '/api/petrinaut-opt/optimize/all' ||
    acceptance['executionTerminal'] !== 'promotion_prepared' ||
    !petrinautMechanicalAddresses(mechanicalAddresses) ||
    !nonemptyStrings(value['rules'])
  ) {
    invalid();
  }
  return value as unknown as PetrinautOptimizationExecutionCasePublicContract;
}

function petrinautMechanicalAddresses(
  value: Record<string, unknown>,
): value is Record<PetrinautMechanicalAddressKey, PetrinautMechanicalAddress> {
  return PETRINAUT_MECHANICAL_ADDRESS_KEYS.every((key) =>
    sameMechanicalAddress(value[key], PETRINAUT_MECHANICAL_ADDRESSES[key]),
  );
}

function sameMechanicalAddress(value: unknown, expected: PetrinautMechanicalAddress): boolean {
  if (!record(value) || value['kind'] !== expected.kind) return false;
  switch (expected.kind) {
    case 'roleName':
      return value['role'] === expected.role && value['name'] === expected.name;
    case 'roleValue':
      return value['role'] === expected.role && value['value'] === expected.value;
    case 'roleContents':
      return value['role'] === expected.role && value['contents'] === expected.contents;
    case 'exactText':
      return value['text'] === expected.text;
  }
}

function parseJson(raw: string): unknown {
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    throw new Error('invalid public execution contract JSON');
  }
}

function requiredRecord(value: Record<string, unknown>, key: string): Record<string, unknown> {
  const selected = value[key];
  if (!record(selected)) invalid();
  return selected;
}

function command(value: unknown, expectedCommand: string, expectedArgs: readonly string[]): boolean {
  if (!record(value) || value['command'] !== expectedCommand || !Array.isArray(value['args'])) return false;
  return (
    value['args'].length === expectedArgs.length &&
    value['args'].every((arg, index) => arg === expectedArgs[index])
  );
}

function accessibleName(value: unknown, role?: string, name?: string): value is AccessibleNameContract {
  return (
    record(value) &&
    typeof value['role'] === 'string' &&
    typeof value['name'] === 'string' &&
    (role === undefined || value['role'] === role) &&
    (name === undefined || value['name'] === name)
  );
}

export function compileAccessibleNamePattern(namePattern: AccessibleNamePattern): RegExp {
  switch (namePattern) {
    case ACCESSIBLE_NAME_PATTERNS.place:
      return /^Place: .+$/u;
    case ACCESSIBLE_NAME_PATTERNS.transition:
      return /^Transition: .+ \((enabled|disabled)\)$/u;
    case ACCESSIBLE_NAME_PATTERNS.arc:
      return /^Arc: .+ to .+$/u;
  }
}

function accessiblePattern(
  value: unknown,
  expectedPattern: AccessibleNamePattern,
): value is AccessiblePatternContract {
  return record(value) && value['role'] === 'button' && value['namePattern'] === expectedPattern;
}

function accessibleNameArray(value: unknown): value is AccessibleNameContract[] {
  return Array.isArray(value) && value.length > 0 && value.every((item) => accessibleName(item));
}

function feedbackRoles(value: unknown): boolean {
  return (
    Array.isArray(value) &&
    value.length === 2 &&
    value.includes('status') &&
    value.includes('alert') &&
    value.every((role) => role === 'status' || role === 'alert')
  );
}

function stringRecord(value: unknown): boolean {
  return record(value) && Object.keys(value).length > 0 && Object.values(value).every(nonempty);
}

function nonemptyStrings(value: unknown): value is string[] {
  return Array.isArray(value) && value.length > 0 && value.every(nonempty);
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function nonempty(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function sha256HexValue(value: unknown): value is string {
  return typeof value === 'string' && /^[a-f0-9]{64}$/u.test(value);
}

function gitObjectId(value: unknown): value is string {
  return typeof value === 'string' && /^[a-f0-9]{40}$/u.test(value);
}

function exactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  return actual.length === wanted.length && actual.every((key, index) => key === wanted[index]);
}

function sha256Hex(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function invalid(): never {
  throw new Error('invalid fixed public execution contract');
}
