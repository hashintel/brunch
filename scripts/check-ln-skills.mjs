// Consistency checker for the project-local `ln-*` skill system.
//
// Catches drift between skill folders, their frontmatter, the working guide,
// cross-skill links, and the Brunch-specific guardrails that keep deletion
// passes from eating intentional topology stubs. Read-only: it reports and
// sets the exit code, it never writes. No dependencies; Node built-ins only.
//
// Run via `npm run check:skills` (also chained into `npm run check`).
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const skillsDir = join(root, '.agents/skills');
const guidePath = join(root, 'docs/praxis/ln-skills.md');

/** @type {string[]} */
const errors = [];
/** @param {string} msg */
const fail = (msg) => errors.push(msg);
/** @param {string} name */
const skillFile = (name) => join(skillsDir, name, 'SKILL.md');

// Discover ln-* skills by folder.
const skills = readdirSync(skillsDir, { withFileTypes: true })
  .filter((d) => d.isDirectory() && d.name.startsWith('ln-'))
  .map((d) => d.name)
  .sort();

if (skills.length === 0) fail('no ln-* skills found under .agents/skills');

// 1. Each ln-* skill has a SKILL.md whose frontmatter `name` matches its folder.
for (const name of skills) {
  if (!existsSync(skillFile(name))) {
    fail(`${name}: missing SKILL.md`);
    continue;
  }
  const text = readFileSync(skillFile(name), 'utf8');
  const m = text.match(/^name:\s*(.+?)\s*$/m);
  if (!m) fail(`${name}: SKILL.md frontmatter has no \`name:\``);
  else if (m[1] !== name) fail(`${name}: frontmatter name \`${m[1]}\` != folder \`${name}\``);
}

// 2. Each ln-* skill is documented in the working guide.
let guideText = '';
if (existsSync(guidePath)) guideText = readFileSync(guidePath, 'utf8');
else fail('missing working guide docs/praxis/ln-skills.md');
for (const name of skills) {
  if (guideText && !guideText.includes(name)) {
    fail(`${name}: not referenced in docs/praxis/ln-skills.md`);
  }
}

// 3. Cross-skill relative links (../ln-x/SKILL.md) resolve to a real skill.
for (const name of skills) {
  if (!existsSync(skillFile(name))) continue;
  const text = readFileSync(skillFile(name), 'utf8');
  for (const m of text.matchAll(/\.\.\/(ln-[a-z-]+)\/SKILL\.md/g)) {
    if (!skills.includes(m[1])) fail(`${name}: dead cross-skill link ../${m[1]}/SKILL.md`);
  }
}

// 4. Brunch-specific guardrails must not silently disappear.
// The topology-stub carve-out is the #1 deletion-review hazard for this repo;
// ln-build additionally owns the verification-harness commitment.
/** @type {[string, string][]} */
const guardrails = [
  ['ln-review', 'intentional topology stubs'],
  ['ln-judo-review', 'intentional topology stubs'],
  ['ln-build', 'intentional topology stubs'],
  ['ln-build', 'verification harness'],
  // Owned-deferral rules: walkthrough findings and deferred outer evidence must
  // name an owner with a re-entry trigger, never park as unnamed "later lane" debt.
  ['ln-scope', 'named owning frontier'],
  ['ln-build', 'owned item with a re-entry trigger'],
  ['ln-sync', 'TESTING_FINDINGS.md'],
];
for (const [name, phrase] of guardrails) {
  if (existsSync(skillFile(name)) && !readFileSync(skillFile(name), 'utf8').includes(phrase)) {
    fail(`${name}: missing required guardrail phrase "${phrase}"`);
  }
}

if (errors.length > 0) {
  console.error(`check:skills FAILED (${errors.length})`);
  for (const e of errors) console.error(`  ✗ ${e}`);
  process.exit(1);
}
console.log(`check:skills OK — ${skills.length} ln-* skills consistent`);
