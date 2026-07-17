import { type Terminal } from '@earendil-works/pi-tui';
import { describe, expect, it } from 'vitest';

import type { WorkspaceLaunchInventory } from '../../../session/workspace-session-coordinator.js';
import { formatBrunchProductIdentity, readBrunchAnsiLogo } from '../brunch-identity.js';
import {
  buildWorkspaceSelectionView,
  createWorkspaceDialogComponent,
  selectWorkspaceSelectionOption,
  runWorkspaceDialogPreflight,
  WORKSPACE_DIALOG_MAX_VISIBLE_OPTIONS,
} from '../workspace-dialog/index.js';

describe('spec/session picker', () => {
  it('builds a hierarchical spec/session selection home without per-spec top-level actions', () => {
    const view = buildWorkspaceSelectionView(inventory());

    expect(view.stage).toBe('home');
    expect(view.options.map((option) => option.kind)).toEqual([
      'continue',
      'resumeSpec',
      'newSpec',
      'cancel',
    ]);
    expect(view.options.map((option) => option.label)).toEqual([
      'Continue your latest spec and session',
      'Continue another existing specification',
      'Start a new specification',
      'Cancel',
    ]);
    expect(view.options.map((option) => option.label).join('\n')).not.toMatch(
      /Resume Alpha|Open Alpha|Start new session in Alpha/,
    );
    expect(selectWorkspaceSelectionOption(view, 0)).toEqual({
      decision: {
        action: 'continue',
        specId: 1,
        sessionFile: '/sessions/alpha-current.jsonl',
      },
    });
  });

  it('navigates resume-existing-spec to spec actions without emitting activation early', () => {
    const currentInventory = inventory();
    const home = buildWorkspaceSelectionView(currentInventory);
    const specList = selectWorkspaceSelectionOption(home, 1, currentInventory);

    expect(specList).toMatchObject({ view: { stage: 'specList' } });
    if (!('view' in specList)) throw new Error('expected spec list');
    expect(specList.view.options.map((option) => option.label)).toEqual(['Alpha', 'Beta']);

    const specAction = selectWorkspaceSelectionOption(specList.view, 0, currentInventory);

    expect(specAction).toMatchObject({ view: { stage: 'specAction' } });
    if (!('view' in specAction)) throw new Error('expected spec action');
    expect(specAction.view.options.map((option) => option.label)).toEqual([
      'Create new session',
      'Resume existing session',
    ]);
    expect(selectWorkspaceSelectionOption(specAction.view, 0)).toEqual({
      decision: { action: 'newSession', specId: 1 },
    });
  });

  it('emits open-session only after a session is selected', () => {
    const sessionList = buildWorkspaceSelectionView(inventory(), {
      stage: 'sessionList',
      specId: 1,
    });

    expect(sessionList.options.map((option) => option.label)).toEqual([
      'session-alpha-current',
      'session-alpha-older',
    ]);
    expect(selectWorkspaceSelectionOption(sessionList, 1)).toEqual({
      decision: {
        action: 'openSession',
        specId: 1,
        sessionFile: '/sessions/alpha-older.jsonl',
      },
    });
  });

  it('enters new-spec title state before emitting a new-spec decision', () => {
    const home = buildWorkspaceSelectionView(inventory());

    expect(selectWorkspaceSelectionOption(home, 2)).toMatchObject({
      view: { stage: 'newSpecTitle', title: '', options: [] },
    });
  });

  it('only shows logical home options in an empty workspace', () => {
    const view = buildWorkspaceSelectionView(emptyInventory());

    expect(view.options.map((option) => option.label)).toEqual(['Start a new specification', 'Cancel']);
  });

  it('only shows resume-existing-session when the chosen spec has sessions', () => {
    const view = buildWorkspaceSelectionView(emptySessionInventory(), {
      stage: 'specAction',
      specId: 3,
    });

    expect(view.options.map((option) => option.label)).toEqual(['Create new session']);
  });

  it('renders specification copy without user-created workspace wording', () => {
    const component = createWorkspaceDialogComponent({
      inventory: inventory(),
      onDecision: () => {},
    });

    const text = component.render(80).join('\n');

    expect(text).toContain('Choose a specification');
    expect(text).toContain('Start a new specification');
    expect(text).toContain('Continue another existing specification');
    expect(text).not.toContain('Brunch workspace');
    expect(text).not.toContain('Create workspace');
    expect(text).not.toContain('Open workspace');
  });

  it('renders each option on a single line, with detail inline only when informative', () => {
    const component = createWorkspaceDialogComponent({
      inventory: inventory(),
      onDecision: () => {},
    });

    const lines = component.render(100);

    // Boilerplate help lines are gone.
    expect(lines.join('\n')).not.toContain('Choose a spec, then create or resume a session');
    expect(lines.join('\n')).not.toContain('Name a new spec and create its first session');
    expect(lines.join('\n')).not.toContain('Exit without activating a spec/session');
    // The continue option keeps its spec · session detail on the same line.
    const continueLine = lines.find((line) => line.includes('Continue your latest spec and session'));
    expect(continueLine).toContain('Alpha · session-alpha-current');
  });

  it('omits continue-latest from in-session picker contexts', () => {
    const component = createWorkspaceDialogComponent({
      inventory: inventory(),
      includeContinue: false,
      onDecision: () => {},
    });

    const text = component.render(80).join('\n');

    expect(text).not.toContain('Continue your latest spec and session');
    expect(text).toContain('Switch to another specification');
    expect(text).toContain('Start a new specification');
    expect(text.indexOf('Switch to another specification')).toBeLessThan(
      text.indexOf('Start a new specification'),
    );
  });

  it('selects current continue as a typed decision', () => {
    const decisions: unknown[] = [];
    const component = createWorkspaceDialogComponent({
      inventory: inventory(),
      onDecision: (decision) => decisions.push(decision),
    });

    component.handleInput!('\r');

    expect(decisions).toEqual([
      {
        action: 'continue',
        specId: 1,
        sessionFile: '/sessions/alpha-current.jsonl',
      },
    ]);
  });

  it('returns new-session through the hierarchical keyboard path', () => {
    const decisions: unknown[] = [];
    const component = createWorkspaceDialogComponent({
      inventory: inventory(),
      onDecision: (decision) => decisions.push(decision),
    });

    component.handleInput!('\x1B[B');
    component.handleInput!('\r');
    component.handleInput!('\r');
    component.handleInput!('\r');

    expect(decisions).toEqual([{ action: 'newSession', specId: 1 }]);
  });

  it('returns open-session through the hierarchical keyboard path', () => {
    const decisions: unknown[] = [];
    const component = createWorkspaceDialogComponent({
      inventory: inventory(),
      onDecision: (decision) => decisions.push(decision),
    });

    component.handleInput!('\x1B[B');
    component.handleInput!('\r');
    component.handleInput!('\r');
    component.handleInput!('\x1B[B');
    component.handleInput!('\r');
    component.handleInput!('\x1B[B');
    component.handleInput!('\r');

    expect(decisions).toEqual([
      {
        action: 'openSession',
        specId: 1,
        sessionFile: '/sessions/alpha-older.jsonl',
      },
    ]);
  });

  it('routes an unestablished spec resume through establishment before emitting (D118-L resume half)', () => {
    const decisions: unknown[] = [];
    const unestablished = inventory();
    unestablished.workspacePopulated = true;
    unestablished.specs[0]!.spec = {
      id: 1,
      title: 'Alpha',
      kind: 'product',
      origin: null,
      relatesToSpecId: null,
    };
    const component = createWorkspaceDialogComponent({
      inventory: unestablished,
      onDecision: (decision) => decisions.push(decision),
    });

    component.handleInput!('\r'); // continue latest → establishment interposes
    expect(decisions).toEqual([]);
    component.handleInput!('\x1B[B'); // kind: feature
    component.handleInput!('\r');
    component.handleInput!('\r'); // origin: yes — brownfield (populated cwd inference)

    expect(decisions).toEqual([
      {
        action: 'continue',
        specId: 1,
        sessionFile: '/sessions/alpha-current.jsonl',
        establish: { kind: 'feature', origin: 'brownfield' },
      },
    ]);
  });

  it('bare-cwd resume establishment asks only the greenfield confirm (D118-L narrowing)', () => {
    const decisions: unknown[] = [];
    const unestablished = inventory();
    unestablished.specs[0]!.spec = {
      id: 1,
      title: 'Alpha',
      kind: 'product',
      origin: null,
      relatesToSpecId: null,
    };
    const component = createWorkspaceDialogComponent({
      inventory: unestablished,
      onDecision: (decision) => decisions.push(decision),
    });

    component.handleInput!('\x1B[B'); // continue another existing spec
    component.handleInput!('\r');
    component.handleInput!('\r'); // Alpha → specAction
    component.handleInput!('\r'); // create new session → establishment interposes
    expect(decisions).toEqual([]);
    component.handleInput!('\r'); // yes — greenfield

    expect(decisions).toEqual([{ action: 'newSession', specId: 1, establish: { origin: 'greenfield' } }]);
  });

  it('returns new-spec decisions (with establishment-confirmed origin) from title entry, and cancel on escape', () => {
    const decisions: unknown[] = [];
    const component = createWorkspaceDialogComponent({
      inventory: inventory(),
      onDecision: (decision) => decisions.push(decision),
    });

    component.handleInput!('\x1B[B');
    component.handleInput!('\x1B[B');
    component.handleInput!('\r');
    for (const char of 'Gamma') {
      component.handleInput!(char);
    }
    component.handleInput!('\r');
    // Bare cwd (D118-L): title entry routes straight to the origin confirm —
    // enter accepts the inferred greenfield default.
    component.handleInput!('\r');
    const cancelComponent = createWorkspaceDialogComponent({
      inventory: inventory(),
      onDecision: (decision) => decisions.push(decision),
    });
    cancelComponent.handleInput!('\x1B');

    expect(decisions).toEqual([
      { action: 'newSpec', title: 'Gamma', origin: 'greenfield' },
      { action: 'cancel' },
    ]);
  });

  it('accepts chunked title input from terminal automation', () => {
    const decisions: unknown[] = [];
    const component = createWorkspaceDialogComponent({
      inventory: inventory(),
      onDecision: (decision) => decisions.push(decision),
    });

    component.handleInput!('\x1B[B');
    component.handleInput!('\x1B[B');
    component.handleInput!('\r');
    component.handleInput!('Gamma');
    component.handleInput!('\r');
    component.handleInput!('\r');

    expect(decisions).toEqual([{ action: 'newSpec', title: 'Gamma', origin: 'greenfield' }]);
  });

  it('populated cwd: title entry asks kind before confirming brownfield origin (D118-L)', () => {
    const decisions: unknown[] = [];
    const component = createWorkspaceDialogComponent({
      inventory: populatedInventory(),
      onDecision: (decision) => decisions.push(decision),
    });

    component.handleInput!('\x1B[B');
    component.handleInput!('\x1B[B');
    component.handleInput!('\r');
    for (const char of 'Gamma') {
      component.handleInput!(char);
    }
    component.handleInput!('\r');
    expect(component.render(80).join('\n')).toContain('What does this specification own?');
    component.handleInput!('\r'); // pick the first kind option (product)
    expect(component.render(80).join('\n')).toContain('Does this build on the existing code here?');
    component.handleInput!('\r'); // confirm the inferred brownfield default

    expect(decisions).toEqual([{ action: 'newSpec', title: 'Gamma', kind: 'product', origin: 'brownfield' }]);
  });

  it('backs out of an establishment stage to a preserved title (D118-L)', () => {
    const component = createWorkspaceDialogComponent({
      inventory: populatedInventory(),
      onDecision: () => {},
    });

    component.handleInput!('\x1B[B');
    component.handleInput!('\x1B[B');
    component.handleInput!('\r');
    for (const char of 'Gamma') {
      component.handleInput!(char);
    }
    component.handleInput!('\r');
    expect(component.render(80).join('\n')).toContain('What does this specification own?');
    component.handleInput!('\x1B');
    expect(component.render(80).join('\n')).toContain('› Gamma');
  });

  it('backs out one picker stage on escape and cancels from the home stage', () => {
    const decisions: unknown[] = [];
    const component = createWorkspaceDialogComponent({
      inventory: inventory(),
      onDecision: (decision) => decisions.push(decision),
    });

    component.handleInput!('\x1B[B');
    component.handleInput!('\r');
    expect(component.render(80).join('\n')).toContain('Choose a specification');
    component.handleInput!('\x1B');
    expect(component.render(80).join('\n')).toContain('Continue your latest spec and session');
    component.handleInput!('\x1B');

    expect(decisions).toEqual([{ action: 'cancel' }]);
  });

  it('cancels from startup preflight on ctrl-c', async () => {
    const terminal = new FakeTerminal();
    const decision = runWorkspaceDialogPreflight(inventory(), { terminal });

    terminal.emit('\x03');

    await expect(decision).resolves.toEqual({ action: 'cancel' });
    expect(terminal.events.at(-2)).toBe('stop');
    expect(terminal.events.at(-1)).toBe('clearScreen');
  });

  it('renders a branded centered-dialog frame with separately styled version metadata', () => {
    const component = createWorkspaceDialogComponent({
      inventory: inventory(),
      onDecision: () => {},
      theme: {
        fg: (color, text) => `[${color}]${text}[/${color}]`,
      },
    });

    const lines = component.render(80);

    expect(lines[0]).toContain('╭');
    expect(lines[1]).toMatch(/^\[borderAccent\]│\[\/borderAccent\]\s+\[borderAccent\]│\[\/borderAccent\]$/);
    expect(lines.some((line) => line.includes('Choose a specification'))).toBe(true);
    expect(lines.some((line) => /brunch v1\.0\.0-alpha\.\d+/.test(line))).toBe(true);
    expect(lines.some((line) => line.includes('brunch v0.0.0'))).toBe(false);
    expect(lines.some((line) => line.includes('[success](dev'))).toBe(true);
    expect(lines.some((line) => line.includes('built on Pi v'))).toBe(true);
  });

  it('provides deterministic shared Brunch identity primitives', async () => {
    const assetUrl = new URL('../workspace-dialog/assets/', import.meta.url);

    expect(readBrunchAnsiLogo({ assetUrl, truecolor: false }).join('\n')).toContain('\x1B[');
    expect(
      formatBrunchProductIdentity({
        logoLines: [],
        colorMode: 'plain',
        version: { version: 'v-test', dev: null },
        piVersion: 'test-pi',
      }),
    ).toEqual([
      '█▄▄ █▀█ █ █ █▄ █ █▀▀ █ █',
      '█▄█ █▀▄ █▄█ █ ▀█ █▄▄ █▀█',
      '',
      'brunch v-test',
      'built on Pi vtest-pi',
    ]);
    expect(
      formatBrunchProductIdentity({
        logoLines: ['logo'],
        colorMode: 'dark',
        version: { version: 'v-test', dev: '(dev abc)' },
        theme: { fg: (color, text) => `[${color}]${text}[/${color}]` },
        piVersion: 'test-pi',
      }),
    ).toEqual([
      'logo',
      '',
      '[text]█▄▄ █▀█ █ █ █▄ █ █▀▀ █ █[/text]',
      '[text]█▄█ █▀▄ █▄█ █ ▀█ █▄▄ █▀█[/text]',
      '',
      '[accent]brunch v-test[/accent]',
      '[success](dev abc)[/success]',
      '[dim]built on Pi vtest-pi[/dim]',
    ]);
  });

  it('clears the startup preflight frame after a spec/session decision', async () => {
    const terminal = new FakeTerminal();
    const decision = runWorkspaceDialogPreflight(inventory(), { terminal });

    terminal.emit('\r');

    await expect(decision).resolves.toMatchObject({ action: 'continue' });
    expect(terminal.events.at(-2)).toBe('stop');
    expect(terminal.events.at(-1)).toBe('clearScreen');
  });

  describe('long option lists (scroll viewport)', () => {
    it('windows the spec list to the fixed viewport size instead of rendering every spec', () => {
      const specCount = WORKSPACE_DIALOG_MAX_VISIBLE_OPTIONS + 12;
      const component = createWorkspaceDialogComponent({
        inventory: manySpecsInventory(specCount),
        onDecision: () => {},
      });

      component.handleInput!('\r'); // resume-spec is index 0 (no currentSpec -> no continue option) -> specList
      const text = component.render(80).join('\n');

      const visibleSpecs = Array.from({ length: specCount }, (_, i) => `Spec ${i}`).filter((label) =>
        text.includes(label),
      );
      expect(visibleSpecs).toHaveLength(WORKSPACE_DIALOG_MAX_VISIBLE_OPTIONS);
      // The window starts at the top with the selection on the first spec.
      expect(text).toContain('Spec 0');
      expect(text).not.toContain(`Spec ${specCount - 1}`);
    });

    it('keeps the selected spec visible as arrow-down moves past the initial window', () => {
      const specCount = WORKSPACE_DIALOG_MAX_VISIBLE_OPTIONS + 12;
      const component = createWorkspaceDialogComponent({
        inventory: manySpecsInventory(specCount),
        onDecision: () => {},
      });

      component.handleInput!('\r');
      for (let i = 0; i < specCount - 1; i++) {
        component.handleInput!('\x1B[B');
      }
      const text = component.render(80).join('\n');

      expect(text).toContain(`Spec ${specCount - 1}`);
      expect(text).not.toContain('Spec 0');
    });

    it('folds a scroll thumb into the right border only for windowed rows, only when the list overflows', () => {
      const specCount = WORKSPACE_DIALOG_MAX_VISIBLE_OPTIONS + 12;
      const longList = createWorkspaceDialogComponent({
        inventory: manySpecsInventory(specCount),
        onDecision: () => {},
      });
      longList.handleInput!('\r');
      // Scope the thumb-character check to option rows: the brand logo above them is real
      // truecolor ANSI block art and can incidentally contain the same glyph.
      const longOptionLines = longList.render(80).filter((line) => /Spec \d+/.test(line));

      expect(longOptionLines.some((line) => line.includes('\u2590'))).toBe(true);

      const shortList = createWorkspaceDialogComponent({ inventory: inventory(), onDecision: () => {} });
      shortList.handleInput!('\x1B[B');
      shortList.handleInput!('\r');
      const shortOptionLines = shortList
        .render(80)
        .filter((line) => line.includes('Alpha') || line.includes('Beta'));

      expect(shortOptionLines.some((line) => line.includes('\u2590'))).toBe(false);
    });
  });
});

function manySpecsInventory(specCount: number): WorkspaceLaunchInventory {
  return {
    cwd: '/project',
    currentSpec: null,
    currentSessionFile: null,
    needsNewSpec: false,
    specs: Array.from({ length: specCount }, (_, i) => ({
      spec: { id: i + 1, title: `Spec ${i}`, kind: 'product', origin: 'greenfield', relatesToSpecId: null },
      sessions: [],
    })),
    unavailableSessions: [],
    workspacePopulated: false,
  };
}

class FakeTerminal implements Terminal {
  events: string[] = [];
  #onInput: ((data: string) => void) | undefined;

  get columns(): number {
    return 100;
  }

  get rows(): number {
    return 32;
  }

  get kittyProtocolActive(): boolean {
    return false;
  }

  start(onInput: (data: string) => void): void {
    this.events.push('start');
    this.#onInput = onInput;
  }

  stop(): void {
    this.events.push('stop');
  }

  async drainInput(): Promise<void> {}

  write(_data: string): void {}

  moveBy(_lines: number): void {}

  hideCursor(): void {}

  showCursor(): void {}

  clearLine(): void {}

  clearFromCursor(): void {}

  clearScreen(): void {
    this.events.push('clearScreen');
  }

  setTitle(_title: string): void {}

  setProgress(_active: boolean): void {}

  emit(data: string): void {
    this.#onInput?.(data);
  }
}

function populatedInventory(): WorkspaceLaunchInventory {
  return { ...inventory(), workspacePopulated: true };
}

function emptyInventory(): WorkspaceLaunchInventory {
  return {
    cwd: '/project',
    currentSpec: null,
    currentSessionFile: null,
    needsNewSpec: true,
    specs: [],
    unavailableSessions: [],
    workspacePopulated: false,
  };
}

function emptySessionInventory(): WorkspaceLaunchInventory {
  return {
    cwd: '/project',
    currentSpec: { id: 3, title: 'Empty', kind: 'product', origin: 'greenfield', relatesToSpecId: null },
    currentSessionFile: null,
    needsNewSpec: false,
    specs: [
      {
        spec: { id: 3, title: 'Empty', kind: 'product', origin: 'greenfield', relatesToSpecId: null },
        sessions: [],
      },
    ],
    unavailableSessions: [],
    workspacePopulated: false,
  };
}

// Fixture specs are posture-established (origin set): the navigation tests
// exercise the picker, not the D118-L establishment interposition. The
// resume-establishment tests build their own unestablished variant.
function inventory(): WorkspaceLaunchInventory {
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
          {
            id: 'session-alpha-older',
            file: '/sessions/alpha-older.jsonl',
            specId: 1,
            specTitle: 'Alpha',
            available: true,
          },
        ],
      },
      {
        spec: { id: 2, title: 'Beta', kind: 'product', origin: 'greenfield', relatesToSpecId: null },
        sessions: [
          {
            id: 'session-beta',
            file: '/sessions/beta.jsonl',
            specId: 2,
            specTitle: 'Beta',
            available: true,
          },
        ],
      },
    ],
    unavailableSessions: [],
    workspacePopulated: false,
  };
}
