import { useState, useRef } from 'preact/hooks';
import type { FocusedItem } from './types';

export function useFocusedItem() {
    const [focusedItem, setFocusedItem] = useState<FocusedItem | null>(null);
    const ref = useRef<FocusedItem | null>(null);
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

    return { focusedItem, focus, clear, getFocused };
}
