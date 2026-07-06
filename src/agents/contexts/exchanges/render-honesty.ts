export interface RenderElision {
  readonly path: string;
  readonly reason: string;
}

export type RenderRepresentations = Readonly<Record<string, readonly string[]>>;

export interface RenderHonestyOptions {
  readonly elisions: readonly RenderElision[];
  readonly representations?: RenderRepresentations;
}

export interface MissingRenderedLeaf {
  readonly path: string;
  readonly value: string;
}

/**
 * Checks that a structured exchange renderer either shows each populated leaf or
 * declares why that leaf is intentionally absent. Renderers use glob-like `*`
 * path segments for repeated shapes, e.g. `options.*.id`.
 */
export function missingRenderedDetailsLeaves(
  details: unknown,
  renderedText: string,
  options: RenderHonestyOptions,
): MissingRenderedLeaf[] {
  const elisionPatterns = options.elisions.map((elision) => elision.path);
  return collectPrimitiveLeaves(details)
    .filter(({ path }) => !matchesAny(path, elisionPatterns))
    .filter(
      ({ path, value }) =>
        !valueAppearsRendered(value, renderedText) &&
        !hasRenderedRepresentation(path, value, renderedText, options),
    )
    .map(({ path, value }) => ({ path, value }));
}

/**
 * Formatters may re-indent a multi-paragraph leaf under a list bullet or
 * blockquote, so the raw value (with its `\n\n` separators) may not appear
 * verbatim. Multi-line leaves must still be represented as one owned span: each
 * non-blank line appears in order, and only markdown structural punctuation may
 * sit between adjacent lines.
 */
function valueAppearsRendered(value: string, renderedText: string): boolean {
  if (renderedText.includes(value)) return true;
  const lines = value
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  return lines.length > 1 && linesAppearInOwnedSpan(lines, renderedText);
}

function linesAppearInOwnedSpan(lines: readonly string[], renderedText: string): boolean {
  const [firstLine, ...remainingLines] = lines;
  if (firstLine === undefined) return false;

  let searchFrom = 0;
  for (;;) {
    const firstIndex = renderedText.indexOf(firstLine, searchFrom);
    if (firstIndex === -1) return false;
    let previousEnd = firstIndex + firstLine.length;
    let ownedSpan = true;

    for (const line of remainingLines) {
      const nextIndex = renderedText.indexOf(line, previousEnd);
      if (nextIndex === -1 || !isMarkdownStructuralGap(renderedText.slice(previousEnd, nextIndex))) {
        ownedSpan = false;
        break;
      }
      previousEnd = nextIndex + line.length;
    }

    if (ownedSpan) return true;
    searchFrom = firstIndex + firstLine.length;
  }
}

function isMarkdownStructuralGap(value: string): boolean {
  return /^[\s>#*_`~\-:.,;()[\]]*$/.test(value);
}

function hasRenderedRepresentation(
  path: string,
  value: string,
  renderedText: string,
  options: RenderHonestyOptions,
): boolean {
  const representations = options.representations ?? {};
  for (const [pattern, tokens] of Object.entries(representations)) {
    if (
      matchesPath(path, pattern) &&
      tokens.some((token) => tokenRepresentsValue(pattern, token, value, renderedText))
    ) {
      return true;
    }
  }
  return false;
}

function tokenRepresentsValue(pattern: string, token: string, value: string, renderedText: string): boolean {
  if (!renderedText.includes(token)) return false;
  return !pattern.includes('*') || token.includes(value);
}

function collectPrimitiveLeaves(value: unknown, path = ''): MissingRenderedLeaf[] {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed ? [{ path, value: trimmed }] : [];
  }
  if (typeof value === 'number' || typeof value === 'boolean') return [{ path, value: String(value) }];
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => collectPrimitiveLeaves(item, appendPath(path, String(index))));
  }
  if (value && typeof value === 'object') {
    return Object.entries(value).flatMap(([key, child]) =>
      collectPrimitiveLeaves(child, appendPath(path, key)),
    );
  }
  return [];
}

function appendPath(base: string, segment: string): string {
  return base ? `${base}.${segment}` : segment;
}

function matchesAny(path: string, patterns: readonly string[]): boolean {
  return patterns.some((pattern) => matchesPath(path, pattern));
}

function matchesPath(path: string, pattern: string): boolean {
  const pathParts = path.split('.');
  const patternParts = pattern.split('.');
  if (pathParts.length !== patternParts.length) return false;
  return patternParts.every((part, index) => part === '*' || part === pathParts[index]);
}
