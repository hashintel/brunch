import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { CapabilityRequirement } from './execution-contract.js';

// Workspace facts are evidence only. They deliberately do not name a package manager or
// authorize commands; execution authority comes from spec-authored execute.* recipes.
export async function detectWorkspaceCapabilities(dir: string): Promise<readonly CapabilityRequirement[]> {
  let manifest: { readonly scripts?: Readonly<Record<string, string>> };
  try {
    manifest = JSON.parse(await readFile(join(dir, 'package.json'), 'utf8')) as typeof manifest;
  } catch {
    return [];
  }
  const source = { kind: 'detected', path: 'package.json' } as const;
  return [
    { id: 'node.package-json', source },
    ...(manifest.scripts?.['test'] ? [{ id: 'node.script.test', source }] : []),
    ...(manifest.scripts?.['verify'] ? [{ id: 'node.script.verify', source }] : []),
  ];
}
