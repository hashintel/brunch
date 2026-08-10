# Component-preview surface

Date: 2026-08-10
Commit under test: `b4547932b` (`FE-1348: Validate seeded workbench fixture path`)
Entry point: `npm run dev:components -- <registry-id>`
Driver: project-owned `npm run tui-driver` fallback
Viewports: 120 × 40, 100 × 32, and 72 × 32

## Rendered qualitative witness

The current `COMPONENT_PREVIEW_REGISTRY` supplied the sampled ids; no historical component list was assumed. Four bounded sessions covered the named families without turning the pass into an exhaustive pixel review:

| Family | Registered entry | Viewport | Observation in both Brunch themes |
| --- | --- | --- | --- |
| Exchange picker | `exchange-decision-picker-rich-body` | 120 × 40 | Prompt, rich Markdown body, numbered choices, descriptions, controls, top label, and bottom label remained separated and readable. |
| Exchange/editor | `exchange-answer-editor` | 72 × 32 | The quote wrapped cleanly at the narrow width; list content, editing area, and submit/newline/cancel help remained visible without clipping. |
| Execute/editor | `brunch-editor-execute` | 100 × 32 | Execute mode and target labels remained attached to the editor border with an unobstructed editing area. |
| Browser-relevant semantic result | `present-review-set` | 72 × 32 | Intent, Implementation, and Assurance groups; kinds; ids; settled state; and references remained legible at narrow width. This is the same structured review-set content family consumed by the semantic presentation path, not a browser pixel oracle. |

Each session launched the real gallery directly at its registered entry. The initial dark-theme render was captured with `screen`; sending Ctrl+T as the literal PTY control byte (`--type $'\024'`) produced the light-theme render. The screen text remained stable, while `log` confirmed the palette changed to the light theme (for example background `48;2;249;249;249` and corresponding foreground/border color changes). This checks theme behavior qualitatively rather than treating ANSI bytes as a new structural golden.

Representative commands:

```bash
npm run tui-driver -- start --name fe1348-components-editor --cols 72 --rows 32 -- npm run dev:components -- exchange-answer-editor
npm run tui-driver -- wait --name fe1348-components-editor --text "Clarify the next slice" --timeout-ms 30000
npm run tui-driver -- screen --name fe1348-components-editor
npm run tui-driver -- send --name fe1348-components-editor --type $'\024'
npm run tui-driver -- screen --name fe1348-components-editor
npm run tui-driver -- log --name fe1348-components-editor --bytes 600
npm run tui-driver -- stop --name fe1348-components-editor
npm run tui-driver -- rm --name fe1348-components-editor
```

The same bounded start/observe/theme-toggle/observe/stop/remove sequence was used for `fe1348-components-normal`, `fe1348-components-execute`, and `fe1348-components-review`. The final lifecycle oracle reported:

```text
no sessions
```

## Structural oracle

Existing registry and snapshot-style component-preview tests remained the structural authority:

```text
npm test -- src/dev/component-preview/__tests__
Test Files  6 passed | 1 skipped (7)
Tests       37 passed | 1 skipped (38)
```

The skipped test count is unchanged by this evidence-only row.

## Incidental audit

1. **Owner / authority / outcome contradiction?** No. The real gallery resolved current registry ids and rendered production component families through the documented preview owner.
2. **Demonstrably unused duplicate / bridge / indirection?** No load-bearing-nowhere path was established by these samples.
3. **Same contract with fewer concepts or a more canonical seam?** No measurable simplification emerged from the rendered path.
4. **Test-only wiring absent from product?** No. The gallery's declared harness role supplied fixtures, while the sampled components and presentation options came from current production-owned registrations.

No genuine defect, architecture question, weak-evidence concern, or measurable simplification was observed, so `TESTING_FINDINGS.md` requires no entry.
