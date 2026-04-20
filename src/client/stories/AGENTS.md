# Stories

## Taxonomy

Stories follow a design-system cascade. Each tier builds on the one below it.

| Tier | What lives here | Examples |
|------|----------------|----------|
| **Tokens** | Named design values — colors, typography scale, shadows | `ink`, `text-sm-plus`, `--shadow-card-ring` |
| **Primitives** | Single-purpose UI elements with no domain knowledge | `ShellButton`, `TabSwitcher`, `EmptyCard`, `DrawerCard` |
| **Patterns** | Compositions of primitives, still domain-agnostic | Knowledge detail cards, activity placeholders |
| **Blocks** | Domain-specific stream artifacts projected into the workspace | Turn cards, control cards |
| **Layouts** | Page-level shells and panel compositions | App shell, spec workspace, transcript column |

## Lexicon

- **Turn card** — a durable interaction artifact persisted in the turn table. Substantive user-facing content: interview questions, review sets. Lives in `blocks/turn-cards/`.
- **Control card** — a projected structural affordance derived from workflow state, not persisted. Kickoff, recovery, closure confirmation, phase markers. Lives in `blocks/ctrl-cards/`.
- **Meta element** — transcript chrome that is neither a turn nor a control: thinking indicators, tool-use displays, generating placeholders. Lives in `patterns/meta-elements/`.
- **Projected** — derived from current workflow state at render time; disappears when conditions change. All control cards are projected.
- **Durable** — persisted in the turn table and part of the permanent transcript. All turn cards are durable.

## File conventions

### No index files

Use the sibling file + directory pattern. A `.stories.ts` barrel file sits beside the directory whose `.story.tsx` files it re-exports:

```
blocks/
├── ctrl-cards.stories.ts      ← barrel: title + re-exports
└── ctrl-cards/
    ├── phase-entry.story.tsx   ← implementation
    └── phase-closure.story.tsx
```

### Naming

- `.stories.ts` — barrel file. Defines the Ladle `title` and re-exports named story components from `.story.tsx` files.
- `.story.tsx` — implementation file. Contains the actual story component, fixture data, and any story-local wrappers.

### Story component pattern

Every `.story.tsx` exports a single named component (e.g. `PhaseEntryStory`). The barrel re-exports it under that name.

## Story layout

All story pages follow this structure:

```tsx
<ScrollArea className="flex-1">
  <div className="mx-auto max-w-5xl p-8">
    <h1 className="text-[22px] leading-none font-medium tracking-[-0.015em] text-ink">
      {title}
    </h1>
    <p className="mt-2.5 text-sm leading-relaxed text-sub">{subtitle}</p>

    <Separator className="my-8" />

    <section>
      <h2 className="text-base font-medium text-ink">{variant name}</h2>
      <p className="mt-1 text-sm text-sub">{description}</p>
      <div className="mt-6 max-w-2xl">{/* card goes here */}</div>
    </section>
  </div>
</ScrollArea>
```

Use `max-w-2xl` for most cards, `max-w-3xl` for review sets.

## Component imports

Always import from canonical component files. Never re-implement card internals locally in a story. If a component doesn't exist as a canonical export, extract it first, then import.

Key canonical sources:

| Component | Source |
|-----------|--------|
| `ActiveQuestionCard`, `AnsweredQuestionCard`, `ActivityPlaceholder`, `GeneratingTurnPlaceholder` | `@/client/components/question-cards` |
| `ReviewSetCard`, `ReviewPhaseCompletionCard` | `@/client/components/review-set-card` |
| `KickoffTurnCard`, `RecoveryTurnCard`, `PhaseSummaryCard`, `AcceptedClosureTurnCard` | `@/client/components/control-cards` |
| `KnowledgeDetailCard`, `KindBadge`, `CountBadge` | `@/client/components/knowledge-card` |
| `ShellButton`, `TabSwitcher`, `EmptyCard` | `@/client/components/app-shell` |
| `DrawerCard` | `@/client/components/drawer-card` |

## Button styles

`ShellButton` (from `@/client/components/app-shell`) with variants `ghost`, `outline`, `primary` is the canonical button. Do not use shadcn `Button` from `@/client/components/ui/button` for story-level UI or domain affordances — it carries incorrect styles for this project.

## Fixture data

- Use `createKnowledgeReferenceCode` from `@/shared/knowledge.js` for reference codes.
- Fixture data should be realistic and domain-appropriate (specification elicitation tool).
- For `ProjectStateTurn` fixtures, include `user_parts` with the `data-turn-response` format for persisted responses.
- Wire `onClick` handlers to `console.log` in non-interactive contexts.
