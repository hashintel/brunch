import { fileURLToPath } from 'node:url';

export const BUNDLED_REFERENCE_IDS = [
  'data-model',
  'node-neighbourhoods',
  'product-concept',
  'readiness-bands',
] as const;

export type BundledReferenceId = (typeof BUNDLED_REFERENCE_IDS)[number];

export interface BrunchReferenceManifestEntry {
  readonly name: BundledReferenceId;
  readonly description: string;
  readonly location: string;
}

const REFERENCE_DESCRIPTIONS = {
  'data-model': 'Graph vocabulary, planes, node kinds, edge categories, and model-facing data concepts.',
  'node-neighbourhoods': 'How to read graph neighborhoods, anchor-relative labels, and edge direction.',
  'product-concept': 'Short Brunch product concept, mode roles, and graph-native specification model.',
  'readiness-bands': 'Canonical readiness, settlement, and capability-readiness band terminology.',
} as const satisfies Readonly<Record<BundledReferenceId, string>>;

export function bundledReferenceHome(): string {
  return fileURLToPath(new URL('.', import.meta.url));
}

export function bundledReferenceLocation(id: BundledReferenceId): string {
  return fileURLToPath(new URL(`./${id}.md`, import.meta.url));
}

export function loadBrunchReferenceManifestEntries(): readonly BrunchReferenceManifestEntry[] {
  return BUNDLED_REFERENCE_IDS.map((id) => ({
    name: id,
    description: REFERENCE_DESCRIPTIONS[id],
    location: bundledReferenceLocation(id),
  }));
}

export function renderBrunchReferences(entries = loadBrunchReferenceManifestEntries()): string {
  if (entries.length === 0) return '';
  return [
    '[Brunch shared references]',
    '- These static references are shared by all foreground Brunch agents.',
    '- Use the read tool to load a listed reference at its given location when product, graph, ontology, or readiness context matters.',
    '- This manifest is discoverability only; reference bodies are loaded on demand, not inlined into every prompt.',
    '',
    '<brunch-references>',
    ...entries.flatMap((entry) => [
      '  <reference>',
      `    <name>${entry.name}</name>`,
      `    <description>${escapeXml(entry.description)}</description>`,
      `    <location>${escapeXml(entry.location)}</location>`,
      '  </reference>',
    ]),
    '</brunch-references>',
  ].join('\n');
}

const XML_TEXT_ESCAPES: Readonly<Record<string, string>> = {
  '&': '&amp;',
  '"': '&quot;',
  '<': '&lt;',
  '>': '&gt;',
};

function escapeXml(value: string): string {
  return value.replace(/[&"<>]/g, (char) => XML_TEXT_ESCAPES[char] ?? char);
}
