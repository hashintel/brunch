import type { SessionEntry } from '@earendil-works/pi-coding-agent';
import { describe, expect, it } from 'vitest';

import { renderBrunchContinuityBlock, stripBrunchContinuityBlock } from './continuity-block.js';
import type { SelectedCompactionAnchor } from './select-anchors.js';

function selected(entry: SessionEntry, kind: string): SelectedCompactionAnchor {
  return { entry: entry as SelectedCompactionAnchor['entry'], kind, select: 'latest' };
}

describe('Brunch compaction continuity block', () => {
  it('canonicalizes object keys while preserving carrier and array order and exact values', () => {
    const first = selected(
      {
        id: 'a',
        type: 'custom_message',
        customType: 'worldUpdate',
        content: [{ type: 'text', text: 'exact' }],
        display: true,
        details: {
          z: 1,
          nested: { b: 2, a: 1 },
          array: [{ z: 2, a: 1 }],
          '\u{10000}': 'astral',
          '\u{e000}': 'bmp',
        },
      } as SessionEntry,
      'worldUpdate',
    );
    const same = selected(
      {
        id: 'b',
        type: 'custom_message',
        customType: 'worldUpdate',
        content: [{ type: 'text', text: 'exact' }],
        display: true,
        details: {
          array: [{ a: 1, z: 2 }],
          nested: { a: 1, b: 2 },
          z: 1,
          '\u{e000}': 'bmp',
          '\u{10000}': 'astral',
        },
      } as SessionEntry,
      'worldUpdate',
    );
    const second = selected(
      {
        id: 'c',
        type: 'custom_message',
        customType: 'brunch.context_seed',
        content: 'seed',
        display: false,
      } as SessionEntry,
      'brunch.context_seed',
    );
    const ledger = selected(
      { id: 'd', type: 'custom', customType: 'brunch.session_binding', data: { specId: 1 } } as SessionEntry,
      'brunch.session_binding',
    );

    expect(renderBrunchContinuityBlock([first])).toBe(renderBrunchContinuityBlock([same]));
    const rendered = renderBrunchContinuityBlock([first, ledger, second]);
    expect(rendered.indexOf('worldUpdate')).toBeLessThan(rendered.indexOf('brunch.context_seed'));
    expect(rendered).not.toContain('session_binding');
    expect(rendered.indexOf('')).toBeLessThan(rendered.indexOf('𐀀'));
    expect(JSON.parse(rendered.match(/```json\n([\s\S]*?)\n```/)![1]!)).toEqual({
      anchorContractVersion: 1,
      blockSchemaVersion: 1,
      carriers: [
        {
          content: [{ type: 'text', text: 'exact' }],
          details: {
            array: [{ a: 1, z: 2 }],
            nested: { a: 1, b: 2 },
            z: 1,
            '': 'bmp',
            𐀀: 'astral',
          },
          display: true,
          customType: 'worldUpdate',
        },
        { content: 'seed', display: false, customType: 'brunch.context_seed' },
      ],
    });
  });

  it('strips one valid current-version prefix and leaves malformed blocks untouched', () => {
    const block = renderBrunchContinuityBlock([]);
    expect(stripBrunchContinuityBlock(`${block}\nNative narrative`)).toBe('Native narrative');
    expect(stripBrunchContinuityBlock(`${block}\n${block}\nNative narrative`)).toBe(
      `${block}\nNative narrative`,
    );

    const closeInContent = renderBrunchContinuityBlock([
      selected(
        {
          id: 'close',
          type: 'custom_message',
          customType: 'worldUpdate',
          content: `carrier says <!-- /brunch:compaction-continuity --> but continues`,
          display: false,
        } as SessionEntry,
        'worldUpdate',
      ),
    ]);
    expect(stripBrunchContinuityBlock(`${closeInContent}\nNative narrative`)).toBe('Native narrative');

    for (const malformed of [
      block.replace('version=1', 'version=2'),
      block.slice(0, -8),
      `prefix\n${block}`,
      block.replace('"carriers":[]', '"carriers":{}'),
      block.replace('```json\n', '```json\nnot-json'),
      block.replace('\n```\n', '\n``` trailing\n'),
    ]) {
      expect(stripBrunchContinuityBlock(`${malformed}\nNative narrative`)).toBe(
        `${malformed}\nNative narrative`,
      );
    }
  });
});
