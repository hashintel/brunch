// Static contracts for project-local reporting skills.
//
// These skills can publish external reports, so the high-risk mutation and
// evidence-boundary rules are executable rather than review-only prose.
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
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

function markdownFiles(directoryPath) {
  return readdirSync(directoryPath, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directoryPath, entry.name);
    if (entry.isDirectory()) return markdownFiles(path);
    return entry.isFile() && entry.name.endsWith('.md') ? [path] : [];
  });
}

function checkRelativeMarkdownLinks(relativeDirectory) {
  const directoryPath = join(root, relativeDirectory);
  if (!existsSync(directoryPath)) {
    fail(`missing ${relativeDirectory}`);
    return;
  }

  for (const filePath of markdownFiles(directoryPath)) {
    const source = readFileSync(filePath, 'utf8');
    const sourceName = relative(root, filePath);
    for (const match of source.matchAll(/\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/gu)) {
      const href = match[1];
      if (/^(?:[a-z][a-z0-9+.-]*:|#|\/)/iu.test(href)) continue;
      let hrefPath;
      try {
        hrefPath = decodeURIComponent(href.split(/[?#]/u, 1)[0]);
      } catch {
        fail(`${sourceName}: invalid percent-encoding in relative link ${href}`);
        continue;
      }
      const targetPath = resolve(dirname(filePath), hrefPath);
      const targetName = relative(root, targetPath);
      if (targetName === '..' || targetName.startsWith(`..${sep}`)) {
        fail(`${sourceName}: relative link escapes repository root: ${href}`);
      } else if (!existsSync(targetPath)) {
        fail(`${sourceName}: dead relative link ${href}`);
      }
    }
  }
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
  'comparison kind: **elicitation**, **execution**, or **end-to-end**',
  'An invalid or failed attempt remains evidence',
  '- **Implementation:**',
  '- **Runtime:**',
  '- **Protocol:**',
  '- **Validity consequence:**',
  'Never publish controller-only oracle definitions',
  'No winner or broad benchmark claim without a predeclared rubric',
  'An active command or prompt that declares a complete operating procedure owns run conduct',
  'references/evaluation-strategy.md',
  'references/end-to-end-comparisons.md',
  'references/elicitation-comparisons.md',
  'references/execution-comparisons.md',
  'references/report-examples.md',
]);

const comparisonDescription = comparisonSkill.match(/^description:\s*(.+)$/m)?.[1] ?? '';
if (
  !comparisonDescription.includes('elicitation') ||
  !comparisonDescription.includes('execution') ||
  !comparisonDescription.includes('end-to-end') ||
  !comparisonDescription.includes('comparison')
) {
  fail(
    `${comparisonSkillPath}: description must name elicitation, execution, and end-to-end comparison triggers`,
  );
}

requirePhrases('.agents/skills/comparison-reporting/references/evaluation-strategy.md', [
  'codebase mode',
  'change scope',
  'interface type',
  'plan stability',
  'Freeze the rubric before',
  'judge model',
  'transition and action sequence',
  'structural similarity',
  'Manual run triggering is acceptable',
  'Do not claim deterministic execution from one repeated pair',
  'Three valid runs are the middle-loop default',
  'five valid runs are the outer-loop default',
]);

requirePhrases('.agents/skills/comparison-reporting/references/elicitation-comparisons.md', [
  'Approachable operator workflow',
  'Rigorous campaign',
  'substantive takeover',
  'Retain the invalid attempt',
  'not a score',
]);

const executionReferencePath = '.agents/skills/comparison-reporting/references/execution-comparisons.md';
const executionReference = requirePhrases(executionReferencePath, [
  '`ExecutionAttempt`',
  'masked-outcome packet',
  'unblinded-process packet',
  '`not_assessable`',
  'cases/<case-id>/spec.md',
  'cases/<case-id>/public-contract.json',
  'Do not recursively read the case directory',
  'Never publish controller-only oracle details',
  'Brunch Petri journal',
]);
if (executionReference.includes('`testing/execution-comparisons/cases/<case-id>/`')) {
  fail(`${executionReferencePath}: must not expose the case root as report evidence`);
}

requirePhrases('.agents/skills/comparison-reporting/references/end-to-end-comparisons.md', [
  'requirement traceability ledger',
  'elicited explicitly',
  'inferred correctly',
  'overall end-to-end result is valid only',
  'case-level association',
  'opaque requirement id',
]);

requirePhrases('.agents/skills/comparison-reporting/references/report-examples.md', [
  'Elicitation: contaminated pair, useful witness',
  'Execution: valid failure',
  'Execution: invalid attempt',
  'Determinism: bounded repeat campaign',
  'End-to-end: requirement traceability',
  'Cost is not assessable',
  'Hidden fixtures and exact oracle journeys are intentionally omitted',
]);

checkRelativeMarkdownLinks('.agents/skills/notion-reporting');
checkRelativeMarkdownLinks('.agents/skills/comparison-reporting');

if (errors.length > 0) {
  console.error(`check:reporting-skills FAILED (${errors.length})`);
  for (const error of errors) console.error(`  ✗ ${error}`);
  process.exit(1);
}

console.log('check:reporting-skills OK — 2 reporting skill contracts consistent');
