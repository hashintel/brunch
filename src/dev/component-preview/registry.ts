import type { KeybindingsManager, Theme } from '@earendil-works/pi-coding-agent';
import type { Component, TUI } from '@earendil-works/pi-tui';

import { registerBrunchAlternatives } from '../../.pi/components/alternatives.js';
import { BrunchEditorComponent } from '../../.pi/components/brunch-editor.js';
import { BrunchStartupHeader } from '../../.pi/components/chrome-header.js';
import { ConsultMenuComponent } from '../../.pi/components/consult-menu.js';
import { ExchangeAnswerEditorComponent } from '../../.pi/components/exchange-answer-editor.js';
import { ExchangeCandidatesResultComponent } from '../../.pi/components/exchange-candidates-result.js';
import { ExchangeDecisionPickerComponent } from '../../.pi/components/exchange-decision-picker.js';
import { ExchangeReviewSetResultComponent } from '../../.pi/components/exchange-review-set-result.js';
import { operationalModeBorderColor } from '../../.pi/components/mode-border-theme.js';
import { MultiChoicePickerComponent } from '../../.pi/components/multi-choice-picker.js';
import { createRuntimeModePickerComponent } from '../../.pi/components/runtime-posture/axis-picker.js';
import { TuiStyleLabComponent } from '../../.pi/components/tui-lab/index.js';
import {
  createWorkspaceDialogComponent,
  WORKSPACE_DIALOG_WIDTH,
} from '../../.pi/components/workspace-dialog/index.js';
import { renderMarkdownResult } from '../../.pi/extensions/exchanges/shared/markdown.js';
import type { WorkspaceLaunchInventory } from '../../session/workspace-session-coordinator.js';
import { showComponentPreview } from './custom-ui.js';
import {
  askFixture,
  presentCandidatesFixture,
  presentDigestFixture,
  presentQuestionOptionsFixture,
  presentReviewSetFixture,
  requestAnswerFixture,
  requestChoiceFixture,
  requestChoicesFixture,
  requestReviewFixture,
  requestTerminalFixture,
  structuralIllegalFixture,
} from './exchange-fixtures.js';
import { ReviewSetPrototypeComponent } from './review-set-prototype.js';
import { captureMessageRenderer, previewStaticComponent, sampleCustomMessage } from './static-preview.js';
import { ThemeTestbedComponent } from './theme-testbed.js';
import { createComponentPreviewEditorTheme } from './theme.js';

export interface ComponentPreviewEntry {
  readonly id: string;
  readonly label: string;
  /** Names the real production call site this entry's presentation options mirror. */
  readonly presentedLike: string;
  readonly open: (tui: TUI, theme: Theme, keybindings: KeybindingsManager) => Promise<unknown>;
}

function sampleWorkspaceInventory(): WorkspaceLaunchInventory {
  return {
    cwd: '/project',
    currentSpec: { id: 1, title: 'Alpha', kind: 'product', origin: 'greenfield', relatesToSpecId: null },
    currentSessionFile: '/sessions/alpha-current.jsonl',
    needsNewSpec: false,
    specs: [
      {
        spec: { id: 1, title: 'Alpha', kind: 'product', origin: 'greenfield', relatesToSpecId: null },
        sessions: [
          {
            id: 'session-alpha-current',
            file: '/sessions/alpha-current.jsonl',
            specId: 1,
            specTitle: 'Alpha',
            available: true,
          },
        ],
      },
      {
        spec: { id: 2, title: 'Beta', kind: 'product', origin: 'greenfield', relatesToSpecId: null },
        sessions: [
          { id: 'session-beta', file: '/sessions/beta.jsonl', specId: 2, specTitle: 'Beta', available: true },
        ],
      },
    ],
    unavailableSessions: [],
    workspacePopulated: false,
  };
}

/**
 * Long enough to overflow `WORKSPACE_DIALOG_MAX_VISIBLE_OPTIONS`, so the `specList` stage exercises
 * `.pi/components/scroll-viewport.ts`'s windowing + `▐` thumb. No `currentSpec` -> no "continue" home option, so "Continue another existing specification" is
 * index 0 and a single Enter reaches the scrollable list.
 */
const RICH_ASK_BODY = [
  '# Clarify the next slice',
  '',
  '> Use the evidence already in the transcript; do not widen the frontier.',
  '',
  '- Keep the answer tied to FE-1164',
  '- Prefer the smallest reversible move',
].join('\n');

function manySpecsWorkspaceInventory(specCount: number): WorkspaceLaunchInventory {
  return {
    cwd: '/project',
    currentSpec: null,
    currentSessionFile: null,
    needsNewSpec: false,
    specs: Array.from({ length: specCount }, (_, index) => ({
      spec: {
        id: index + 1,
        title: `Spec ${index}`,
        kind: 'product',
        origin: 'greenfield',
        relatesToSpecId: null,
      },
      sessions: [],
    })),
    unavailableSessions: [],
    workspacePopulated: false,
  };
}

/**
 * Each entry's `open` mirrors the real `ctx.ui.custom(factory, options)` call
 * at its production call site — same `options` shape, same `overlay` on/off —
 * not a uniform "always overlay" assumption. See `custom-ui.ts` and
 * `src/dev/TOPOLOGY.md`'s "Component Preview Harness" section for why that
 * matters.
 */
export const COMPONENT_PREVIEW_REGISTRY: readonly ComponentPreviewEntry[] = [
  {
    id: 'review-set-prototype',
    label: 'Review-set comparison prototype (FE-1187 R10)',
    presentedLike:
      'prototype-only inline comparison — current ExchangeReviewSetResultComponent card wall plus four information-hierarchy bets, including a grouped impact table, over one projected 17-node/11-edge present_review_set; no production settlement mechanics',
    open: (tui, theme, keybindings) =>
      showComponentPreview(
        tui,
        theme,
        keybindings,
        (_tui, previewTheme, _kb, done) => new ReviewSetPrototypeComponent(previewTheme, done),
      ),
  },
  {
    id: 'theme-testbed',
    label: 'Theme testbed (text, borders, markdown, syntax highlighting, contrast strip)',
    presentedLike:
      'harness-only reference surface — renders text variations, border levels, mode-reactive ' +
      'and surface-identity border roles from the theme files, the same fixture through pi assistant ' +
      'markdown (getMarkdownTheme + syntax* tokens) and brunch exchange markdown, plus a fg/bg ' +
      'contrast strip; hot-reloads src/.pi/themes/*.json edits while open',
    open: (tui, theme, keybindings) =>
      showComponentPreview(
        tui,
        theme,
        keybindings,
        (_tui, previewTheme, _kb, done) => new ThemeTestbedComponent(previewTheme, tui, () => done()),
      ),
  },
  {
    id: 'axis-picker',
    label: 'Runtime mode picker',
    presentedLike: 'inline swap — src/.pi/extensions/commands/index.ts (openModePicker)',
    open: (tui, theme, keybindings) =>
      showComponentPreview(tui, theme, keybindings, (_tui, previewTheme, _kb, done) =>
        createRuntimeModePickerComponent({ current: 'specify', theme: previewTheme, onDone: done }),
      ),
  },
  {
    id: 'consult-menu',
    label: 'Consult menu',
    presentedLike: 'inline swap — /brunch:consult orientation dialog (commands/index.ts)',
    open: (tui, theme, keybindings) =>
      showComponentPreview(
        tui,
        theme,
        keybindings,
        (_tui, previewTheme, _kb, done) =>
          new ConsultMenuComponent({
            title: 'Choose how Specify mode should continue',
            topLabel: '[ Specify ]',
            bottomLabel: '"Alpha"',
            choices: [
              {
                id: 'elicit_decisions',
                label: 'Work by decision',
                description: 'Use grill-style pressure to resolve choices.',
              },
              {
                id: 'propose_oracle',
                label: 'Prep verification for execution',
                description: 'Project test and evidence strategies for this frontier.',
              },
              {
                id: 'continue',
                label: 'Wait for me',
                description: 'Stay inert until your next instruction.',
              },
            ],
            theme: previewTheme,
            onDone: done,
          }),
      ),
  },
  {
    id: 'consult-menu-scroll',
    label: 'Consult menu (scroll)',
    presentedLike: 'inline swap — /brunch:consult orientation dialog, long-list scroll viewport demo',
    open: (tui, theme, keybindings) =>
      showComponentPreview(
        tui,
        theme,
        keybindings,
        (_tui, previewTheme, _kb, done) =>
          new ConsultMenuComponent({
            title: 'Choose how Execute mode should continue',
            topLabel: '[ Execute ]',
            bottomLabel: '"Alpha"',
            choices: Array.from({ length: 16 }, (_, index) => ({
              id: `consult-${index + 1}`,
              label: `Consult option ${index + 1}`,
              ...(index % 2 === 0
                ? { description: `Description ${index + 1} keeps two-line scrolling honest.` }
                : {}),
            })),
            theme: previewTheme,
            onDone: done,
          }),
      ),
  },
  {
    id: 'exchange-decision-picker',
    label: 'Exchange decision picker',
    presentedLike: 'inline swap — src/.pi/extensions/exchanges/shared/choice-source.ts and review-source.ts',
    open: (tui, theme, keybindings) =>
      showComponentPreview(
        tui,
        theme,
        keybindings,
        (_tui, previewTheme, _kb, done) =>
          new ExchangeDecisionPickerComponent({
            prompt: 'Which direction should we take?',
            choices: [
              {
                id: 'local-workbench',
                label: 'Local workbench',
                description: 'Keeps the evidence close to reusable fixtures.',
              },
              { id: 'agent-relay', label: 'Agent relay' },
              {
                id: 'defer',
                label: 'Defer until capture is settled',
                description: 'Use when the current answer would churn soon.',
              },
            ],
            theme: previewTheme,
            onDone: done,
          }),
      ),
  },
  {
    id: 'exchange-decision-picker-scroll',
    label: 'Exchange decision picker (scroll)',
    presentedLike: 'inline swap — src/.pi/extensions/exchanges/shared/choice-source.ts and review-source.ts',
    open: (tui, theme, keybindings) =>
      showComponentPreview(
        tui,
        theme,
        keybindings,
        (_tui, previewTheme, _kb, done) =>
          new ExchangeDecisionPickerComponent({
            prompt: 'Pick a candidate framing (long list exercises the scroll thumb):',
            choices: Array.from({ length: 20 }, (_, index) => ({
              id: `candidate-${index + 1}`,
              label: `Candidate framing ${index + 1} — option label with realistic width`,
              ...(index % 2 === 0
                ? { description: `Rationale ${index + 1} keeps the two-line scroll window honest.` }
                : {}),
            })),
            theme: previewTheme,
            onDone: done,
          }),
      ),
  },
  {
    id: 'exchange-decision-picker-rich-body',
    label: 'Exchange decision picker (rich body)',
    presentedLike:
      'inline swap — forthcoming ask single-select surface; mirrors shared rounded-box body + choices layout',
    open: (tui, theme, keybindings) =>
      showComponentPreview(
        tui,
        theme,
        keybindings,
        (_tui, previewTheme, _kb, done) =>
          new ExchangeDecisionPickerComponent({
            prompt: 'Which direction should we take?',
            body: RICH_ASK_BODY,
            choices: [
              {
                id: 'local-workbench',
                label: 'Local workbench',
                description: 'Best when a fixture can witness the behavior.',
              },
              { id: 'agent-relay', label: 'Agent relay' },
              {
                id: 'defer',
                label: 'Defer until capture is settled',
                description: 'Avoids locking the wrong contract too early.',
              },
            ],
            topLabel: '[ Ask ]',
            bottomLabel: '"FE-1164"',
            theme: previewTheme,
            borderColor: operationalModeBorderColor(previewTheme, 'specify'),
            onDone: done,
          }),
      ),
  },
  {
    id: 'exchange-decision-picker-rich-body-execute',
    label: 'Exchange decision picker (rich body, Execute mode border)',
    presentedLike:
      'inline swap — ask single-select surface with execute-mode border role; mirrors src/.pi/extensions/exchanges/ask.ts',
    open: (tui, theme, keybindings) =>
      showComponentPreview(
        tui,
        theme,
        keybindings,
        (_tui, previewTheme, _kb, done) =>
          new ExchangeDecisionPickerComponent({
            prompt: 'Which execution path should run?',
            body: RICH_ASK_BODY,
            choices: [
              {
                id: 'run-now',
                label: 'Run now',
                description: 'Proceed with the prepared execution slice.',
              },
              {
                id: 'narrow-first',
                label: 'Narrow first',
                description: 'Pause execution and shrink the card.',
              },
            ],
            topLabel: '[ Ask · Execute ]',
            bottomLabel: '"FE-1169"',
            theme: previewTheme,
            borderColor: operationalModeBorderColor(previewTheme, 'execute'),
            onDone: done,
          }),
      ),
  },
  {
    id: 'exchange-answer-editor',
    label: 'Exchange answer editor',
    presentedLike: 'inline swap — src/.pi/extensions/exchanges/shared/answer-source.ts',
    open: (tui, theme, keybindings) =>
      showComponentPreview(tui, theme, keybindings, (_tui, previewTheme, _kb, done) => {
        const editorTheme = createComponentPreviewEditorTheme(theme);
        return new ExchangeAnswerEditorComponent(_tui, editorTheme, {
          body: RICH_ASK_BODY,
          theme: previewTheme,
          onDone: done,
        });
      }),
  },
  {
    id: 'multi-choice-picker',
    label: 'Multi-choice picker',
    presentedLike: 'inline swap — src/.pi/extensions/exchanges/shared/choices-editor.ts',
    open: (tui, theme, keybindings) =>
      showComponentPreview(
        tui,
        theme,
        keybindings,
        (_tui, previewTheme, _kb, done) =>
          new MultiChoicePickerComponent({
            prompt: 'Which follow-ups matter?',
            choices: [
              {
                id: 'scope',
                label: 'Narrow the scope',
                description: 'Collapse the work to the next buildable slice.',
              },
              { id: 'risk', label: 'Flag the risk' },
              { id: 'defer', label: 'Defer to later', description: 'Name it without pulling it forward.' },
            ],
            theme: previewTheme,
            onDone: done,
          }),
      ),
  },
  {
    id: 'multi-choice-picker-rich-body',
    label: 'Multi-choice picker (rich body)',
    presentedLike:
      'inline swap — forthcoming ask multi-select surface; mirrors shared rounded-box body + checkbox layout',
    open: (tui, theme, keybindings) =>
      showComponentPreview(
        tui,
        theme,
        keybindings,
        (_tui, previewTheme, _kb, done) =>
          new MultiChoicePickerComponent({
            prompt: 'Which follow-ups matter?',
            body: RICH_ASK_BODY,
            choices: [
              {
                id: 'scope',
                label: 'Narrow the scope',
                description: 'Good when the frontier is real but too wide.',
              },
              { id: 'risk', label: 'Flag the risk' },
              { id: 'defer', label: 'Defer to later', description: 'Keep the session moving.' },
            ],
            topLabel: '[ Ask ]',
            bottomLabel: '"FE-1164"',
            theme: previewTheme,
            onDone: done,
          }),
      ),
  },
  {
    id: 'workspace-dialog',
    label: 'Workspace dialog (spec/session picker)',
    presentedLike: 'overlay — src/.pi/extensions/workspace/index.ts (runBrunchWorkspaceAction)',
    open: (tui, theme, keybindings) =>
      showComponentPreview(
        tui,
        theme,
        keybindings,
        (_tui, previewTheme, _kb, done): Component =>
          createWorkspaceDialogComponent({
            inventory: sampleWorkspaceInventory(),
            theme: previewTheme,
            onDecision: done,
            includeContinue: false,
          }),
        {
          overlay: true,
          overlayOptions: { anchor: 'center', width: WORKSPACE_DIALOG_WIDTH, maxHeight: '90%', margin: 1 },
        },
      ),
  },
  {
    id: 'workspace-dialog-scroll',
    label: 'Workspace dialog — long spec list (scroll viewport demo)',
    presentedLike:
      'overlay — src/.pi/extensions/workspace/index.ts (runBrunchWorkspaceAction), with a fixture long ' +
      'enough to exercise projectScrollViewport: press enter, then arrow-down/up to see the option ' +
      'window follow the selection and the ▐ thumb move in the right border',
    open: (tui, theme, keybindings) =>
      showComponentPreview(
        tui,
        theme,
        keybindings,
        (_tui, previewTheme, _kb, done): Component =>
          createWorkspaceDialogComponent({
            inventory: manySpecsWorkspaceInventory(20),
            theme: previewTheme,
            onDecision: done,
          }),
        {
          overlay: true,
          wheelScroll: true,
          overlayOptions: { anchor: 'center', width: WORKSPACE_DIALOG_WIDTH, maxHeight: '90%', margin: 1 },
        },
      ),
  },
  {
    id: 'tui-lab',
    label: 'TUI style lab (palette + segment track demo)',
    presentedLike:
      'overlay — reference component only, no production call site (retired the unwired /brunch:tui-style-lab command; kept here for style/segment-track experimentation)',
    open: (tui, theme, keybindings) =>
      showComponentPreview(
        tui,
        theme,
        keybindings,
        (_tui, previewTheme, _kb, done) => new TuiStyleLabComponent(previewTheme, done),
        { overlay: true },
      ),
  },
  {
    id: 'alternatives',
    label: 'Alternatives card set (transcript message)',
    presentedLike:
      'transcript message renderer — src/.pi/components/alternatives.ts (registerBrunchAlternatives, dispatched via the present_alternatives tool)',
    open: (tui, theme) => {
      const renderer = captureMessageRenderer('alternatives-card-set', (pi) =>
        registerBrunchAlternatives(pi, (schema) => schema),
      );
      const message = sampleCustomMessage('alternatives-card-set', {
        headline: 'Pick a direction',
        alternatives: [
          { title: 'Narrow slice', body: 'Ship the smallest vertical slice that proves the seam.' },
          {
            title: 'Widen scope now',
            body: 'Cover every consumer up front.',
            flavor: 'warning' as const,
          },
        ],
        layout: 'columns' as const,
      });
      const component = renderer(message, { expanded: false }, theme);
      if (!component) throw new Error('alternatives-card-set renderer returned no component');
      return previewStaticComponent(tui, component);
    },
  },
  {
    id: 'ask',
    label: 'ask transcript render',
    presentedLike:
      'tool result renderer — src/.pi/extensions/exchanges/ask.ts (renderResult = Markdown pass-through of content, D104-L)',
    open: (tui, theme) => previewStaticComponent(tui, renderMarkdownResult(askFixture.result, theme)),
  },
  {
    id: 'present-candidates',
    label: 'present_candidates transcript render',
    presentedLike:
      'tool result renderer — src/.pi/extensions/exchanges/present-candidates.ts (validated details-backed renderer with content fallback, D104-L)',
    open: (tui, theme) =>
      previewStaticComponent(
        tui,
        new ExchangeCandidatesResultComponent(presentCandidatesFixture.projection.details, theme),
      ),
  },
  {
    id: 'present-digest',
    label: 'present_digest transcript render',
    presentedLike:
      'tool result renderer — src/.pi/extensions/exchanges/present-digest.ts (renderResult = Markdown pass-through of content, D104-L)',
    open: (tui, theme) =>
      previewStaticComponent(tui, renderMarkdownResult(presentDigestFixture.result, theme)),
  },
  {
    id: 'present-question',
    label: 'legacy transcript compatibility — present_question render',
    presentedLike:
      'legacy transcript compatibility formatter — src/exchanges/projections/present-question.ts (Markdown pass-through of preserved content, D104-L)',
    open: (tui, theme) =>
      previewStaticComponent(tui, renderMarkdownResult(presentQuestionOptionsFixture.result, theme)),
  },
  {
    id: 'present-review-set',
    label: 'present_review_set transcript render',
    presentedLike:
      'tool result renderer — src/.pi/extensions/exchanges/present-review-set.ts (validated details-backed renderer with content fallback, D104-L)',
    open: (tui, theme) =>
      previewStaticComponent(
        tui,
        new ExchangeReviewSetResultComponent(presentReviewSetFixture.projection.details, theme),
      ),
  },
  {
    id: 'structural-illegal',
    label: 'STRUCTURAL_ILLEGAL diagnostic transcript render',
    presentedLike:
      'tool result renderer — structural illegal exchange recovery diagnostic (renderResult = Markdown pass-through of content, D104-L)',
    open: (tui, theme) =>
      previewStaticComponent(tui, renderMarkdownResult(structuralIllegalFixture.result, theme)),
  },
  {
    id: 'request-answer',
    label: 'legacy transcript compatibility — request_response answer render',
    presentedLike:
      'legacy transcript compatibility formatter — preserved request_answer detail markdown (D104-L)',
    open: (tui, theme) =>
      previewStaticComponent(tui, renderMarkdownResult(requestAnswerFixture.result, theme)),
  },
  {
    id: 'request-choice',
    label: 'legacy transcript compatibility — request_response choice render',
    presentedLike:
      'legacy transcript compatibility formatter — preserved request_choice detail markdown (D104-L)',
    open: (tui, theme) =>
      previewStaticComponent(tui, renderMarkdownResult(requestChoiceFixture.result, theme)),
  },
  {
    id: 'request-choices',
    label: 'legacy transcript compatibility — request_response choices render',
    presentedLike:
      'legacy transcript compatibility formatter — preserved request_choices detail markdown (D104-L)',
    open: (tui, theme) =>
      previewStaticComponent(tui, renderMarkdownResult(requestChoicesFixture.result, theme)),
  },
  {
    id: 'request-review',
    label: 'legacy transcript compatibility — request_response review render',
    presentedLike:
      'legacy transcript compatibility formatter — preserved request_review detail markdown (D104-L)',
    open: (tui, theme) =>
      previewStaticComponent(tui, renderMarkdownResult(requestReviewFixture.result, theme)),
  },
  {
    id: 'request-terminal',
    label: 'legacy transcript compatibility — request_response terminal render',
    presentedLike:
      'legacy transcript compatibility formatter — preserved terminal request-detail markdown (D104-L)',
    open: (tui, theme) =>
      previewStaticComponent(tui, renderMarkdownResult(requestTerminalFixture.result, theme)),
  },
  {
    id: 'chrome-header',
    label: 'Startup chrome header (persistent, session-scoped)',
    presentedLike:
      'persistent chrome region — src/.pi/extensions/chrome/index.ts (ui.setHeader via registerBrunchChrome)',
    open: (tui, theme) => {
      const header = new BrunchStartupHeader(
        { project: 'brunch-next-chi', spec: 'component-dx', session: 'preview-session' },
        theme,
      );
      return previewStaticComponent(tui, header);
    },
  },
  {
    id: 'brunch-editor',
    label: 'Brunch editor (runtime chrome border) [experimental]',
    presentedLike:
      'editor slot — ctx.ui.setEditorComponent (design exploration for the component-dx frontier; not yet wired into src/.pi/extensions/chrome/index.ts)',
    open: (tui, theme, keybindings) => {
      const editorTheme = createComponentPreviewEditorTheme(theme);
      const editor = new BrunchEditorComponent(
        tui,
        editorTheme,
        keybindings,
        () => ({
          topRight: '[ Specify ]',
          bottomRight: '"Walking Skeleton SDK to SSE to React"',
          belowLines: [
            { text: 'http://localhost:3141/session', url: 'http://localhost:3141/session' },
            'claude-sonnet-5 | 35.6%',
          ],
        }),
        () => operationalModeBorderColor(theme, 'specify'),
      );
      tui.addChild(editor);
      tui.setFocus(editor);
      editor.focused = true;
      tui.requestRender();
      return new Promise<void>((resolve) => {
        editor.onEscape = () => {
          tui.removeChild(editor);
          tui.requestRender();
          resolve();
        };
      });
    },
  },
  {
    id: 'brunch-editor-execute',
    label: 'Brunch editor (Execute mode border) [experimental]',
    presentedLike:
      'editor slot — ctx.ui.setEditorComponent with execute-mode border role; mirrors src/.pi/extensions/chrome/index.ts',
    open: (tui, theme, keybindings) => {
      const editorTheme = createComponentPreviewEditorTheme(theme);
      const editor = new BrunchEditorComponent(
        tui,
        editorTheme,
        keybindings,
        () => ({
          topRight: '[ Execute ]',
          bottomRight: '"Run Review Harness"',
          belowLines: [
            { text: 'http://localhost:3141/session', url: 'http://localhost:3141/session' },
            'executor | 42.0%',
          ],
        }),
        () => operationalModeBorderColor(theme, 'execute'),
      );
      tui.addChild(editor);
      tui.setFocus(editor);
      editor.focused = true;
      tui.requestRender();
      return new Promise<void>((resolve) => {
        editor.onEscape = () => {
          tui.removeChild(editor);
          tui.requestRender();
          resolve();
        };
      });
    },
  },
];
