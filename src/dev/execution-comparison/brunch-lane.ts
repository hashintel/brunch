import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { openWorkspaceCommandExecutor } from '../../graph/index.js';
import {
  seedFixture,
  type SeedFixture,
  type SeedFixtureEdge,
  type SeedFixtureNode,
} from '../../graph/seed-fixtures.js';
import {
  isBrowserExecutionCaseContract,
  isProspectResearchWorkspaceExecutionCaseContract,
  loadPublicCasePacket,
  type BrowserExecutionCasePublicContract,
  type ExecutionCasePublicContract,
  type ProspectResearchWorkspaceExecutionCasePublicContract,
  type PublicCasePacket,
} from './case-contract.js';

interface ApprovedSpecSection {
  readonly code: string;
  readonly title: string;
  readonly body: string;
}

export interface PreparedBrunchExecutionWorkspace {
  readonly workspaceDir: string;
  readonly specId: number;
  readonly publicDir: string;
  readonly packet: PublicCasePacket;
}

export interface SeededBrownfieldBrunchWorkspace {
  readonly workspaceDir: string;
  readonly specId: number;
  readonly packet: PublicCasePacket;
}

export async function prepareBrunchExecutionWorkspace(input: {
  readonly workspaceDir: string;
  readonly caseDir: string;
  readonly specificationMode?: 'coded' | 'opaque';
}): Promise<PreparedBrunchExecutionWorkspace> {
  await mkdir(input.workspaceDir, { recursive: true });
  const existing = await readdir(input.workspaceDir);
  if (existing.length > 0) {
    throw new Error('Brunch execution comparison workspace must start empty');
  }

  const packet = await loadPublicCasePacket(input.caseDir);
  if (
    !isBrowserExecutionCaseContract(packet.contract) &&
    !isProspectResearchWorkspaceExecutionCaseContract(packet.contract)
  ) {
    throw new Error('greenfield Brunch execution seed received a brownfield contract');
  }
  const specification = await readFile(join(input.caseDir, packet.contract.case.specification), 'utf8');
  const executor = await openWorkspaceCommandExecutor(input.workspaceDir);
  const fixture = isProspectResearchWorkspaceExecutionCaseContract(packet.contract)
    ? buildOpaqueProspectResearchExecutionSeed({ specification, contract: packet.contract })
    : input.specificationMode === 'opaque'
      ? buildOpaqueBrunchExecutionSeed({ specification, contract: packet.contract })
      : buildBrunchExecutionSeed({ specification, contract: packet.contract });
  const seeded = seedFixture(executor, fixture);
  const publicDir = join(input.workspaceDir, '.brunch', 'execution-comparison', 'public');
  await mkdir(publicDir, { recursive: true });
  await writeFile(join(publicDir, 'spec.md'), specification, { encoding: 'utf8', flag: 'wx' });
  await writeFile(
    join(publicDir, 'public-contract.json'),
    await readFile(join(input.caseDir, 'public-contract.json'), 'utf8'),
    { encoding: 'utf8', flag: 'wx' },
  );
  await writeFile(
    join(publicDir, 'packet-manifest.json'),
    `${JSON.stringify(
      {
        schemaVersion: 1,
        caseId: packet.contract.case.id,
        packetSha256: packet.packetSha256,
        files: packet.files,
      },
      null,
      2,
    )}\n`,
    { encoding: 'utf8', flag: 'wx' },
  );
  return { workspaceDir: input.workspaceDir, specId: seeded.specId, publicDir, packet };
}

export async function seedBrownfieldBrunchExecutionWorkspace(input: {
  readonly workspaceDir: string;
}): Promise<SeededBrownfieldBrunchWorkspace> {
  const packet = await loadPublicCasePacket(input.workspaceDir);
  if (isBrowserExecutionCaseContract(packet.contract) || packet.contract.case.mode !== 'brownfield') {
    throw new Error('brownfield Brunch execution seed requires a brownfield public contract');
  }
  const specification = await readFile(join(input.workspaceDir, packet.contract.case.specification), 'utf8');
  const executor = await openWorkspaceCommandExecutor(input.workspaceDir);
  const seeded = seedFixture(
    executor,
    buildOpaqueBrownfieldExecutionSeed({
      specification,
      contract: packet.contract,
    }),
  );
  const established = executor.establishSpecPosture({
    specId: seeded.specId,
    origin: 'brownfield',
  });
  if (established.status !== 'success') {
    throw new Error(`failed to establish brownfield Brunch execution posture: ${established.status}`);
  }
  return {
    workspaceDir: input.workspaceDir,
    specId: seeded.specId,
    packet,
  };
}

export function buildBrunchExecutionSeed(input: {
  readonly specification: string;
  readonly contract: BrowserExecutionCasePublicContract;
}): SeedFixture {
  const sections = parseApprovedSpecification(input.specification);
  const nodes: SeedFixtureNode[] = sections.map((section, index) => sectionNode(section, index + 1));
  return buildExecutionSeed({
    nodes,
    contract: input.contract,
  });
}

export function buildOpaqueBrunchExecutionSeed(input: {
  readonly specification: string;
  readonly contract: BrowserExecutionCasePublicContract;
}): SeedFixture {
  return buildExecutionSeed({
    nodes: [
      {
        local_id: 1,
        plane: 'intent',
        kind: 'requirement',
        title: 'Approved target-authored specification',
        body: input.specification,
        basis: 'explicit',
        settlement: 'settled',
        source: 'e2e-handoff [exact-spec]',
      },
      {
        local_id: 2,
        plane: 'intent',
        kind: 'criterion',
        title: 'Shared black-box case contract passes',
        body: 'The implementation satisfies the predeclared shared delivery and accessibility contract.',
        basis: 'explicit',
        settlement: 'settled',
        source: 'public-contract [criterion]',
      },
    ],
    contract: input.contract,
  });
}

export function buildOpaqueBrownfieldExecutionSeed(input: {
  readonly specification: string;
  readonly contract: ExecutionCasePublicContract;
}): SeedFixture {
  if (isBrowserExecutionCaseContract(input.contract) || input.contract.case.mode !== 'brownfield') {
    throw new Error('opaque brownfield seed requires a brownfield public contract');
  }
  return buildOpaqueExecutionSeed({
    specification: input.specification,
    slug: input.contract.case.id,
    name: `Approved ${input.contract.case.product} brownfield execution`,
    frontierTitle: 'Deliver the approved brownfield change',
    frontierBody: 'Implement the approved feature in the existing target repository.',
    scopeTitle: 'Implement and verify the approved brownfield change',
    scopeBody:
      'Execute the frozen specification as one coherent change while preserving the surrounding repository.',
    moduleTitle: 'Brownfield feature implementation',
    moduleBody: 'The implementation location and internal design remain the executor’s responsibility.',
    criterionTitle: 'Approved brownfield behavior is satisfied',
    criterionBody:
      'The completed change satisfies the frozen approved specification in the existing repository.',
    checkTitle: 'Repository-local verification passes',
    checkBody:
      'Use the prepared repository’s own focused build and test surfaces to verify the approved change.',
    methodTitle: 'Prepared-target verification',
    methodBody:
      'Run only repository-local verification available inside the prepared target under the execution isolation policy.',
  });
}

export function buildOpaqueProspectResearchExecutionSeed(input: {
  readonly specification: string;
  readonly contract: ProspectResearchWorkspaceExecutionCasePublicContract;
}): SeedFixture {
  return buildOpaqueExecutionSeed({
    specification: input.specification,
    slug: input.contract.case.id,
    name: 'Approved prospect research workspace execution',
    frontierTitle: 'Deliver the prospect research workspace',
    frontierBody: 'Implement the complete approved greenfield full-stack application and its own tests.',
    scopeTitle: 'Implement and verify the approved prospect research workspace',
    scopeBody:
      'Build the frozen specification as one coherent React, Node.js, TypeScript, and SQLite application.',
    moduleTitle: 'Full-stack prospect research application',
    moduleBody:
      'The React frontend, Node.js backend, SQLite store, and fixture-backed adapters form one local application.',
    criterionTitle: 'Approved prospect research behavior is satisfied',
    criterionBody:
      'The completed application satisfies the frozen specification and public full-stack contract.',
    checkTitle: 'Public package test and build commands pass',
    checkBody: 'npm test and npm run build both exit zero before promotion is prepared.',
    methodTitle: 'Full-stack execution harness',
    methodBody: [
      'Use only the package-owned commands declared by the public execution packet.',
      'execute.setup: npm install',
      'execute.build: npm run build',
      'execute.verify: npm test',
    ].join('\n'),
  });
}

function buildOpaqueExecutionSeed(input: {
  readonly specification: string;
  readonly slug: string;
  readonly name: string;
  readonly frontierTitle: string;
  readonly frontierBody: string;
  readonly scopeTitle: string;
  readonly scopeBody: string;
  readonly moduleTitle: string;
  readonly moduleBody: string;
  readonly criterionTitle: string;
  readonly criterionBody: string;
  readonly checkTitle: string;
  readonly checkBody: string;
  readonly methodTitle: string;
  readonly methodBody: string;
}): SeedFixture {
  return {
    spec: {
      slug: input.slug,
      name: input.name,
      kind: 'feature',
    },
    nodes: [
      {
        local_id: 1,
        plane: 'intent',
        kind: 'requirement',
        title: 'Approved target-authored specification',
        body: input.specification,
        basis: 'explicit',
        settlement: 'settled',
        source: 'e2e-handoff [exact-spec]',
      },
      {
        local_id: 2,
        plane: 'plan',
        kind: 'frontier',
        title: input.frontierTitle,
        body: input.frontierBody,
        basis: 'explicit',
        settlement: 'settled',
        source: 'execution-adapter [frontier]',
      },
      {
        local_id: 3,
        plane: 'plan',
        kind: 'scope',
        title: input.scopeTitle,
        body: input.scopeBody,
        basis: 'explicit',
        settlement: 'settled',
        source: 'execution-adapter [scope]',
      },
      {
        local_id: 4,
        plane: 'design',
        kind: 'module',
        title: input.moduleTitle,
        body: input.moduleBody,
        basis: 'explicit',
        settlement: 'settled',
        source: 'execution-adapter [module]',
      },
      {
        local_id: 5,
        plane: 'intent',
        kind: 'criterion',
        title: input.criterionTitle,
        body: input.criterionBody,
        basis: 'explicit',
        settlement: 'settled',
        source: 'execution-adapter [criterion]',
      },
      {
        local_id: 6,
        plane: 'oracle',
        kind: 'check',
        title: input.checkTitle,
        body: input.checkBody,
        basis: 'explicit',
        settlement: 'settled',
        source: 'execution-adapter [check]',
      },
      {
        local_id: 7,
        plane: 'oracle',
        kind: 'vv_method',
        title: input.methodTitle,
        body: input.methodBody,
        basis: 'explicit',
        settlement: 'settled',
        source: 'execution-adapter [vv_method]',
      },
    ],
    edges: [
      edge('composition', 2, 3),
      edge('realization', 1, 3),
      edge('dependency', 5, 3),
      edge('composition', 3, 4),
      edge('dependency', 6, 3),
      edge('witness', 6, 5, 'for'),
      edge('realization', 7, 6),
    ],
  };
}

function buildExecutionSeed(input: {
  readonly nodes: SeedFixtureNode[];
  readonly contract: BrowserExecutionCasePublicContract;
}): SeedFixture {
  const nodes = [...input.nodes];
  const next = nodes.length + 1;
  const deliveryId = next;
  const accessibilityId = next + 1;
  const frontierId = next + 2;
  const scopeId = next + 3;
  const moduleId = next + 4;
  const checkId = next + 5;
  const harnessId = next + 6;

  nodes.push(
    {
      local_id: deliveryId,
      plane: 'intent',
      kind: 'constraint',
      title: 'Public execution delivery contract',
      body: [
        `Run ${commandText(input.contract.delivery.test)} and ${commandText(input.contract.delivery.build)}.`,
        `The static production build must be written to ${input.contract.delivery.staticOutput}/.`,
        'The built application must require no runtime network access.',
      ].join('\n'),
      basis: 'explicit',
      settlement: 'settled',
      source: 'public-contract [delivery]',
    },
    {
      local_id: accessibilityId,
      plane: 'intent',
      kind: 'requirement',
      title: 'Public execution accessibility contract',
      body: renderAccessibilityContract(input.contract),
      basis: 'explicit',
      settlement: 'settled',
      source: 'public-contract [accessibility]',
    },
    {
      local_id: frontierId,
      plane: 'plan',
      kind: 'frontier',
      title: 'Deliver the minimal Petri-net editor',
      body: 'Implement the complete approved greenfield browser application and its own tests.',
      basis: 'explicit',
      settlement: 'settled',
      source: 'execution-adapter [frontier]',
    },
    {
      local_id: scopeId,
      plane: 'plan',
      kind: 'scope',
      title: 'Implement and verify the approved Petri-net editor',
      body: 'Build the frozen public specification as one coherent static browser application, preserving every linked requirement, criterion, constraint, design anchor, and verification obligation.',
      basis: 'explicit',
      settlement: 'settled',
      source: 'execution-adapter [scope]',
    },
    {
      local_id: moduleId,
      plane: 'design',
      kind: 'module',
      title: 'Static browser Petri-net editor',
      body: 'A pure client-side implementation whose internal framework, source topology, rendering strategy, and state model are left to the executor.',
      basis: 'explicit',
      settlement: 'settled',
      source: 'execution-adapter [module]',
    },
    {
      local_id: checkId,
      plane: 'oracle',
      kind: 'check',
      title: 'Public package test and build commands pass',
      body: `${commandText(input.contract.delivery.test)} and ${commandText(input.contract.delivery.build)} both exit zero, and the static output exists at ${input.contract.delivery.staticOutput}/.`,
      basis: 'explicit',
      settlement: 'settled',
      source: 'public-contract [check]',
    },
    {
      local_id: harnessId,
      plane: 'oracle',
      kind: 'vv_method',
      title: 'Project execution harness',
      body: [
        'Use the package-owned commands declared by the common public execution packet.',
        'execute.setup: npm install',
        'execute.build: npm run build',
        'execute.verify: npm test',
      ].join('\n'),
      basis: 'explicit',
      settlement: 'settled',
      source: 'public-contract [vv_method]',
    },
  );

  const requirementIds = nodes.filter((node) => node.kind === 'requirement').map((node) => node.local_id);
  const criterionIds = nodes.filter((node) => node.kind === 'criterion').map((node) => node.local_id);
  const constraintIds = nodes.filter((node) => node.kind === 'constraint').map((node) => node.local_id);
  const edges: SeedFixtureEdge[] = [
    edge('composition', frontierId, scopeId),
    ...requirementIds.map((id) => edge('realization', id, scopeId)),
    ...constraintIds.map((id) => edge('realization', id, scopeId)),
    ...criterionIds.map((id) => edge('dependency', id, scopeId)),
    edge('composition', scopeId, moduleId),
    edge('dependency', checkId, scopeId),
    edge('witness', checkId, criterionIds[0]!, 'for'),
    edge('realization', harnessId, checkId),
  ];

  return {
    spec: {
      slug: input.contract.case.id,
      name: 'Minimal browser-based Petri-net editor',
      kind: 'product',
    },
    nodes,
    edges,
  };
}

export function parseApprovedSpecification(markdown: string): readonly ApprovedSpecSection[] {
  const sections: ApprovedSpecSection[] = [];
  const pattern = /^### ([A-Z]+\d+) (.+)\n\n([\s\S]*?)(?=^### |(?![\s\S]))/gmu;
  for (const match of markdown.matchAll(pattern)) {
    const code = match[1]!;
    const title = match[2]!.trim();
    const rawBody = match[3]!;
    const body = rawBody.split(/(?:^|\n)- basis:/u, 1)[0]!.trim();
    sections.push({ code, title, body: body.length > 0 ? body : title });
  }
  if (sections.length === 0 || !sections.some((section) => section.code === 'G1')) {
    throw new Error('approved execution specification has no parseable intent sections');
  }
  if (new Set(sections.map((section) => section.code)).size !== sections.length) {
    throw new Error('approved execution specification contains duplicate node codes');
  }
  return sections;
}

function sectionNode(section: ApprovedSpecSection, localId: number): SeedFixtureNode {
  const { plane, kind } = kindForCode(section.code);
  return {
    local_id: localId,
    plane,
    kind,
    title: section.title,
    body: section.body,
    basis: 'explicit',
    settlement: 'settled',
    source: `approved-spec [${section.code}]`,
    ...(kind === 'term'
      ? { detail: { definition: section.body } }
      : kind === 'decision'
        ? {
            detail: {
              chosen_option: section.body,
              rejected: ['(not recorded in approved specification)'],
              rationale: 'Approved through the frozen Brunch Specify run.',
            },
          }
        : {}),
  };
}

function kindForCode(code: string): {
  readonly plane: SeedFixtureNode['plane'];
  readonly kind: string;
} {
  if (code.startsWith('CON')) return { plane: 'intent', kind: 'constraint' };
  if (code.startsWith('AC')) return { plane: 'intent', kind: 'criterion' };
  if (code.startsWith('REQ')) return { plane: 'intent', kind: 'requirement' };
  if (code.startsWith('INV')) return { plane: 'intent', kind: 'invariant' };
  if (code.startsWith('G')) return { plane: 'intent', kind: 'goal' };
  if (code.startsWith('D')) return { plane: 'intent', kind: 'decision' };
  if (code.startsWith('T')) return { plane: 'intent', kind: 'term' };
  throw new Error(`unsupported approved specification code: ${code}`);
}

function renderAccessibilityContract(contract: BrowserExecutionCasePublicContract): string {
  const controls = contract.accessibility.controls
    .map((control) => `${control.role} "${control.name}"`)
    .join(', ');
  const fields = contract.accessibility.inspectorFields
    .map((field) => `${field.role} "${field.name}"`)
    .join(', ');
  return [
    `Expose one ${contract.accessibility.application.role} named "${contract.accessibility.application.name}" and one ${contract.accessibility.canvas.role} named "${contract.accessibility.canvas.name}".`,
    `Expose these controls by role and accessible name: ${controls}.`,
    `Dynamic item names must match ${Object.values(contract.accessibility.dynamic)
      .map((item) => `${item.role} /${item.namePattern}/`)
      .join(', ')}.`,
    `Applicable selected-item fields use: ${fields}.`,
    `Invalid input and import feedback uses role ${contract.accessibility.feedbackRoles.join(' or ')}.`,
    ...Object.values(contract.interactions),
  ].join('\n');
}

function commandText(command: { readonly command: string; readonly args: readonly string[] }): string {
  return [command.command, ...command.args].join(' ');
}

function edge(
  category: SeedFixtureEdge['category'],
  source_local_id: number,
  target_local_id: number,
  stance?: SeedFixtureEdge['stance'],
): SeedFixtureEdge {
  return {
    category,
    source_local_id,
    target_local_id,
    basis: 'explicit',
    settlement: 'settled',
    ...(stance === undefined ? {} : { stance }),
  };
}
