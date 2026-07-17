import { createHash } from 'node:crypto';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { SessionManager } from '@earendil-works/pi-coding-agent';
import { describe, expect, it } from 'vitest';

import type { BrunchTrajectoryEvent } from '../../.pi/extensions/dev-mode/introspection/trajectory.js';
import type { TrajectoryReport } from '../trajectory-report.js';
import { projectTrajectoryReport } from '../trajectory-report.js';

const captureContracts = {
  ingest: [
    resource('skill', 'ingest', '../../agents/skills/ingest/SKILL.md'),
    resource('reference', 'data-model', '../../agents/references/data-model.md'),
    resource('reference', 'readiness-bands', '../../agents/references/readiness-bands.md'),
  ],
  project: [
    resource('skill', 'project', '../../agents/skills/project/SKILL.md'),
    resource('reference', 'data-model', '../../agents/references/data-model.md'),
  ],
  propose: [
    resource('skill', 'propose', '../../agents/skills/propose/SKILL.md'),
    resource('reference', 'data-model', '../../agents/references/data-model.md'),
  ],
} as const;

describe('foreground capture-time resource invocation', () => {
  for (const [move, required] of Object.entries(captureContracts)) {
    it(`${move} distinguishes exact advertised, read, and provider-visible resources`, async () => {
      const report = await project(required);

      expect(() => assertCaptureContract(report, required)).not.toThrow();
      for (const expected of required) {
        expect(report.directives).toContainEqual({
          id: expected.name,
          category: expected.category,
          state: ['advertised', 'read', 'provider_visible'],
          resource: expected.location,
        });
      }
    });
  }

  it('rejects manifest-only evidence when a required resource was not read', async () => {
    const required = captureContracts.ingest;
    const report = await project(required, [required[0]!.location]);

    expect(() => assertCaptureContract(report, required)).toThrow(
      `capture resource was not read and provider-visible: ${required[0]!.location}`,
    );
  });

  it('does not let an unadvertised or different path satisfy an advertised resource', async () => {
    const required = captureContracts.project;
    const differentPath = `${required[0]!.location}.copy`;
    const report = await project(required, [required[0]!.location], [differentPath]);

    expect(() => assertCaptureContract(report, required)).toThrow(
      `capture resource was not read and provider-visible: ${required[0]!.location}`,
    );
    expect(report.directives.find((item) => item.id === required[0]!.name)?.state).toEqual(['advertised']);
  });
});

function resource(category: 'skill' | 'reference', name: string, relativePath: string) {
  return { category, name, location: fileURLToPath(new URL(relativePath, import.meta.url)) } as const;
}

async function project(
  required: readonly Resource[],
  omittedReads: readonly string[] = [],
  extraReads: readonly string[] = [],
): Promise<TrajectoryReport> {
  const workspace = await mkdtemp(join(tmpdir(), 'brunch-resource-invocation-'));
  const manager = SessionManager.create(workspace, join(workspace, '.brunch/sessions'));
  manager.appendMessage({ role: 'user', content: 'controlled capture trajectory', timestamp: Date.now() });
  const readResources = [...required.map((item) => item.location), ...extraReads].filter(
    (location) => !omittedReads.includes(location),
  );
  const events: BrunchTrajectoryEvent[] = [
    providerEvent(1, required),
    ...readResources.flatMap((location, index): BrunchTrajectoryEvent[] => {
      const resultHash = hash(`body:${location}`);
      const ordinal = index * 2 + 2;
      return [
        {
          ordinal,
          kind: 'resource_read',
          turnIndex: 0,
          toolCallId: `read-${index}`,
          resource: location,
          resultHash,
          gaps: [],
        },
        providerEvent(ordinal + 1, [], [resultHash]),
      ];
    }),
  ];
  return projectTrajectoryReport(
    { workspace, sessionFile: manager.getSessionFile()!, runId: 'resource-invocation' },
    events,
  );
}

function providerEvent(
  ordinal: number,
  advertised: readonly Resource[],
  contentHashes: readonly string[] = [],
): Extract<BrunchTrajectoryEvent, { kind: 'provider_request' }> {
  return {
    ordinal,
    kind: 'provider_request',
    turnIndex: 0,
    advertised,
    contentHashes,
    agentBodyHashes: [],
    controlHashes: [],
    unknownPromptHashes: [],
    promptDirectives: [],
    gaps: [],
  };
}

function assertCaptureContract(report: TrajectoryReport, required: readonly Resource[]): void {
  for (const expected of required) {
    const evidence = report.directives.find(
      (item) =>
        item.category === expected.category &&
        item.id === expected.name &&
        item.resource === expected.location,
    );
    const requiredStates = ['advertised', 'read', 'provider_visible'] as const;
    if (!evidence || !requiredStates.every((state) => evidence.state.includes(state))) {
      throw new Error(`capture resource was not read and provider-visible: ${expected.location}`);
    }
  }
}

type Resource = (typeof captureContracts)[keyof typeof captureContracts][number];

function hash(value: string): string {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`;
}
