import { useMemo, useState } from 'preact/hooks';
import { marked } from 'marked';
import { LoadingIndicator } from '../../components/LoadingIndicator';

interface SpecPaneProps {
    loading: boolean;
    progress: number;
    spec: string;
    editable: boolean;
    onSpecChange: (spec: string) => void;
}

export function SpecPane({ loading, progress, spec, editable, onSpecChange }: SpecPaneProps) {
    const [editing, setEditing] = useState(false);
    const [editText, setEditText] = useState('');

    const html = useMemo(() => {
        if (!spec) return '';
        return marked.parse(spec, { async: false }) as string;
    }, [spec]);

    if (!spec && !loading) {
        return (
            <div class="spec-pane-empty">
                Spec will be generated as you progress through the workflow.
            </div>
        );
    }

    return (
        <div class="spec-pane">
            {editable && !editing && (
                <div class="spec-pane-toolbar">
                    <button class="button button-small" onClick={() => { setEditText(spec); setEditing(true); }}>
                        Edit Spec
                    </button>
                </div>
            )}

            {loading && <LoadingIndicator message="Generating spec" />}

            {editing ? (
                <div class="spec-pane-editor">
                    <textarea
                        class="spec-pane-textarea"
                        value={editText}
                        onInput={e => setEditText(e.currentTarget.value)}
                        rows={30}
                    />
                    <div class="spec-pane-editor-actions">
                        <button class="button button-small" onClick={() => { onSpecChange(editText); setEditing(false); }}>Save</button>
                        <button class="button button-small button-secondary" onClick={() => setEditing(false)}>Cancel</button>
                    </div>
                </div>
            ) : (
                spec && (
                    <div
                        class="spec-prose"
                        dangerouslySetInnerHTML={{ __html: html }}
                    />
                )
            )}
        </div>
    );
}
