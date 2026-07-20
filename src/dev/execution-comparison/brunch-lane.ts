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
  loadPublicCasePacket,
  type ExecutionCasePublicContract,
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

export async function prepareBrunchExecutionWorkspace(input: {
  readonly workspaceDir: string;
  readonly caseDir: string;
}): Promise<PreparedBrunchExecutionWorkspace> {
  await mkdir(input.workspaceDir, { recursive: true });
  const existing = await readdir(input.workspaceDir);
  if (existing.length > 0) {
    throw new Error('Brunch execution comparison workspace must start empty');
  }

  const packet = await loadPublicCasePacket(input.caseDir);
  const specification = await readFile(join(input.caseDir, packet.contract.case.specification), 'utf8');
  const executor = await openWorkspaceCommandExecutor(input.workspaceDir);
  const seeded = seedFixture(
    executor,
    buildBrunchExecutionSeed({ specification, contract: packet.contract }),
  );
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

export function buildBrunchExecutionSeed(input: {
  readonly specification: string;
  readonly contract: ExecutionCasePublicContract;
}): SeedFixture {
  const sections = parseApprovedSpecification(input.specification);
  const nodes: SeedFixtureNode[] = sections.map((section, index) => sectionNode(section, index + 1));
  const next = sections.length + 1;
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
    const body = rawBody.split(/\n- basis:/u, 1)[0]!.trim();
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

function renderAccessibilityContract(contract: ExecutionCasePublicContract): string {
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
