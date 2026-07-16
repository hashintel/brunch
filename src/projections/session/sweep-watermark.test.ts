import { describe, expect, it } from 'vitest';

import { projectAssistantVisibleWatermark } from './assistant-visible-watermark.js';
import type { TranscriptEntryLike } from './continuity-entry-classifier.js';
import {
  CAPTURE_SWEEP_WATERMARK_CUSTOM_TYPE,
  prepareCaptureSweepAdvance,
  projectCaptureSweepWindow,
} from './sweep-watermark.js';

const fixedNow = () => new Date('2026-06-19T12:00:00.000Z');

function message(role: string, content: string): TranscriptEntryLike {
  return { type: 'message', message: { role, content } };
}

function toolResult(toolName: string, details: unknown = { ok: true }): TranscriptEntryLike {
  return { type: 'message', message: { role: 'toolResult', toolName, details } };
}

function custom(customType: string, data: Record<string, unknown> = {}): TranscriptEntryLike {
  return { type: 'custom', customType, data };
}

function marker(): TranscriptEntryLike {
  return {
    type: 'custom',
    customType: CAPTURE_SWEEP_WATERMARK_CUSTOM_TYPE,
    data: { sweptAt: '2026-06-19T11:00:00.000Z' },
  };
}

describe('capture sweep watermark projection', () => {
  it('returns conversational entries appended since the last transcript-backed marker', () => {
    const entries = [
      message('user', 'already swept'),
      marker(),
      custom('worldUpdate', { specId: 7, currentLsn: 3 }),
      toolResult('read_graph'),
      message('assistant', 'What constraint matters?'),
      toolResult('request_answer'),
      custom('brunch.acquisition_digest', { summary: 'Large paste says latency matters.' }),
      toolResult('bash'),
      message('user', 'Keep graph updates under one second.'),
    ];

    expect(projectCaptureSweepWindow(entries).conversationalTail).toEqual([
      entries[4],
      entries[5],
      entries[8],
    ]);
  });

  it('excludes legacy digest custom entries from the sweep tail', () => {
    const entries = [
      marker(),
      custom('brunch.digest', { summary: 'Old digest carrier.' }),
      custom('brunch.acquisition_digest', { summary: 'Old acquisition carrier.' }),
      custom('brunch.capture_digest', { summary: 'Old capture carrier.' }),
      message('assistant', 'Only this conversational message remains.'),
    ];

    expect(projectCaptureSweepWindow(entries).conversationalTail).toEqual([entries[4]]);
  });

  it('excludes structured offers and reserved capture tool results from the sweep tail', () => {
    const entries = [
      marker(),
      toolResult('present_question'),
      toolResult('present_candidates'),
      toolResult('present_review_set'),
      toolResult('present_digest'),
      toolResult('capture_answer'),
      toolResult('capture_review'),
      toolResult('request_answer'),
      toolResult('request_choice'),
      toolResult('request_response'),
    ];

    expect(projectCaptureSweepWindow(entries).conversationalTail).toEqual([
      entries[7],
      entries[8],
      entries[9],
    ]);
  });

  it('includes live ask terminal results in the sweep tail alongside preserved legacy request_* rows (FE-1164 regression)', () => {
    // Post-D116-L every live terminal persists under toolName 'ask': standalone
    // answers, declared offer continuations, and RPC-minted accepted responses.
    // The walkthrough-era 'request_'-prefix classifier silently excluded all of
    // them, so answered material never reached capture.
    const entries = [
      marker(),
      toolResult('present_digest'),
      toolResult('ask'),
      toolResult('request_answer'),
      toolResult('read_graph'),
    ];

    expect(projectCaptureSweepWindow(entries).conversationalTail).toEqual([entries[2], entries[3]]);
  });

  it('keeps digest carrier negative space free of feedback, superseded, cancelled, incomplete, stale, and duplicate payloads', () => {
    const terminal = (exchange_id: string, outcome: Record<string, unknown>) =>
      toolResult('ask', {
        schema: 'brunch.structured_exchange.request',
        v: 1,
        exchange_id,
        tool_meta: { curr: 'ask' },
        question: { body: 'Digest questionnaire' },
        ...outcome,
      });
    const accepted = terminal('questionnaire-final', {
      tool_meta: { curr: 'ask', next: 'capture_answer' },
      accepts_digest: 'digest-final',
      questionnaire: [],
      answered: { submitted: true, accepted_abstract: 'Only this final abstract is capture-authoritative.' },
    });
    const entries = [
      marker(),
      terminal('feedback', { answered: { text: 'Correct the draft.' } }),
      toolResult('present_digest', { exchange_id: 'digest-superseded', digest: { abstract: 'Superseded.' } }),
      terminal('cancelled', { cancelled: {} }),
      terminal('incomplete', { unavailable: { message: 'missing answer' } }),
      terminal('stale', { accepts_digest: 'digest-superseded', cancelled: {} }),
      accepted,
    ];
    const tail = projectCaptureSweepWindow(entries).conversationalTail;
    const payloads = tail.flatMap((entry) => {
      const details = (entry.message as { details?: Record<string, unknown> } | undefined)?.details;
      const answered = details?.answered as { submitted?: unknown; accepted_abstract?: unknown } | undefined;
      return answered?.submitted === true && typeof answered.accepted_abstract === 'string'
        ? [answered.accepted_abstract]
        : [];
    });
    expect(payloads).toEqual(['Only this final abstract is capture-authoritative.']);
  });

  it('advances with a sweep marker so the conversational tail is empty while background may remain behind it', () => {
    const beforeAdvance = [
      marker(),
      custom('worldUpdate', { specId: 7, currentLsn: 3 }),
      toolResult('bash'),
      message('user', 'The browser view must be read-only.'),
      custom('brunch.capture_digest', { summary: 'A document says observers do not write.' }),
    ];

    const advance = prepareCaptureSweepAdvance(beforeAdvance, { now: fixedNow });

    expect(advance.conversationalTail).toEqual([beforeAdvance[3]]);
    expect(advance.marker).toEqual({
      customType: CAPTURE_SWEEP_WATERMARK_CUSTOM_TYPE,
      sweptAt: '2026-06-19T12:00:00.000Z',
    });
    const afterAdvance = [...beforeAdvance, custom(advance.marker!.customType, { ...advance.marker! })];
    expect(projectCaptureSweepWindow(afterAdvance).conversationalTail).toEqual([]);
  });

  it('is monotonic and idempotent: an existing marker does not resurface consumed content or move the graph-LSN watermark', () => {
    const entries = [
      custom('brunch.context_seed', { specId: 7, snapshotLsn: 5 }),
      message('user', 'Capture this once.'),
    ];
    const first = prepareCaptureSweepAdvance(entries, { now: fixedNow });
    const advanced = [...entries, custom(first.marker!.customType, { ...first.marker! })];

    expect(projectCaptureSweepWindow(advanced).watermarkEntryIndex).toBe(2);
    expect(prepareCaptureSweepAdvance(advanced, { now: fixedNow }).marker).toBeNull();
    expect(projectAssistantVisibleWatermark(advanced, { specId: 7 })).toEqual({ specId: 7, lsn: 5 });
  });

  it('excludes brunch.session_orientation from the sweep tail (session-entry-orientation C1 probe)', () => {
    const entries = [
      message('user', 'Ask something worth capturing.'),
      custom('brunch.session_orientation', { schemaVersion: 1, choice: 'ingest', trigger: 'entry' }),
      message('assistant', 'Understood.'),
    ];

    expect(projectCaptureSweepWindow(entries).conversationalTail).toEqual([entries[0], entries[2]]);
  });
});
