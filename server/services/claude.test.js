import { describe, it, expect } from 'vitest';
import { extractUsage, cwdOptions } from './claude.js';

describe('cwdOptions', () => {
    it('returns empty object when cwd is falsy', () => {
        expect(cwdOptions(null)).toEqual({});
        expect(cwdOptions(undefined)).toEqual({});
        expect(cwdOptions('')).toEqual({});
    });

    it('returns cwd, allowedTools and systemPrompt when cwd is provided', () => {
        const result = cwdOptions('/my/project');
        expect(result.cwd).toBe('/my/project');
        expect(result.allowedTools).toEqual(['Read', 'Glob', 'Grep']);
        expect(result.systemPrompt).toContain('project directory');
    });
});

describe('extractUsage', () => {
    it('returns zeros for empty messages', () => {
        expect(extractUsage([])).toEqual({ inputTokens: 0, outputTokens: 0, turns: 0 });
    });

    it('extracts input tokens from message_start events', () => {
        const messages = [
            {
                type: 'stream_event',
                event: {
                    type: 'message_start',
                    message: { usage: { input_tokens: 100 } },
                },
            },
        ];
        const result = extractUsage(messages);
        expect(result.inputTokens).toBe(100);
        expect(result.turns).toBe(1);
    });

    it('extracts output tokens from message_delta events', () => {
        const messages = [
            {
                type: 'stream_event',
                event: {
                    type: 'message_delta',
                    usage: { output_tokens: 50 },
                },
            },
        ];
        const result = extractUsage(messages);
        expect(result.outputTokens).toBe(50);
    });

    it('accumulates across multiple turns', () => {
        const messages = [
            {
                type: 'stream_event',
                event: { type: 'message_start', message: { usage: { input_tokens: 100 } } },
            },
            {
                type: 'stream_event',
                event: { type: 'message_delta', usage: { output_tokens: 30 } },
            },
            {
                type: 'stream_event',
                event: { type: 'message_start', message: { usage: { input_tokens: 200 } } },
            },
            {
                type: 'stream_event',
                event: { type: 'message_delta', usage: { output_tokens: 40 } },
            },
        ];
        const result = extractUsage(messages);
        expect(result.inputTokens).toBe(300);
        expect(result.outputTokens).toBe(70);
        expect(result.turns).toBe(2);
    });

    it('ignores non-stream_event messages', () => {
        const messages = [
            { type: 'result', subtype: 'success' },
            { type: 'other', data: 'something' },
        ];
        const result = extractUsage(messages);
        expect(result).toEqual({ inputTokens: 0, outputTokens: 0, turns: 0 });
    });

    it('handles missing usage fields gracefully', () => {
        const messages = [
            {
                type: 'stream_event',
                event: { type: 'message_delta', usage: {} },
            },
            {
                type: 'stream_event',
                event: { type: 'message_start', message: { usage: {} } },
            },
        ];
        const result = extractUsage(messages);
        expect(result.inputTokens).toBe(0);
        expect(result.outputTokens).toBe(0);
        expect(result.turns).toBe(1);
    });
});
