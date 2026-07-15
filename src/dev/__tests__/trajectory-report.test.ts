import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { SessionManager } from '@earendil-works/pi-coding-agent';
import { describe, expect, it } from 'vitest';

import type { BrunchTrajectoryEvent } from '../../.pi/extensions/dev-mode/introspection/trajectory.js';
import { renderBrunchSkills } from '../../agents/skills/registry.js';
import {
  parseTrajectoryReport,
  projectTrajectoryReport,
  readEvents,
  writeTrajectoryReport,
} from '../trajectory-report.js';

function assistant(text: string) {
  return {
    role: 'assistant' as const,
    content: [{ type: 'text' as const, text }],
    api: 'anthropic-messages',
    provider: 'anthropic',
    model: 'fixture',
    usage: {
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
      totalTokens: 0,
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
    },
    stopReason: 'stop' as const,
    timestamp: Date.now(),
  };
}

describe('joined trajectory report', () => {
  it('runtime-validates landed report artifacts', () => {
    expect(() =>
      parseTrajectoryReport({ schemaVersion: 1, runId: 'run-1', directives: [], transcriptEffects: [] }),
    ).not.toThrow();
    expect(() =>
      parseTrajectoryReport({
        schemaVersion: 1,
        runId: 'run-1',
        directives: [{ id: 'x', state: ['invented'] }],
        transcriptEffects: [],
      }),
    ).toThrow('malformed trajectory report');
  });

  it('projects directive states and transcript effects from only the active Pi branch', async () => {
    const workspace = await mkdtemp(join(tmpdir(), 'brunch-trajectory-'));
    const manager = SessionManager.create(workspace, join(workspace, '.brunch/sessions'));
    const fork = manager.appendMessage(assistant('shared effect'));
    manager.appendMessage(assistant('abandoned sibling effect'));
    manager.branch(fork);
    manager.appendMessage(assistant('persisted active effect'));
    const sessionFile = manager.getSessionFile()!;
    const location = '/skills/ingest/SKILL.md';
    const resultHash = hash('INGEST DIRECTIVE');
    const prompt = renderBrunchSkills([{ name: 'ingest', description: 'Ingest facts.', location }]);
    expect(prompt).toContain('<brunch-skills>');
    const events: BrunchTrajectoryEvent[] = [
      {
        ordinal: 1,
        kind: 'provider_request',
        turnIndex: 0,
        advertised: [{ category: 'skill', name: 'ingest', location }],
        contentHashes: [hash(prompt)],
        agentBodyHashes: [hash('fixed agent body')],
        controlHashes: [hash('runtime control')],
        unknownPromptHashes: [hash('unclassified context')],
        promptDirectives: [{ id: 'warrant-before-commit', hash: 'sha256:warrant', present: true }],
        gaps: [],
      },
      {
        ordinal: 2,
        kind: 'resource_read',
        turnIndex: 0,
        toolCallId: 'call-1',
        resource: location,
        resultHash,
        gaps: [],
      },
      {
        ordinal: 3,
        kind: 'provider_request',
        turnIndex: 0,
        advertised: [],
        contentHashes: [resultHash],
        agentBodyHashes: [hash('fixed agent body')],
        controlHashes: [hash('runtime control')],
        unknownPromptHashes: [],
        promptDirectives: [{ id: 'warrant-before-commit', hash: 'sha256:warrant', present: true }],
        gaps: [],
      },
      { ordinal: 4, kind: 'assistant_message', turnIndex: 0, textHash: hash('done'), gaps: [] },
    ];

    const report = await projectTrajectoryReport(
      { repoRoot: process.cwd(), workspace, sessionFile, runId: 'run-1' },
      events,
    );

    expect(report.directives).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'ingest', state: ['advertised', 'read', 'provider_visible'] }),
        expect.objectContaining({ category: 'agent_body', state: ['provider_visible'] }),
        expect.objectContaining({ category: 'runtime_control', state: ['provider_visible'] }),
        expect.objectContaining({ category: 'unclassified', state: ['unknown'] }),
      ]),
    );
    expect(report.transcriptEffects.map((effect) => effect.text)).toContain('persisted active effect');
    expect(report.transcriptEffects.map((effect) => effect.text)).not.toContain('abandoned sibling effect');
  });

  it('fails loudly on missing or ambiguous event correlation', async () => {
    const workspace = await mkdtemp(join(tmpdir(), 'brunch-trajectory-'));
    const manager = SessionManager.create(workspace, join(workspace, '.brunch/sessions'));
    manager.appendMessage(assistant('effect'));
    await expect(
      projectTrajectoryReport(
        { repoRoot: process.cwd(), workspace, sessionFile: manager.getSessionFile()!, runId: 'run-2' },
        [
          {
            ordinal: 2,
            kind: 'provider_request',
            turnIndex: 0,
            advertised: [],
            contentHashes: [],
            agentBodyHashes: [],
            controlHashes: [],
            unknownPromptHashes: [],
            promptDirectives: [{ id: 'warrant-before-commit', hash: 'sha256:warrant', present: true }],
            gaps: [],
          },
        ],
      ),
    ).rejects.toThrow('event ordinals are missing or ambiguous');
  });

  it('bounds an optional viewport', async () => {
    const workspace = await mkdtemp(join(tmpdir(), 'brunch-trajectory-'));
    const manager = SessionManager.create(workspace, join(workspace, '.brunch/sessions'));
    manager.appendMessage(assistant('effect'));
    const viewport = join(workspace, 'viewport.txt');
    await import('node:fs/promises').then(({ writeFile }) => writeFile(viewport, 'x'.repeat(40_000)));
    const report = await projectTrajectoryReport(
      {
        repoRoot: process.cwd(),
        workspace,
        sessionFile: manager.getSessionFile()!,
        runId: 'run-3',
        viewport,
      },
      [],
    );
    expect(report.viewport).toHaveLength(32_768);
    await expect(readFile(viewport, 'utf8')).resolves.toHaveLength(40_000);
  });

  it('globally bounds transcript effects and safely fences embedded backticks', async () => {
    const workspace = await mkdtemp(join(tmpdir(), 'brunch-trajectory-'));
    const manager = SessionManager.create(workspace, join(workspace, '.brunch/sessions'));
    for (let index = 0; index < 140; index++)
      manager.appendMessage(assistant(`${index}: ${'x'.repeat(1_000)}`));
    const viewport = join(workspace, 'viewport.txt');
    await writeFile(viewport, 'before\n```text\nembedded\n```\nafter');
    await mkdir(join(workspace, '.brunch/debug'), { recursive: true });
    await writeFile(join(workspace, '.brunch/debug/trajectory.ndjson'), '');
    const repoRoot = await mkdtemp(join(tmpdir(), 'brunch-trajectory-output-'));
    const output = await writeTrajectoryReport({
      repoRoot,
      workspace,
      sessionFile: manager.getSessionFile()!,
      runId: 'bounded',
      viewport,
    });
    const report = JSON.parse(await readFile(join(output, 'trajectory.json'), 'utf8'));
    expect(report.transcriptEffects.length).toBeLessThanOrEqual(128);
    expect(
      report.transcriptEffects.reduce((total: number, item: { text: string }) => total + item.text.length, 0),
    ).toBeLessThanOrEqual(65_536);
    const markdown = await readFile(join(output, 'report.md'), 'utf8');
    expect(markdown).toContain('````text\nbefore\n```text');
    expect(markdown).toContain('\n````\n');
  });

  it('validates NDJSON at the source line boundary', async () => {
    const file = join(await mkdtemp(join(tmpdir(), 'brunch-trajectory-source-')), 'events.ndjson');
    await writeFile(file, '{"ordinal":1,"kind":"invented","gaps":[]}\n');
    await expect(readEvents(file)).rejects.toThrow('trajectory source line 1');
  });

  it('defers passive shape gaps to a named report failure', async () => {
    const workspace = await mkdtemp(join(tmpdir(), 'brunch-trajectory-'));
    const manager = SessionManager.create(workspace, join(workspace, '.brunch/sessions'));
    manager.appendMessage(assistant('effect'));
    await expect(
      projectTrajectoryReport(
        { repoRoot: process.cwd(), workspace, sessionFile: manager.getSessionFile()!, runId: 'run-gap' },
        [{ ordinal: 1, kind: 'assistant_message', gaps: ['missing_turn_index', 'missing_message_text'] }],
      ),
    ).rejects.toThrow('trajectory correlation unresolved: assistant_message#1:missing_turn_index');
  });
});

function hash(value: string): string {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`;
}
