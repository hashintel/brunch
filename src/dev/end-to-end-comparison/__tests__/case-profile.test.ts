import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

import { describe, expect, it } from 'vitest';

import { loadPublicCasePacket } from '../../execution-comparison/case-contract.js';
import { loadEndToEndStudyContract } from '../study-contract.js';

const repositoryRoot = fileURLToPath(new URL('../../../../', import.meta.url));
const petriStudy = join(
  repositoryRoot,
  'testing/end-to-end-comparisons/cases/minimal-petri-net-editor/study-contract.json',
);
const brunchStudy = join(
  repositoryRoot,
  'testing/end-to-end-comparisons/cases/brunch-host-landing/study-contract.json',
);
const petrinautStudy = join(
  repositoryRoot,
  'testing/end-to-end-comparisons/cases/petrinaut-optimization/study-contract.json',
);
const prospectExecution = join(
  repositoryRoot,
  'testing/execution-comparisons/cases/prospect-research-workspace',
);
const brunchExecution = join(repositoryRoot, 'testing/execution-comparisons/cases/brunch-host-landing');
const petrinautExecution = join(repositoryRoot, 'testing/execution-comparisons/cases/petrinaut-optimization');
const execFileAsync = promisify(execFile);

describe('compiled end-to-end comparison case profiles', () => {
  it('keeps prospect research as an execution case outside the end-to-end profiles', async () => {
    const [petri, brunch, petrinaut, prospectPacket, brunchPacket, petrinautPacket] = await Promise.all([
      loadEndToEndStudyContract({ repositoryRoot, contractPath: petriStudy }),
      loadEndToEndStudyContract({ repositoryRoot, contractPath: brunchStudy }),
      loadEndToEndStudyContract({ repositoryRoot, contractPath: petrinautStudy }),
      loadPublicCasePacket(prospectExecution),
      loadPublicCasePacket(brunchExecution),
      loadPublicCasePacket(petrinautExecution),
    ]);

    expect(petri.contract).toMatchObject({
      id: 'minimal-petri-net-editor-e2e-v1',
      caseId: 'minimal-petri-net-editor-v1',
      oracle: { id: 'minimal-petri-net-editor-oracles-v2' },
    });
    expect(brunch.contract).toMatchObject({
      id: 'brunch-host-landing-e2e-v1',
      caseId: 'brunch-host-landing-v1',
      oracle: { id: 'brunch-host-landing-oracles-v1' },
      source: {
        parentCommit: 'f5a423b19f76cf345d88053456870a126e451618',
        parentTree: 'a5709715a07faef0b96d3e05a7b6f9f8d693dd38',
      },
    });
    expect(petrinaut.contract).toMatchObject({
      id: 'petrinaut-optimization-e2e-v1',
      caseId: 'petrinaut-optimization-v1',
      oracle: { id: 'petrinaut-optimization-oracles-v1' },
      source: {
        parentCommit: '5c7a2d9db5caa851c38938f4b1bac19005b0e978',
        parentTree: 'a3e08cf75e00cc9016c931f4665341506e03533e',
      },
    });
    expect(brunchPacket.contract.case).toMatchObject({
      product: 'brunch',
      mode: 'brownfield',
      scope: 'single_feature',
      surface: 'backend',
      repository: {
        substrate: 'pinned_git',
        parentCommit: brunch.contract.source?.parentCommit,
        parentTree: brunch.contract.source?.parentTree,
      },
    });
    expect(prospectPacket.contract.case).toMatchObject({
      product: 'prospect_research_workspace',
      mode: 'greenfield',
      scope: 'whole_application',
      surface: 'full_stack',
      repository: { substrate: 'empty_dir', base: 'fresh-empty-commit' },
    });
    expect(petrinautPacket.contract.case).toMatchObject({
      product: 'petrinaut',
      mode: 'brownfield',
      scope: 'single_feature',
      surface: 'frontend',
      repository: {
        substrate: 'pinned_git',
        parentCommit: petrinaut.contract.source?.parentCommit,
        parentTree: petrinaut.contract.source?.parentTree,
      },
    });
    if (brunch.contract.source === undefined || petrinaut.contract.source === undefined) {
      throw new Error('brownfield profiles must declare source identity');
    }
    const actualBrunchTree = (
      await execFileAsync('git', ['rev-parse', `${brunch.contract.source.parentCommit}^{tree}`], {
        cwd: repositoryRoot,
      })
    ).stdout.trim();
    expect(actualBrunchTree).toBe(brunch.contract.source.parentTree);
  });

  it('keeps historical solution locators and controller expectations out of target-visible artifacts', async () => {
    const visiblePaths = [
      'testing/comparisons/missions/brunch-host-landing.md',
      'testing/end-to-end-comparisons/cases/brunch-host-landing/shared-baseline.md',
      'testing/execution-comparisons/cases/brunch-host-landing/spec.md',
      'testing/execution-comparisons/cases/brunch-host-landing/public-contract.json',
      'testing/comparisons/missions/petrinaut-optimization.md',
      'testing/end-to-end-comparisons/cases/petrinaut-optimization/shared-baseline.md',
      'testing/execution-comparisons/cases/petrinaut-optimization/spec.md',
      'testing/execution-comparisons/cases/petrinaut-optimization/public-contract.json',
    ];
    const visible = (
      await Promise.all(visiblePaths.map((path) => readFile(join(repositoryRoot, path), 'utf8')))
    ).join('\n');

    expect(visible).not.toMatch(/FE-1201|PR #336|pull\/336|0092a549|merged reference|historical solution/iu);
    expect(visible).not.toMatch(
      /FE-1162|PR #9051|pull\/9051|276e17d7|expected (?:tree|event|request)|final-commit-only|bookkeeping-retaining|historical solution/iu,
    );
  });
});
