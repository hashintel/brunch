import { useState } from 'preact/hooks';
import type { WizardAssumption } from './types';

const IMPACT_COLORS: Record<string, { color: string; label: string }> = {
    high: { color: '#e14640', label: 'High Impact' },
    medium: { color: '#ff9d1c', label: 'Medium Impact' },
    low: { color: '#3cba49', label: 'Low Impact' },
};

const CONFIDENCE_COLORS: Record<string, { color: string; label: string }> = {
    high: { color: '#22c55e', label: 'High Confidence' },
    medium: { color: '#f59e0b', label: 'Medium Confidence' },
    low: { color: '#ef4444', label: 'Low Confidence' },
};

interface Props {
    assumptions: WizardAssumption[];
    selectedId: string | null;
    onSelect: (id: string) => void;
    onConfirm: (id: string) => void;
    onConfirmAll: () => void;
    onEdit: (id: string, text: string) => void;
    onContinue: () => void;
    loading?: boolean;
}

export function AssumptionsScreen({ assumptions, selectedId, onSelect, onConfirm, onConfirmAll, onEdit, onContinue, loading }: Props) {
    const selected = assumptions.find(a => a.id === selectedId) ?? null;
    const allConfirmed = assumptions.length > 0 && assumptions.every(a => a.status === 'confirmed' || a.status === 'edited');

    return (
        <div class="cs-assumptions">
            <div class="cs-assumptions__list">
                <div class="cs-assumptions__list-header">
                    <h2 class="cs-assumptions__title">We made some initial assumptions</h2>
                    <p class="cs-assumptions__subtitle">
                        We extracted these assumptions. Edit anything that's wrong &mdash;
                        changing one assumption may affect others.
                    </p>
                </div>

                <div class="cs-assumptions__meta">
                    <span class="cs-assumptions__count">{assumptions.length} assumptions</span>
                    <div class="cs-assumptions__meta-actions">
                        {!allConfirmed && assumptions.length > 0 && (
                            <button class="cs-assumptions__confirm-all-btn" onClick={onConfirmAll}>
                                Confirm all
                            </button>
                        )}
                        <span class="cs-assumptions__sort">Most important &#9662;</span>
                    </div>
                </div>

                {selected && (
                    <div class="cs-assumptions__sticky-selected">
                        <AssumptionCard
                            assumption={selected}
                            isSelected={true}
                            onSelect={() => {}}
                            onConfirm={() => onConfirm(selected.id)}
                            onEdit={onEdit}
                        />
                    </div>
                )}

                <div class="cs-assumptions__cards">
                    {assumptions.map(a => (
                        a.id === selectedId ? (
                            <div key={a.id} class="cs-assumptions__card-anchor" />
                        ) : (
                            <AssumptionCard
                                key={a.id}
                                assumption={a}
                                isSelected={false}
                                onSelect={() => onSelect(a.id)}
                                onConfirm={() => onConfirm(a.id)}
                                onEdit={onEdit}
                            />
                        )
                    ))}
                </div>

                {loading && (
                    <div class="cs-assumptions__streaming">Generating assumptions...</div>
                )}

                <div class="cs-assumptions__continue-wrap">
                    <button class="cs-assumptions__continue-btn" onClick={onContinue} disabled={loading}>
                        Continue to Requirements
                    </button>
                </div>
            </div>

            <div class="cs-assumptions__detail">
                {selected && (
                    <AssumptionDetail
                        assumption={selected}
                        onConfirm={() => onConfirm(selected.id)}
                        onEdit={onEdit}
                    />
                )}
            </div>
        </div>
    );
}

function AssumptionCard({ assumption: a, isSelected, onSelect, onConfirm, onEdit }: {
    assumption: WizardAssumption;
    isSelected: boolean;
    onSelect: () => void;
    onConfirm: () => void;
    onEdit: (id: string, text: string) => void;
}) {
    const impact = IMPACT_COLORS[a.impact];
    const conf = CONFIDENCE_COLORS[a.confidence];

    return (
        <div
            class={`cs-assumption-card ${isSelected ? 'cs-assumption-card--selected' : ''} ${a.status === 'confirmed' ? 'cs-assumption-card--confirmed' : ''}`}
            onClick={onSelect}
        >
            <div class="cs-assumption-card__body">
                <span class="cs-assumption-card__label">{a.label}</span>
                <p class="cs-assumption-card__text">{a.editedText || a.text}</p>
                {a.rationale && <p class="cs-assumption-card__rationale">{a.rationale}</p>}
            </div>
            <div class="cs-assumption-card__footer">
                <div class="cs-assumption-card__badges">
                    <span class="cs-assumption-card__impact" style={{ color: impact.color }}>
                        &#9679; {impact.label}
                    </span>
                    <span class="cs-assumption-card__divider" />
                    <span class="cs-assumption-card__confidence" style={{ color: conf.color }}>
                        &#9608;&#9608; {conf.label}
                    </span>
                </div>
                <div class="cs-assumption-card__actions">
                    <button class="cs-assumption-card__btn" onClick={(e) => { e.stopPropagation(); onSelect(); }}>Edit</button>
                    {a.status === 'confirmed' ? (
                        <button class="cs-assumption-card__btn cs-assumption-card__btn--confirmed" onClick={(e) => e.stopPropagation()}>
                            &#10003; Confirmed
                        </button>
                    ) : (
                        <button class="cs-assumption-card__btn" onClick={(e) => { e.stopPropagation(); onConfirm(); }}>Confirm</button>
                    )}
                </div>
            </div>
        </div>
    );
}

function AssumptionDetail({ assumption: a, onConfirm, onEdit }: {
    assumption: WizardAssumption;
    onConfirm: () => void;
    onEdit: (id: string, text: string) => void;
}) {
    const impact = IMPACT_COLORS[a.impact];
    const conf = CONFIDENCE_COLORS[a.confidence];
    const [selectedOption, setSelectedOption] = useState<string | null>(null);
    const [otherText, setOtherText] = useState('');

    function handleSave() {
        if (selectedOption === '__other' && otherText.trim()) {
            onEdit(a.id, otherText.trim());
        } else if (selectedOption && selectedOption !== '__other') {
            onEdit(a.id, selectedOption);
        }
    }

    return (
        <div class="cs-assumption-detail">
            <div class="cs-assumption-detail__header">
                <div class="cs-assumption-detail__badges">
                    <span style={{ color: impact.color }}>&#9679; {impact.label}</span>
                    <span class="cs-assumption-detail__divider" />
                    <span style={{ color: conf.color }}>&#9608;&#9608; {conf.label}</span>
                </div>
                {a.status === 'confirmed' ? (
                    <button class="cs-assumption-detail__confirm-btn cs-assumption-detail__confirm-btn--active">
                        &#10003; Confirmed
                    </button>
                ) : (
                    <button class="cs-assumption-detail__confirm-btn" onClick={onConfirm}>Confirm</button>
                )}
            </div>

            <div class="cs-assumption-detail__content">
                <span class="cs-assumption-detail__label">{a.label}</span>
                <p class="cs-assumption-detail__text">{a.editedText || a.text}</p>
                <p class="cs-assumption-detail__rationale">{a.rationale}</p>
            </div>

            <hr class="cs-assumption-detail__divider-line" />

            {a.options && a.options.length > 0 && (
                <div class="cs-assumption-detail__options">
                    <h4 class="cs-assumption-detail__options-title">Choose a different option:</h4>
                    <div class="cs-assumption-detail__options-list">
                        {a.options.map(opt => (
                            <label key={opt} class="cs-assumption-detail__radio">
                                <input
                                    type="radio"
                                    name={`opt-${a.id}`}
                                    checked={selectedOption === opt}
                                    onChange={() => setSelectedOption(opt)}
                                />
                                <span>{opt}</span>
                            </label>
                        ))}
                        <label class="cs-assumption-detail__radio">
                            <input
                                type="radio"
                                name={`opt-${a.id}`}
                                checked={selectedOption === '__other'}
                                onChange={() => setSelectedOption('__other')}
                            />
                            <span>Other</span>
                        </label>
                        {selectedOption === '__other' && (
                            <input
                                type="text"
                                class="cs-assumption-detail__other-input"
                                placeholder="Enter option..."
                                value={otherText}
                                onInput={(e) => setOtherText((e.target as HTMLInputElement).value)}
                            />
                        )}
                    </div>
                    {selectedOption && (
                        <button class="cs-assumption-detail__save-btn" onClick={handleSave}>Save</button>
                    )}
                </div>
            )}
        </div>
    );
}
