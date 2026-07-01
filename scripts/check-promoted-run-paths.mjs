// Fails if any committed `.fixtures/runs/**` artifact still contains an
// absolute developer-workstation path (leaked cwd, prompt-resource, or
// tool-call path). Enumerates via `git ls-files` so gitignored scratch
// output cannot hide or pollute the check. `.fixtures/seeds/**` is out of
// scope: those paths are curated source-domain input, not run evidence.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const WORKSTATION_ROOT = /\/(?:Users|home)\/[^/\s"]+/gu;

const files = execFileSync('git', ['ls-files', '.fixtures/runs'], { encoding: 'utf8' })
  .split('\n')
  .filter((line) => line.length > 0);

const offenders = [];
for (const file of files) {
  const text = readFileSync(file, 'utf8');
  const matches = text.match(WORKSTATION_ROOT);
  if (matches) {
    offenders.push({ file, roots: [...new Set(matches)] });
  }
}

if (offenders.length > 0) {
  for (const { file, roots } of offenders) {
    console.error(`${file}: ${roots.join(', ')}`);
  }
  console.error(
    `\n${offenders.length} promoted run file(s) contain developer-workstation paths. ` +
      'Normalize with a portable placeholder (e.g. <repo>, <workbench>, <ephemeral-workspace>, <external-source>) before committing.',
  );
  process.exit(1);
}

console.log(`check:promoted-run-paths OK — ${files.length} .fixtures/runs files portable`);
