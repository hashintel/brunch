import { useState } from 'preact/hooks';
import { LoadingIndicator } from '../../components/LoadingIndicator';

interface SpecPaneProps {
    spec: string;
    progress: number;
    loading: boolean;
    editable: boolean;
    onSpecChange: (spec: string) => void;
}

function renderMarkdown(md: string): string {
    let html = md
        // Headers
        .replace(/^### (.+)$/gm, '<h3>$1</h3>')
        .replace(/^## (.+)$/gm, '<h2>$1</h2>')
        .replace(/^# (.+)$/gm, '<h1>$1</h1>')
        // Bold & italic
        .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        // Code blocks
        .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>')
        // Inline code
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        // Unordered lists
        .replace(/^[*-] (.+)$/gm, '<li>$1</li>')
        // Ordered lists
        .replace(/^\d+\. (.+)$/gm, '<li>$1</li>')
        // Horizontal rules
        .replace(/^---$/gm, '<hr />')
        // Paragraphs (double newline)
        .replace(/\n\n/g, '</p><p>');

    // Wrap consecutive <li> in <ul>
    html = html.replace(/((?:<li>.*<\/li>\s*)+)/g, '<ul>$1</ul>');

    return `<p>${html}</p>`;
}

export function SpecPane({ spec, progress, loading, editable, onSpecChange }: SpecPaneProps) {
    const [editing, setEditing] = useState(false);
    const [editText, setEditText] = useState('');

    function startEditing() {
        setEditText(spec);
        setEditing(true);
    }

    function saveEdit() {
        onSpecChange(editText);
        setEditing(false);
    }

    function cancelEdit() {
        setEditing(false);
    }

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
                    <button class="button button-small" onClick={startEditing}>
                        Edit Spec
                    </button>
                </div>
            )}

            {editing ? (
                <div class="spec-pane-editor">
                    <textarea
                        class="spec-pane-textarea"
                        value={editText}
                        onInput={e => setEditText(e.currentTarget.value)}
                        rows={30}
                    />
                    <div class="spec-pane-editor-actions">
                        <button class="button button-small" onClick={saveEdit}>Save</button>
                        <button class="button button-small button-secondary" onClick={cancelEdit}>Cancel</button>
                    </div>
                </div>
            ) : (
                <div class="spec-pane-content">
                    {loading && <LoadingIndicator message="Generating spec" />}
                    {spec && (
                        <div
                            class="spec-pane-markdown"
                            dangerouslySetInnerHTML={{ __html: renderMarkdown(spec) }}
                        />
                    )}
                </div>
            )}
        </div>
    );
}
