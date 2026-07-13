import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { CapabilityRequirement } from './execution-contract.js';

// ceiling: manifest-only detection (package.json presence + scripts); workspace layout,
// lockfile package-manager discrimination, and polyglot manifests arrive with FE-1197
// slice B/C pressure.
export async function detectWorkspaceCapabilities(dir: string): Promise<readonly CapabilityRequirement[]> {
  let manifest: { readonly scripts?: Readonly<Record<string, string>> };
  try {
    manifest = JSON.parse(await readFile(join(dir, 'package.json'), 'utf8')) as typeof manifest;
  } catch {
    return [];
  }
  const source = { kind: 'detected', path: 'package.json' } as const;
  return [
    { id: 'node.npm', source },
    ...(manifest.scripts?.['test'] ? [{ id: 'node.npm-test', source }] : []),
    ...(manifest.scripts?.['verify'] ? [{ id: 'node.npm-verify', source }] : []),
  ];
}
