// Static contracts for project-local reporting skills.
//
// These skills can publish external reports, so the high-risk mutation and
// evidence-boundary rules are executable rather than review-only prose.
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const errors = [];

function fail(message) {
  errors.push(message);
}

function read(relativePath) {
  const path = join(root, relativePath);
  if (!existsSync(path)) {
    fail(`missing ${relativePath}`);
    return '';
  }
  return readFileSync(path, 'utf8');
}

function requirePhrases(relativePath, phrases) {
  const text = read(relativePath);
  for (const phrase of phrases) {
    if (!text.includes(phrase)) fail(`${relativePath}: missing required phrase "${phrase}"`);
  }
  return text;
}

const notionSkillPath = '.agents/skills/notion-reporting/SKILL.md';
const notionSkill = requirePhrases(notionSkillPath, [
  'name: notion-reporting',
  'Use MCP tool discovery',
  'Fetch the target page before editing it',
  'smallest safe mutation',
  'Never overwrite, move, or delete child pages or databases',
  'enhanced-Markdown',
  'Fetch the page again after every write',
  'references/notion-edit-safety.md',
  'references/report-shapes.md',
]);

const notionDescription = notionSkill.match(/^description:\s*(.+)$/m)?.[1] ?? '';
if (!notionDescription.includes('Notion') || !notionDescription.includes('report')) {
  fail(`${notionSkillPath}: description must name Notion report triggers`);
}

requirePhrases('.agents/skills/notion-reporting/references/notion-edit-safety.md', [
  'Discover the current Notion MCP tool schema',
  'Identify child `<page>` and `<database>` blocks that must survive',
  'Do not use full replacement as a convenience',
  'Fetch the page after writing',
]);

requirePhrases('.agents/skills/notion-reporting/references/report-shapes.md', [
  '**Overview**',
  '**Problem:**',
  '**Result:**',
  '# Findings',
  '## Evidence',
  '## Limitations',
  '**Side note',
]);

const comparisonSkillPath = '.agents/skills/comparison-reporting/SKILL.md';
const comparisonSkill = requirePhrases(comparisonSkillPath, [
  'name: comparison-reporting',
  '../notion-reporting/SKILL.md',
  'comparison kind: **elicitation** or **execution**',
  'An invalid or failed attempt remains evidence',
  '- **Implementation:**',
  '- **Runtime:**',
  '- **Protocol:**',
  '- **Validity consequence:**',
  'Never publish controller-only oracle definitions',
  'No winner or broad benchmark claim without a predeclared rubric',
  'references/elicitation-comparisons.md',
  'references/execution-comparisons.md',
  'references/report-examples.md',
]);

const comparisonDescription = comparisonSkill.match(/^description:\s*(.+)$/m)?.[1] ?? '';
if (
  !comparisonDescription.includes('elicitation') ||
  !comparisonDescription.includes('execution') ||
  !comparisonDescription.includes('comparison')
) {
  fail(`${comparisonSkillPath}: description must name elicitation and execution comparison triggers`);
}

requirePhrases('.agents/skills/comparison-reporting/references/elicitation-comparisons.md', [
  'Approachable operator workflow',
  'Rigorous campaign',
  'substantive takeover',
  'Retain the invalid attempt',
  'not a score',
]);

requirePhrases('.agents/skills/comparison-reporting/references/execution-comparisons.md', [
  '`ExecutionAttempt`',
  'masked-outcome packet',
  'unblinded-process packet',
  '`not_assessable`',
  'Never publish controller-only oracle details',
  'Brunch Petri journal',
]);

requirePhrases('.agents/skills/comparison-reporting/references/report-examples.md', [
  'Elicitation: contaminated pair, useful witness',
  'Execution: valid failure',
  'Execution: invalid attempt',
  'Cost is not assessable',
  'Hidden fixtures and exact oracle journeys are intentionally omitted',
]);

if (errors.length > 0) {
  console.error(`check:reporting-skills FAILED (${errors.length})`);
  for (const error of errors) console.error(`  ✗ ${error}`);
  process.exit(1);
}

console.log('check:reporting-skills OK — 2 reporting skill contracts consistent');
