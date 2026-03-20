import type { ComponentChildren } from 'preact';
import { useEffect, useRef } from 'preact/hooks';

export function Modal({
    title,
    onClose,
    children,
    footer,
}: {
    title: string;
    onClose: () => void;
    children: ComponentChildren;
    footer?: ComponentChildren;
}) {
    const backdropRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);

    return (
        <div class="modal-backdrop" ref={backdropRef}
            onClick={e => { if (e.target === backdropRef.current) onClose(); }}>
            <div class="modal">
                <div class="modal-header">
                    <strong>{title}</strong>
                    <button class="modal-close" onClick={onClose}>&times;</button>
                </div>
                <div class="modal-body">{children}</div>
                {footer && <div class="modal-footer">{footer}</div>}
            </div>
        </div>
    );
}
