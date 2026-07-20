# Notion edit safety

Use this sequence for every Notion report mutation.

## Preflight

1. Discover the current Notion MCP tool schema.
2. Fetch the target URL or page id.
3. Read the existing content and ancestor path.
4. Identify child `<page>` and `<database>` blocks that must survive.
5. Check whether the requested section already exists.
6. Read the live enhanced-Markdown resource before using callouts, columns, embeds, synced blocks, or other advanced blocks.

Authentication or authorization failure is a blocker after one confirmed retry; do not work around it by publishing elsewhere.

## Mutation choice

- **Targeted revision:** use the smallest unique old/new content region.
- **New overview:** prepend one compact block.
- **New findings or side note:** append or insert next to the relevant section.
- **New report container:** create child pages only when the requested information architecture needs them.
- **Full replacement:** use only when the user requested a rewrite and the replacement preserves every child page/database block.

Do not use full replacement as a convenience. Do not delete or move existing child content without explicit approval.

## Evidence safety

- Publish only evidence appropriate to the destination audience.
- Prefer references to immutable artifacts over copying large transcripts.
- Do not paste credentials, private prompts, restricted evaluation material, or sensitive internal reasoning.
- Label reconstructed or incomplete evidence.
- Preserve exact user wording when the user asks for it; otherwise edit for clarity without changing meaning.

## Verification

Fetch the page after writing and compare against the intended delta:

- new content exists once and in the intended location;
- headings, lists, callouts, links, and code spans render correctly;
- existing report content remains;
- child pages and databases remain attached;
- no duplicate overview, side note, or findings section was introduced; and
- the final page contains no material outside the approved visibility boundary.

If formatting round-trips into malformed Markdown, make one narrow corrective update and fetch again.
