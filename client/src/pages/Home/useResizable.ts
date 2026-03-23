import { useState, useEffect, useCallback, useRef } from 'preact/hooks';

interface UseResizableOptions {
    key: string;
    defaultWidth: number;
    minWidth: number;
    maxWidth: number;
    /** 'left' means handle is on the right edge; 'right' means handle is on the left edge */
    side?: 'left' | 'right';
}

interface UseResizableReturn {
    width: number;
    collapsed: boolean;
    toggle: () => void;
    handleProps: {
        onMouseDown: (e: MouseEvent) => void;
        onDblClick: () => void;
    };
}

function loadPersisted<T>(key: string, fallback: T): T {
    try {
        const raw = localStorage.getItem(key);
        return raw != null ? JSON.parse(raw) : fallback;
    } catch {
        return fallback;
    }
}

export function useResizable({
    key,
    defaultWidth,
    minWidth,
    maxWidth,
    side = 'left',
}: UseResizableOptions): UseResizableReturn {
    const [width, setWidth] = useState(() => loadPersisted(`resize-${key}-width`, defaultWidth));
    const [collapsed, setCollapsed] = useState(() => loadPersisted(`resize-${key}-collapsed`, false));
    const dragging = useRef(false);
    const startX = useRef(0);
    const startWidth = useRef(0);

    // Persist width
    useEffect(() => {
        localStorage.setItem(`resize-${key}-width`, JSON.stringify(width));
    }, [key, width]);

    // Persist collapsed
    useEffect(() => {
        localStorage.setItem(`resize-${key}-collapsed`, JSON.stringify(collapsed));
    }, [key, collapsed]);

    const onMouseDown = useCallback((e: MouseEvent) => {
        e.preventDefault();
        dragging.current = true;
        startX.current = e.clientX;
        startWidth.current = width;
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';

        const onMouseMove = (ev: MouseEvent) => {
            if (!dragging.current) return;
            const dx = ev.clientX - startX.current;
            const delta = side === 'left' ? dx : -dx;
            const newWidth = Math.min(maxWidth, Math.max(minWidth, startWidth.current + delta));
            setWidth(newWidth);
        };

        const onMouseUp = () => {
            dragging.current = false;
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        };

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    }, [width, minWidth, maxWidth, side]);

    const toggle = useCallback(() => {
        setCollapsed(c => !c);
    }, []);

    const onDblClick = useCallback(() => {
        toggle();
    }, [toggle]);

    return {
        width,
        collapsed,
        toggle,
        handleProps: { onMouseDown, onDblClick },
    };
}
