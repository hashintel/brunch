import { useState, useRef, useCallback, type MutableRef } from 'preact/hooks';
import type { Assumption, Requirement, ClarifyingQuestion, FocusedItem } from './types';

function chatMessage(item: FocusedItem): string {
    switch (item.type) {
        case 'assumption': {
            const a = item.item;
            return `Let's discuss this assumption:\n\n**"${a.editedText || a.text}"**\n\nConfidence: ${a.confidence} | Impact: ${a.impact} | Status: ${a.status}\n\nRationale: ${a.rationale}\n\nWhat would you like to know or change about this assumption?`;
        }
        case 'requirement': {
            const r = item.item;
            return `Let's discuss this requirement:\n\n**"${r.title}"**\n\n${r.definition}\n\nConfidence: ${Math.round(r.confidence * 100)}% | Stage: ${r.stage}${r.tests.length > 0 ? `\n\nTests: ${r.tests.map(t => `${t.type}: ${t.description}`).join('; ')}` : ''}\n\nWhat would you like to know or change about this requirement?`;
        }
        case 'clarifying_question': {
            const q = item.item;
            return `Let's discuss this clarifying question:\n\n**"${q.question}"**\n\n${q.why}\n\n${q.options.length > 0 ? `Options: ${q.options.map(o => o.label).join(', ')}\n\n` : ''}What are your thoughts on this? I can help you think through the options.`;
        }
    }
}

export function useFocusedItem() {
    const [focusedItem, setFocusedItem] = useState<FocusedItem | null>(null);
    const ref = useRef<FocusedItem | null>(null);
    const openWithMessageRef = useRef<((msg: string) => void) | null>(null);
    ref.current = focusedItem;

    function focus(item: FocusedItem) {
        setFocusedItem(item);
    }

    function clear() {
        setFocusedItem(null);
    }

    function getFocused() {
        return ref.current;
    }

    /** Call after useAssistant to wire up the openWithMessage callback */
    function bindOpenWithMessage(fn: (msg: string) => void) {
        openWithMessageRef.current = fn;
    }

    const chatAssumption = useCallback((a: Assumption) => {
        const item: FocusedItem = { type: 'assumption', item: a };
        setFocusedItem(item);
        openWithMessageRef.current?.(chatMessage(item));
    }, []);

    const chatRequirement = useCallback((r: Requirement) => {
        const item: FocusedItem = { type: 'requirement', item: r };
        setFocusedItem(item);
        openWithMessageRef.current?.(chatMessage(item));
    }, []);

    const chatQuestion = useCallback((q: ClarifyingQuestion) => {
        const item: FocusedItem = { type: 'clarifying_question', item: q };
        setFocusedItem(item);
        openWithMessageRef.current?.(chatMessage(item));
    }, []);

    return { focusedItem, focus, clear, getFocused, bindOpenWithMessage, chatAssumption, chatRequirement, chatQuestion };
}
