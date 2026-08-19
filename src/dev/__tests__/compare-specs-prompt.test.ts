import { access, cp, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const promptPath = fileURLToPath(new URL('../../../.pi/prompts/compare-specs.md', import.meta.url));

const pathExists = async (path: string): Promise<boolean> => {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
};

const findEntries = async (root: string): Promise<string[]> => {
  const entries = await readdir(root, { withFileTypes: true });
  const descendants = await Promise.all(
    entries.map(async (entry) => {
      const path = join(root, entry.name);
      return entry.isDirectory() ? [path, ...(await findEntries(path))] : [path];
    }),
  );
  return descendants.flat();
};

describe('/compare-specs operator prompt', () => {
  it('continues without another selection turn when exactly one mission is eligible', async () => {
    const prompt = await readFile(promptPath, 'utf8');

    expect(prompt).toContain('If exactly one mission is eligible, select it and continue in this turn');
    expect(prompt).toContain('Only ask the operator to select a mission when more than one is eligible');
    expect(prompt).toContain('if none are eligible, report that and stop');
  });

  it('places every harness target in a fresh system-temporary root outside controller trees', async () => {
    const prompt = await readFile(promptPath, 'utf8');

    expect(prompt).toContain('invoking top-level project Pi session is the sole simulated-user actor');
    expect(prompt).toContain('Keep at most one comparison-harness shell live at a time');
    expect(prompt).toContain(
      'Never launch a separate simulated-user process or let one interactive shell own another',
    );
    expect(prompt).toContain('Never put the mission text, file, or path in a harness context or cwd');
    expect(prompt).toContain('fresh system-temporary external target root');
    expect(prompt).toContain('outside the controller checkout, scratch run tree, and retained run tree');
    expect(prompt).toContain('its ancestor directories contain no controller-private run material');
    expect(prompt).toContain(
      'Brunch still launches from the Brunch repository root and receives the external target through `--workspace`',
    );
    expect(prompt).toContain(
      'This placement closes ordinary target-relative ancestor traversal, including the known `../../private-mission.md` path',
    );
    expect(prompt).toContain(
      'It is not an OS sandbox and does not claim isolation from unrestricted absolute-path or whole-host discovery',
    );
    expect(prompt).toContain(
      'save its exact harness-visible transcript from the controller-owned `interactive_shell` record into controller-owned scratch evidence',
    );
    expect(prompt).toContain(
      'Copy only any unchanged harness-authored document from the external target into that scratch evidence',
    );
    expect(prompt).not.toContain(
      'copy the exact harness-visible transcript and any unchanged harness-authored document from the external target',
    );
    expect(prompt).toContain(
      'never overwrite an existing run directory, private mission snapshot, `harness-setup.md` snapshot, transcript, target output, or report',
    );
    expect(prompt).toContain('retain target-cwd/session identity, final process status, and cleanup notes');
    expect(prompt).toContain(
      'do not replace it with a parser, controller schema, helper state machine, generic runner, campaign framework, or automatic judge',
    );
  });

  it('keeps controller-private mission material outside target-root file visibility', async () => {
    const fixtureRoot = await mkdtemp(join(tmpdir(), 'compare-specs-prompt-'));
    const controllerCheckout = join(fixtureRoot, 'controller-checkout');
    const scratchRun = join(controllerCheckout, '.fixtures', 'scratch', 'comparisons', 'fixture-run');
    const externalRoot = await mkdtemp(join(tmpdir(), 'compare-specs-target-'));
    const target = join(externalRoot, 'targets', 'brunch');

    try {
      await mkdir(target, { recursive: true });
      await mkdir(scratchRun, { recursive: true });
      await writeFile(join(scratchRun, 'private-mission.md'), 'controller-only phrase\n');
      await writeFile(join(scratchRun, 'harness-setup.md'), 'controller-only setup\n');
      await writeFile(join(target, 'visible.md'), 'approved harness framing\n');

      expect(relative(controllerCheckout, target).startsWith('..')).toBe(true);
      expect(relative(scratchRun, target).startsWith('..')).toBe(true);

      const lsVisible = await readdir(target);
      expect(lsVisible).toEqual(['visible.md']);

      const findVisible = await findEntries(target);
      expect(findVisible.map((entry) => relative(target, entry))).toEqual(['visible.md']);

      const grepVisible = (await Promise.all(findVisible.map((entry) => readFile(entry, 'utf8')))).filter(
        (text) => text.includes('controller-only phrase'),
      );
      expect(grepVisible).toEqual([]);
      expect(findVisible.some((entry) => entry.includes('private-mission.md'))).toBe(false);

      const cs2Rival = resolve(target, '../../private-mission.md');
      expect(dirname(cs2Rival)).not.toBe(scratchRun);
      await expect(readFile(cs2Rival, 'utf8')).rejects.toMatchObject({ code: 'ENOENT' });
    } finally {
      await rm(fixtureRoot, { recursive: true, force: true });
      await rm(externalRoot, { recursive: true, force: true });
    }
  });

  it('retains controller snapshots and exact target output after external target cleanup', async () => {
    const fixtureRoot = await mkdtemp(join(tmpdir(), 'compare-specs-retained-flow-'));
    const scratchRun = join(fixtureRoot, 'controller-checkout', 'scratch', 'fixture-run');
    const retainedRun = join(fixtureRoot, 'controller-checkout', 'retained', 'fixture-run');
    const externalRoot = await mkdtemp(join(tmpdir(), 'compare-specs-target-'));
    const target = join(externalRoot, 'claude-code');
    const targetOutput = join(target, 'review-ready-spec.md');
    const targetOutputBytes = '# Target-authored output\n\nExact bytes stay unchanged.\n';
    const reportBytes = '# Operator-only report\n';

    try {
      await mkdir(scratchRun, { recursive: true });
      await mkdir(target, { recursive: true });
      await writeFile(join(scratchRun, 'private-mission.md'), 'approved private mission\n');
      await writeFile(join(scratchRun, 'harness-setup.md'), 'approved setup\n');
      await writeFile(targetOutput, targetOutputBytes);

      expect(await findEntries(target)).not.toContain(join(scratchRun, 'private-mission.md'));

      await mkdir(join(scratchRun, 'lanes', 'claude-code'), { recursive: true });
      await cp(targetOutput, join(scratchRun, 'lanes', 'claude-code', 'review-ready-spec.md'));
      await writeFile(join(scratchRun, 'report.md'), reportBytes);
      await rm(externalRoot, { recursive: true });
      await cp(scratchRun, retainedRun, { recursive: true });

      expect(await pathExists(target)).toBe(false);
      expect(await readFile(join(retainedRun, 'private-mission.md'), 'utf8')).toBe(
        'approved private mission\n',
      );
      expect(await readFile(join(retainedRun, 'harness-setup.md'), 'utf8')).toBe('approved setup\n');
      expect(await readFile(join(retainedRun, 'lanes', 'claude-code', 'review-ready-spec.md'), 'utf8')).toBe(
        targetOutputBytes,
      );
      expect(await readFile(join(retainedRun, 'report.md'), 'utf8')).toBe(reportBytes);
      expect((await findEntries(retainedRun)).some((entry) => entry.startsWith(target))).toBe(false);
    } finally {
      await rm(fixtureRoot, { recursive: true, force: true });
      await rm(externalRoot, { recursive: true, force: true });
    }
  });
});
