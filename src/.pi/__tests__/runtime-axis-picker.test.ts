import { describe, expect, it } from 'vitest';

import {
  AGENT_LENS_IDS,
  AGENT_STRATEGY_IDS,
  type AgentLensSelection,
  type AgentStrategySelection,
} from '../../session/runtime-state.js';
import {
  createRuntimeLensPickerComponent,
  createRuntimeModePickerComponent,
  createRuntimeStrategyPickerComponent,
} from '../components/runtime-posture/axis-picker.js';
import { createTestLabTheme } from './support/tui-theme.js';

const theme = createTestLabTheme();

describe('runtime posture picker overlays', () => {
  it('renders auto plus every strategy and highlights the current projection', () => {
    const component = createRuntimeStrategyPickerComponent({
      current: 'propose-graph',
      theme,
      onDone: () => {},
    });

    const text = component.render(120).join('\n');

    expect(text).toContain('Choose Brunch strategy');
    for (const strategy of ['auto', ...AGENT_STRATEGY_IDS]) {
      expect(text).toContain(strategy);
    }
    // Current value renders as a success-colored badge and in the header line.
    expect(text).toContain('\x1b[48;5;34m\x1b[30m propose-graph ');
    expect(text).toContain('\x1b[38;5;34mpropose-graph\x1b[39m');
  });

  it('renders auto plus every lens and highlights the current projection', () => {
    const component = createRuntimeLensPickerComponent({
      current: 'design',
      theme,
      onDone: () => {},
    });

    const text = component.render(120).join('\n');

    expect(text).toContain('Choose Brunch lens');
    for (const lens of ['auto', ...AGENT_LENS_IDS]) {
      expect(text).toContain(lens);
    }
    expect(text).toContain('\x1b[48;5;34m\x1b[30m design ');
  });

  it('cycles and wraps selection with arrow and hj-style keys', () => {
    const component = createRuntimeStrategyPickerComponent({
      current: 'auto',
      theme,
      onDone: () => {},
    });

    component.handleInput?.('\x1b[D');
    expect(component.render(120).join('\n')).toContain(`\x1b[48;5;33m\x1b[30m ${AGENT_STRATEGY_IDS.at(-1)} `);

    // "auto" is the current value here, so its badge uses the success color.
    component.handleInput?.('l');
    expect(component.render(120).join('\n')).toContain('\x1b[48;5;34m\x1b[30m auto ');

    component.handleInput?.('j');
    expect(component.render(120).join('\n')).toContain(`\x1b[48;5;33m\x1b[30m ${AGENT_STRATEGY_IDS[0]} `);

    component.handleInput?.('k');
    expect(component.render(120).join('\n')).toContain('\x1b[48;5;34m\x1b[30m auto ');
  });

  it('grays out disabled choices, notes them, and skips them during cycling', () => {
    const [first, second] = AGENT_STRATEGY_IDS;
    const component = createRuntimeStrategyPickerComponent({
      current: 'auto',
      disabled: [first!],
      theme,
      onDone: () => {},
    });

    const text = component.render(200).join('\n');
    expect(text).toContain(`\x1b[38;5;240m${first}\x1b[39m`);
    expect(text).toContain(`-- NOTE: ${first} is not yet enabled`);

    // Cycling right from auto skips the disabled first strategy.
    component.handleInput?.('\x1b[C');
    expect(component.render(200).join('\n')).toContain(`\x1b[48;5;33m\x1b[30m ${second} `);

    // Cycling back left skips it again and wraps to auto.
    component.handleInput?.('\x1b[D');
    expect(component.render(200).join('\n')).toContain('\x1b[48;5;34m\x1b[30m auto ');
  });

  it.each([
    [2, /-- NOTE: \S+ and \S+ are not yet enabled/u],
    [3, /-- NOTE: \S+, \S+ and \S+ are not yet enabled/u],
  ] as const)('lists %i disabled choices with natural grammar', (count, pattern) => {
    const component = createRuntimeStrategyPickerComponent({
      current: 'auto',
      disabled: AGENT_STRATEGY_IDS.slice(0, count),
      theme,
      onDone: () => {},
    });

    expect(component.render(200).join('\n')).toMatch(pattern);
  });

  it('renders caution choices muted gray while keeping them selectable', () => {
    const selected: unknown[] = [];
    const [first] = AGENT_STRATEGY_IDS;
    const component = createRuntimeStrategyPickerComponent({
      current: 'auto',
      caution: [first!],
      theme,
      onDone: (value) => selected.push(value),
    });

    const text = component.render(200).join('\n');
    expect(text).toContain(`\x1b[38;5;244m${first}\x1b[39m`);
    expect(text).toContain(`-- NOTE: ${first} needs more grounding`);

    // Cycling lands on the caution choice and enter commits it.
    component.handleInput?.('\x1b[C');
    component.handleInput?.('\r');
    expect(selected).toEqual([first]);
  });

  it('shows planned operational modes as disabled in the mode picker', () => {
    const selected: unknown[] = [];
    const component = createRuntimeModePickerComponent({
      current: 'elicit',
      theme,
      onDone: (value) => selected.push(value),
    });

    const text = component.render(200).join('\n');
    expect(text).toContain('Choose Brunch mode');
    // elicit is current (success badge); execute is planned and grayed out.
    expect(text).toContain('\x1b[48;5;34m\x1b[30m elicit ');
    expect(text).toContain('\x1b[38;5;240mexecute\x1b[39m');
    expect(text).toContain('-- NOTE: execute is not yet enabled');

    // Cycling cannot land on the disabled planned mode.
    component.handleInput?.('\x1b[C');
    component.handleInput?.('\r');
    expect(selected).toEqual(['elicit']);
  });

  it('snaps the initial selection to the first enabled choice when current is disabled', () => {
    const selected: unknown[] = [];
    const component = createRuntimeStrategyPickerComponent({
      current: AGENT_STRATEGY_IDS[0]!,
      disabled: [AGENT_STRATEGY_IDS[0]!],
      theme,
      onDone: (value) => selected.push(value),
    });

    expect(component.render(200).join('\n')).toContain('\x1b[48;5;244m\x1b[30m auto ');

    component.handleInput?.('\r');
    expect(selected).toEqual(['auto']);
  });

  it('returns selected strategy value on enter', () => {
    const selected: AgentStrategySelection[] = [];
    const component = createRuntimeStrategyPickerComponent({
      current: 'auto',
      theme,
      onDone: (value) => selected.push(value as AgentStrategySelection),
    });

    component.handleInput?.('\x1b[C');
    component.handleInput?.('\r');

    expect(selected).toEqual([AGENT_STRATEGY_IDS[0]]);
  });

  it('returns selected lens value on enter', () => {
    const selected: AgentLensSelection[] = [];
    const component = createRuntimeLensPickerComponent({
      current: 'auto',
      theme,
      onDone: (value) => selected.push(value as AgentLensSelection),
    });

    component.handleInput?.('\x1b[C');
    component.handleInput?.('\r');

    expect(selected).toEqual([AGENT_LENS_IDS[0]]);
  });

  it.each(['\x1b', 'q'])('cancels on %j without a value', (key) => {
    const selected: unknown[] = [];
    const component = createRuntimeStrategyPickerComponent({
      current: 'auto',
      theme,
      onDone: (value) => selected.push(value),
    });

    component.handleInput?.(key);

    expect(selected).toEqual([undefined]);
  });
});
