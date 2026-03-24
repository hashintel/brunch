import { useState } from 'preact/hooks';
import { ConfidenceBadge } from './ConfidenceBadge';
import type { SpecSection as SpecSectionType } from './types';

const SECTION_TITLES: Record<string, string> = {
    purpose: 'Purpose & Overview',
    success_criteria: 'Success Criteria',
    deliverables: 'Deliverables',
    risks: 'Risks & Mitigation',
};

interface Props {
    section: SpecSectionType;
    onUpdate: (updates: Partial<SpecSectionType>) => void;
}

export function SpecSection({ section, onUpdate }: Props) {
    const [editing, setEditing] = useState(false);
    const [editContent, setEditContent] = useState(section.content);

    function saveEdit() {
        onUpdate({ content: editContent });
        setEditing(false);
    }

    function cancelEdit() {
        setEditContent(section.content);
        setEditing(false);
    }

    return (
        <div class="create-spec__section-card">
            <div class="create-spec__section-header">
                <h3 class="create-spec__section-title">{SECTION_TITLES[section.type] || section.type}</h3>
                <div class="create-spec__section-actions">
                    <ConfidenceBadge confidence={section.confidence} />
                    {!editing && (
                        <button class="create-spec__edit-btn" onClick={() => { setEditContent(section.content); setEditing(true); }}>
                            Edit
                        </button>
                    )}
                </div>
            </div>

            {editing ? (
                <div class="create-spec__section-edit">
                    <textarea
                        class="create-spec__section-textarea"
                        value={editContent}
                        onInput={(e) => setEditContent((e.target as HTMLTextAreaElement).value)}
                        rows={4}
                    />
                    <div class="create-spec__section-edit-actions">
                        <button class="create-spec__btn create-spec__btn--small" onClick={saveEdit}>Save</button>
                        <button class="create-spec__btn create-spec__btn--small create-spec__btn--secondary" onClick={cancelEdit}>Cancel</button>
                    </div>
                </div>
            ) : (
                <>
                    <p class="create-spec__section-content">{section.content}</p>

                    {section.items && section.items.length > 0 && (
                        <ul class="create-spec__section-list">
                            {section.items.map((item, i) => <li key={i}>{item}</li>)}
                        </ul>
                    )}

                    {section.risks && section.risks.length > 0 && (
                        <div class="create-spec__risks-table">
                            {section.risks.map((r, i) => (
                                <div key={i} class="create-spec__risk-row">
                                    <span class={`create-spec__risk-severity create-spec__risk-severity--${r.severity}`}>
                                        {r.severity}
                                    </span>
                                    <span class="create-spec__risk-text">{r.risk}</span>
                                    <span class="create-spec__risk-arrow">&rarr;</span>
                                    <span class="create-spec__risk-mitigation">{r.mitigation}</span>
                                </div>
                            ))}
                        </div>
                    )}

                    {section.assumptions && section.assumptions.length > 0 && (
                        <div class="create-spec__assumptions-card">
                            <strong>Assumptions:</strong>
                            <ul>
                                {section.assumptions.map((a, i) => <li key={i}>{a}</li>)}
                            </ul>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
