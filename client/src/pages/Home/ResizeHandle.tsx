interface ResizeHandleProps {
    side: 'left' | 'right';
    onMouseDown: (e: MouseEvent) => void;
    onDblClick: () => void;
}

export function ResizeHandle({ side, onMouseDown, onDblClick }: ResizeHandleProps) {
    return (
        <div
            class={`resize-handle resize-handle--${side}`}
            onMouseDown={onMouseDown}
            onDblClick={onDblClick}
        >
            <div class="resize-handle-line" />
        </div>
    );
}

interface SidebarExpandBtnProps {
    side: 'left' | 'right';
    onClick: () => void;
}

export function SidebarExpandBtn({ side, onClick }: SidebarExpandBtnProps) {
    return (
        <button
            class={`sidebar-expand-btn sidebar-expand-btn--${side}`}
            onClick={onClick}
            title={side === 'left' ? 'Expand sidebar' : 'Expand panel'}
        >
            {side === 'left' ? '\u00bb' : '\u00ab'}
        </button>
    );
}
