import type { KeybindingsManager, Theme } from '@earendil-works/pi-coding-agent';
import type { Component, TUI } from '@earendil-works/pi-tui';

import { registerBrunchAlternatives } from '../../.pi/components/alternatives.js';
import { BrunchEditorComponent } from '../../.pi/components/brunch-editor.js';
import { BrunchStartupHeader } from '../../.pi/components/chrome-header.js';
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
  presentCandidatesFixture,
  presentQuestionOptionsFixture,
  presentReviewSetFixture,
  requestAnswerFixture,
  requestChoiceFixture,
  requestChoicesFixture,
  requestReviewFixture,
  requestTerminalFixture,
  structuralIllegalFixture,
} from './exchange-fixtures.js';
import { captureMessageRenderer, previewStaticComponent, sampleCustomMessage } from './static-preview.js';
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
    currentSpec: { id: 1, title: 'Alpha' },
    currentSessionFile: '/sessions/alpha-current.jsonl',
    needsNewSpec: false,
    specs: [
      {
        spec: { id: 1, title: 'Alpha' },
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
        spec: { id: 2, title: 'Beta' },
        sessions: [
          { id: 'session-beta', file: '/sessions/beta.jsonl', specId: 2, specTitle: 'Beta', available: true },
        ],
      },
    ],
    unavailableSessions: [],
  };
}

/**
 * Long enough to overflow `WORKSPACE_DIALOG_MAX_VISIBLE_OPTIONS`, so the `specList` stage exercises
 * `.pi/components/scroll-viewport.ts`'s windowing + `▐` thumb. No `currentSpec` -> no "continue" home option, so "Continue another existing specification" is
 * index 0 and a single Enter reaches the scrollable list.
 */
function manySpecsWorkspaceInventory(specCount: number): WorkspaceLaunchInventory {
  return {
    cwd: '/project',
    currentSpec: null,
    currentSessionFile: null,
    needsNewSpec: false,
    specs: Array.from({ length: specCount }, (_, index) => ({
      spec: { id: index + 1, title: `Spec ${index}` },
      sessions: [],
    })),
    unavailableSessions: [],
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
    id: 'axis-picker',
    label: 'Runtime mode picker',
    presentedLike: 'inline swap — src/.pi/extensions/commands/index.ts (openModePicker)',
    open: (tui, theme, keybindings) =>
      showComponentPreview(tui, theme, keybindings, (_tui, previewTheme, _kb, done) =>
        createRuntimeModePickerComponent({ current: 'elicit', theme: previewTheme, onDone: done }),
      ),
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
              { id: 'scope', label: 'Narrow the scope' },
              { id: 'risk', label: 'Flag the risk' },
              { id: 'defer', label: 'Defer to later' },
            ],
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
      const renderer = captureMessageRenderer('alternatives-card-set', registerBrunchAlternatives);
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
    id: 'present-candidates',
    label: 'present_candidates transcript render',
    presentedLike:
      'tool result renderer — src/.pi/extensions/exchanges/present-candidates.ts (renderResult = Markdown pass-through of content, D104-L)',
    open: (tui, theme) =>
      previewStaticComponent(tui, renderMarkdownResult(presentCandidatesFixture.result, theme)),
  },
  {
    id: 'present-question',
    label: 'present_question transcript render',
    presentedLike:
      'tool result renderer — src/.pi/extensions/exchanges/present-question.ts (renderResult = Markdown pass-through of content, D104-L)',
    open: (tui, theme) =>
      previewStaticComponent(tui, renderMarkdownResult(presentQuestionOptionsFixture.result, theme)),
  },
  {
    id: 'present-review-set',
    label: 'present_review_set transcript render',
    presentedLike:
      'tool result renderer — src/.pi/extensions/exchanges/present-review-set.ts (renderResult = Markdown pass-through of content, D104-L)',
    open: (tui, theme) =>
      previewStaticComponent(tui, renderMarkdownResult(presentReviewSetFixture.result, theme)),
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
    label: 'request_response answer transcript render',
    presentedLike:
      'tool result renderer — src/.pi/extensions/exchanges/request-response.ts (renderResult = Markdown pass-through of content, D104-L)',
    open: (tui, theme) =>
      previewStaticComponent(tui, renderMarkdownResult(requestAnswerFixture.result, theme)),
  },
  {
    id: 'request-choice',
    label: 'request_response choice transcript render',
    presentedLike:
      'tool result renderer — src/.pi/extensions/exchanges/request-response.ts (renderResult = Markdown pass-through of content, D104-L)',
    open: (tui, theme) =>
      previewStaticComponent(tui, renderMarkdownResult(requestChoiceFixture.result, theme)),
  },
  {
    id: 'request-choices',
    label: 'request_response choices transcript render',
    presentedLike:
      'tool result renderer — src/.pi/extensions/exchanges/request-response.ts (renderResult = Markdown pass-through of content, D104-L)',
    open: (tui, theme) =>
      previewStaticComponent(tui, renderMarkdownResult(requestChoicesFixture.result, theme)),
  },
  {
    id: 'request-review',
    label: 'request_response review transcript render',
    presentedLike:
      'tool result renderer — src/.pi/extensions/exchanges/request-response.ts (renderResult = Markdown pass-through of content, D104-L)',
    open: (tui, theme) =>
      previewStaticComponent(tui, renderMarkdownResult(requestReviewFixture.result, theme)),
  },
  {
    id: 'request-terminal',
    label: 'request_response terminal transcript render',
    presentedLike:
      'tool result renderer — src/.pi/extensions/exchanges/request-response.ts (renderResult = Markdown pass-through of content, D104-L)',
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
      const editor = new BrunchEditorComponent(tui, editorTheme, keybindings, () => ({
        topRight: '[ Specify ]',
        bottomRight: '"Walking Skeleton SDK to SSE to React"',
        belowLines: [
          { text: 'http://localhost:3141/session', url: 'http://localhost:3141/session' },
          'claude-sonnet-5 | 35.6%',
        ],
      }));
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
