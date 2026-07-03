import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

describe('structured exchange schema source boundary', () => {
  it('keeps semantic details contracts in the Zod schemas directory', () => {
    const extensionRoot = join(process.cwd(), 'src/.pi/extensions/exchanges');
    const legacyModel = join(extensionRoot, 'shared/model.ts');
    expect(existsSync(legacyModel)).toBe(false);

    const offenders: string[] = [];
    for (const file of sourceFiles(extensionRoot)) {
      if (file.includes('/schemas/')) continue;
      const source = readFileSync(file, 'utf8');
      if (/interface\s+StructuredExchange(?:Present|Request|Capture)?Details/.test(source)) {
        offenders.push(file);
        continue;
      }
      if (
        /schemaVersion:\s*1/.test(source) &&
        /brunch\\.structured_exchange\\.(?:present|request|capture)/.test(source)
      ) {
        offenders.push(file);
      }
    }
    expect(offenders.map((file) => file.replace(`${process.cwd()}/`, ''))).toEqual([]);
  });
});

function sourceFiles(dir: string): string[] {
  const entries = readdirSync(dir, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return entry.isFile() && path.endsWith('.ts') ? [path] : [];
  });
}
