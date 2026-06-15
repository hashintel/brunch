/**
 * Canonical web-side spec-id parser. A spec id is a positive integer (`1`, `2`,
 * …); `0`, leading-zero, and non-numeric tokens are not valid ids. Both the
 * `/spec/$specId` route and the follow-workspace-spec subscription derive ids
 * from URL strings — they share this rule so the surfaces cannot disagree on
 * what counts as a valid spec id.
 */
export function parseSpecId(value: string): number | undefined {
  if (!/^[1-9]\d*$/u.test(value)) return undefined;
  const specId = Number(value);
  return Number.isSafeInteger(specId) ? specId : undefined;
}

/** Parse the spec id from a `/spec/<id>` pathname, or `undefined` if it is not a spec route. */
export function parseSpecPathname(pathname: string): number | undefined {
  const token = /^\/spec\/([^/]+)\/?$/u.exec(pathname)?.[1];
  return token === undefined ? undefined : parseSpecId(token);
}
