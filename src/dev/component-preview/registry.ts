import type { KeybindingsManager, Theme } from '@earendil-works/pi-coding-agent';
import type { Component, TUI } from '@earendil-works/pi-tui';

import { MultiChoicePickerComponent } from '../../.pi/components/multi-choice-picker.js';
import { createRuntimeModePickerComponent } from '../../.pi/components/runtime-posture/axis-picker.js';
import { TuiStyleLabComponent } from '../../.pi/components/tui-lab/index.js';
import {
  createWorkspaceDialogComponent,
  WORKSPACE_DIALOG_WIDTH,
} from '../../.pi/components/workspace-dialog/index.js';
import type { WorkspaceLaunchInventory } from '../../session/workspace-session-coordinator.js';
import { showComponentPreview } from './custom-ui.js';

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
 * Each entry's `open` mirrors the real `ctx.ui.custom(factory, options)` call
 * at its production call site — same `options` shape, same `overlay` on/off —
 * not a uniform "always overlay" assumption. See `custom-ui.ts` and
 * `memory/cards/tooling--component-preview-harness.md` for why that matters.
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
];
