import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const repoRoot = fileURLToPath(new URL('../../../..', import.meta.url));

function readRepoFile(path: string): string {
  return readFileSync(join(repoRoot, path), 'utf8');
}

function markdownFilesUnder(path: string): string[] {
  const absolutePath = join(repoRoot, path);

  return readdirSync(absolutePath)
    .flatMap((entry) => {
      const childPath = join(path, entry);
      const child = statSync(join(repoRoot, childPath));

      if (child.isDirectory()) return markdownFilesUnder(childPath);
      return entry.endsWith('.md') ? [childPath] : [];
    })
    .sort();
}

const activityResourceFiles = ['ingest', 'map', 'project', 'propose', 'review'].flatMap((skill) =>
  markdownFilesUnder(`src/agents/skills/${skill}`),
);

describe('D131-L assurance resource contract', () => {
  it('keeps physical compatibility vocabulary readable without making it live conduct', () => {
    const dataModel = readRepoFile('src/agents/references/data-model.md');
    const readinessBands = readRepoFile('src/agents/references/readiness-bands.md');

    for (const reference of [dataModel, readinessBands]) {
      expect(reference).toMatch(/`evidence` is capture-only/u);
      expect(reference).toMatch(/`vv_obligation` is legacy\/reserved/u);
      expect(reference).toMatch(/physical (?:graph |compatibility )?(?:schema|taxonomy|vocabulary)/u);
    }

    expect(dataModel).not.toMatch(/\| `example`\s+\| EX\s+\| Witness/u);
  });

  it('does not generate future evidence or legacy verification obligations in activity resources', () => {
    const forbiddenFutureAssurance = [
      /\bvv_obligation\b/u,
      /\bevidence plans?\b/iu,
      /\bevidence obligations?\b/iu,
      /\b(?:oracle|verification)\/evidence shape\b/iu,
      /\bchecks, methods, evidence, obligations\b/iu,
    ];

    for (const path of activityResourceFiles) {
      const contents = readRepoFile(path);
      for (const forbidden of forbiddenFutureAssurance) {
        expect(contents, `${path} contains contradicted future-assurance guidance`).not.toMatch(forbidden);
      }
    }
  });

  it('routes planned machinery to checks and only observations to claims', () => {
    const map = readRepoFile('src/agents/skills/map/SKILL.md');
    const mapOracles = readRepoFile('src/agents/skills/map/references/map-oracles.md');
    const ingest = readRepoFile('src/agents/skills/ingest/SKILL.md');
    const project = readRepoFile('src/agents/skills/project/references/design-to-oracle.md');
    const propose = readRepoFile('src/agents/skills/propose/references/oracle.md');
    const review = readRepoFile('src/agents/skills/review/SKILL.md');

    for (const guidance of [map, mapOracles, project, propose]) {
      expect(guidance).toMatch(/criterion.*vv_method.*check.*realization/isu);
      expect(guidance).toMatch(/observed.*evidence.*witness.*claim/isu);
    }

    expect(ingest).toMatch(/`evidence` is capture-only/iu);
    expect(review).toMatch(/only observed material.*witness.*claim/isu);
  });
});
