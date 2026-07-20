import { readFile, readdir } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const ROOT = resolve(import.meta.dirname, '../../../..');
const CURRENT_PRODUCT_ROOTS = ['src/.pi/components', 'src/.pi/extensions', 'src/agents'] as const;
const CURRENT_PRODUCT_FILES = [
  'src/dev/component-preview/registry.ts',
  'src/dev/consequential-fact-campaign-runner.ts',
] as const;

const STALE_PATTERNS = [
  /(?:how should|choose how)[^\n]{0,80}\bcontinue\b/iu,
  /\bwait for my next instruction\b/iu,
  /\/new[^\n]{0,80}\bcontinue\b/iu,
  /\bcontinue through\b/iu,
  /^\s*continue in\b/imu,
  /\bid\s*:\s*['"](?:continue|wait|dismiss(?:ed)?|proceed|next[-_ ]step)['"]/iu,
  /\blabel\s*:\s*['"](?:continue|wait|dismiss(?:ed)?|proceed|next step)['"]/iu,
  /sessionorientationchoice[^\n=]*=[^\n]*(?:['"]dismissed['"]|['"]continue['"])/iu,
  /\bchoice\s*={2,3}\s*['"](?:dismissed|continue)['"]/iu,
] as const;

const STALE_RIVALS = [
  "title: 'How should this session continue?'",
  "title: 'Choose how Execute mode should continue'",
  "{ id: 'continue', label: 'Continue', description: 'Wait for my next instruction.' }",
  'Use /new to continue within the selected spec.',
  'continue through map-plans',
  'Continue in `map-oracles.md`.',
  "type SessionOrientationChoice = ElicitationStyle | 'dismissed'",
  "if (choice === 'continue') originate();",
  "{ id: 'next-step', label: 'Next step' }",
] as const;

const PERMITTED_NEGATIVE_SPACE = [
  "registerCommand('brunch:continue', { description: 'Resume interrupted Brunch work' })",
  'Run /login, then try /brunch:continue again.',
  'ask({ continues: exchangeId })',
  'For offer continuations, call ask with continues only.',
  "{ action: 'continue' }",
  "type StartupDecision = 'continue' | 'openSession'",
  "expect(parseProcessMove('dismissed')).toBeUndefined()",
  "expect(parseProcessMove('continue')).toBeUndefined()",
  'if (!entry) continue;',
] as const;

describe('Continue lexical closure', () => {
  it('rejects stale progression/menu vocabulary from current product source and prompts', async () => {
    const findings: string[] = [];

    const currentFiles = await Promise.all(
      CURRENT_PRODUCT_ROOTS.map((root) => currentSurfaceFiles(join(ROOT, root))),
    );

    for (const file of [...currentFiles.flat(), ...CURRENT_PRODUCT_FILES.map((file) => join(ROOT, file))]) {
      const source = await readFile(file, 'utf8');
      for (const pattern of STALE_PATTERNS) {
        if (pattern.test(source)) findings.push(`${relative(ROOT, file)}: ${pattern.source}`);
      }
    }

    expect(findings).toEqual([]);
  });

  it('distinguishes the closed rivals from explicit negative space', () => {
    for (const stale of STALE_RIVALS) expect(isStale(stale), stale).toBe(true);
    for (const permitted of PERMITTED_NEGATIVE_SPACE) expect(isStale(permitted), permitted).toBe(false);
  });
});

function isStale(source: string): boolean {
  return STALE_PATTERNS.some((pattern) => pattern.test(source));
}

async function currentSurfaceFiles(root: string): Promise<string[]> {
  const files: string[] = [];
  for (const entry of await readdir(root, { withFileTypes: true })) {
    // Tests/fixtures carry parser rivals and user-authored prose; they are not current product copy.
    if (entry.name === '__tests__' || entry.name === 'fixtures' || entry.name === 'TOPOLOGY.md') continue;
    const path = join(root, entry.name);
    if (entry.isDirectory()) files.push(...(await currentSurfaceFiles(path)));
    else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.md'))) files.push(path);
  }
  return files;
}
