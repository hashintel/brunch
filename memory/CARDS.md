# Cards — Grounding free-text question format with hint-guided prompts

Frontier item: Track A #1
Traceability: D115, D120; A59, A63; Requirements 4, 27

## Card 1: Phase-aware free-text grounding questions `[status: done]`

**Objective**: Grounding questions use a free-text-only format (question + why + response note, no required options) while elicitation and later phases continue to require option selections.

**Acceptance Criteria**:

- `structuredQuestionSchema` accepts grounding questions without options (phase-aware variant or discriminated response mode)
- `ActiveQuestionCard` renders a free-text-only card when no options are present — showing question, why, impact, and a response note textarea without checkboxes or "none of the above"
- Response submission sends `kind: 'free-text'` for optionless grounding turns and persists correctly
- Elicitation, requirements, and criteria turns still require options ≥ 2 (schema enforcement unchanged for those phases)
- Observer capture works correctly on free-text grounding turns
- Answered grounding turn cards render the free-text response summary correctly
- `npm run verify` passes

**Verification**: Inner: `npm run verify`. Middle: manual greenfield grounding walkthrough.

## Card 2: Hint-guided grounding prompts `[status: in-progress]`

**Objective**: The grounding system prompt uses a priority-ordered topic list with example question shapes instead of generating questions from scratch.

**Acceptance Criteria**:

- `SYSTEM_PROMPTS.grounding` provides a priority-ordered topic list with example question shapes
- Prompt no longer mandates "2-4 options" or "mark exactly one as recommended" for grounding
- Prompt instructs open context-gathering questions with free-text response
- `sharedQuestionRules` in `getBrownfieldGroundingPrompt` similarly updated
- `npm run verify` passes

**Verification**: Inner: `npm run verify`. Middle: manual greenfield + brownfield grounding walkthroughs.
