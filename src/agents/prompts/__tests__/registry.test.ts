import { existsSync, readFileSync } from 'node:fs';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  BUNDLED_REFERENCE_IDS,
  bundledReferenceLocation,
  loadBrunchReferenceManifestEntries,
  renderBrunchReferences,
} from '../../references/registry.js';
import { LIVE_BRUNCH_SKILL_IDS, renderBrunchSkills } from '../../skills/registry.js';
import { BUNDLED_AGENT_BODY_IDS, bundledAgentBodyLocation, loadBundledAgentBody } from '../registry.js';

const referencesTopologyLocation = fileURLToPath(new URL('../../references/TOPOLOGY.md', import.meta.url));

describe('agent context registry', () => {
  it('owns the foreground body registry contract', () => {
    expect(BUNDLED_AGENT_BODY_IDS).toEqual(['elicitor', 'executor']);
  });

  it('keeps bundled foreground bodies literal, without raw template placeholders', () => {
    for (const bodyId of BUNDLED_AGENT_BODY_IDS) {
      const body = readFileSync(bundledAgentBodyLocation(bodyId), 'utf8');

      expect(body, bodyId).not.toMatch(/\$\{[^}]+\}/);
    }
  });

  it('reuses bundled bodies and resolves them independently of process cwd', async () => {
    const loaded = BUNDLED_AGENT_BODY_IDS.map(loadBundledAgentBody);
    const originalCwd = process.cwd();
    const unrelatedCwd = await mkdtemp(join(tmpdir(), 'brunch-body-cwd-'));

    process.chdir(unrelatedCwd);
    try {
      expect(BUNDLED_AGENT_BODY_IDS.map(loadBundledAgentBody)).toEqual(loaded);
      expect(loaded.every((body) => body.length > 0)).toBe(true);
      for (const entry of loadBrunchReferenceManifestEntries()) {
        expect(readFileSync(entry.location, 'utf8').length, entry.location).toBeGreaterThan(0);
      }
    } finally {
      process.chdir(originalCwd);
    }
  });

  it('exposes project as a first-level live Brunch skill with a portable absolute location', () => {
    const rendered = renderBrunchSkills();
    const projectLocationMatch =
      /<name>project<\/name>\s*<description>[^<]*<\/description>\s*<location>([^<]+)<\/location>/u.exec(
        rendered,
      );

    const projectLocation = projectLocationMatch?.[1];

    expect(LIVE_BRUNCH_SKILL_IDS).toContain('project');
    expect(rendered).toContain('<name>project</name>');
    expect(projectLocation).toMatch(/agents\/skills\/project\/SKILL\.md$/u);
    if (projectLocation) expect(existsSync(projectLocation)).toBe(true);
  });

  it('keeps the shared static reference manifest aligned with references topology', () => {
    const entries = loadBrunchReferenceManifestEntries();
    expect(loadBrunchReferenceManifestEntries()).toBe(entries);

    const topology = readFileSync(referencesTopologyLocation, 'utf8');
    const topologyReferenceIds = [...topology.matchAll(/[├└]── ([a-z-]+)\.md/gu)].map(
      (match) => match[1] ?? '',
    );
    const rendered = renderBrunchReferences();

    expect(BUNDLED_REFERENCE_IDS).toEqual(topologyReferenceIds);
    expect(rendered).toContain('[Brunch shared references]');
    for (const referenceId of BUNDLED_REFERENCE_IDS) {
      expect(rendered).toContain(`<name>${referenceId}</name>`);
      expect(rendered).toContain(`<location>${bundledReferenceLocation(referenceId)}</location>`);
      expect(existsSync(bundledReferenceLocation(referenceId))).toBe(true);
    }
  });
});
