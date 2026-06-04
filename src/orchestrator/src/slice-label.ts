// Cook display polish: derive a short, deterministic, human-readable
// suffix from a slice's `definition` so live progress lines read
// `req-4 · users-can-drag-nodes` instead of bare `req-4`.
//
// Display-only. The slice id stays the canonical key for branches
// (`cook-slice/<runId>/<id>`), `depends_on`, `reports.jsonl`, and any
// log scraper — none of which should churn when a requirement's text
// is edited.

const SLUG_STOP_WORDS = new Set([
  'a',
  'an',
  'and',
  'are',
  'as',
  'be',
  'by',
  'for',
  'in',
  'is',
  'of',
  'on',
  'or',
  'the',
  'to',
  'with',
]);

const MAX_WORDS = 4;
const MAX_SLUG_CHARS = 32;
const CLAUSE_BOUNDARY = /[,;.:]/;

/**
 * `${slice.id}` when the definition yields no usable slug; otherwise
 * `${slice.id} · ${slug}` where the slug is derived from the first
 * significant words of `slice.definition` — non-alphanumeric stripped,
 * stop words and sub-3-char fragments dropped wherever they appear,
 * capped to {@link MAX_WORDS} words and {@link MAX_SLUG_CHARS}
 * characters on a word boundary. Pure function — same input always
 * returns the same output.
 */
export function sliceLabel(slice: { id: string; definition?: string }): string {
  const slug = deriveSlug(slice.definition);
  return slug ? `${slice.id} · ${slug}` : slice.id;
}

function deriveSlug(definition: string | undefined): string | undefined {
  if (!definition) return undefined;

  // Cut at the first clause boundary so multi-clause requirements still
  // produce a focused slug from the lead clause.
  const clauseEnd = definition.search(CLAUSE_BOUNDARY);
  const lead = clauseEnd === -1 ? definition : definition.slice(0, clauseEnd);

  // Strip non-alphanumeric, drop stop words anywhere in the stream
  // (not just leading), and drop tokens shorter than 3 characters so
  // short fragments like the `em` in `em-dash` don't make it through.
  const content = lead
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 3 && !SLUG_STOP_WORDS.has(token))
    .slice(0, MAX_WORDS);
  if (content.length === 0) return undefined;

  // Cap on word boundary: keep appending words while the joined result
  // stays under MAX_SLUG_CHARS; never emit a partial trailing word.
  const slug: string[] = [];
  let length = 0;
  for (const word of content) {
    const next = length === 0 ? word.length : length + 1 + word.length;
    if (next > MAX_SLUG_CHARS) break;
    slug.push(word);
    length = next;
  }
  if (slug.length === 0) return undefined;

  return slug.join('-');
}
