import type { useRequirements } from './useRequirements';
import type { Requirement } from './types';
import { RequirementList } from './RequirementList';

type Props = {
    req: ReturnType<typeof useRequirements>;
    ui: { openSections: Set<number>; toggleSection: (i: number) => void };
    onGenerateRequirements: () => void;
    onChatRequirement: (r: Requirement) => void;
    isCheckedOut: boolean;
};

export function RequirementSection({ req, ui, onGenerateRequirements, onChatRequirement, isCheckedOut }: Props) {
    return (
        <div class="collapsible">
            <button class="collapsible-header" onClick={() => ui.toggleSection(2)}>
                <span class="collapsible-title">Requirements</span>
                <span class={`collapsible-chevron ${ui.openSections.has(2) ? 'collapsible-chevron--open' : ''}`}>&#9654;</span>
            </button>
            <div class={`collapsible-body ${ui.openSections.has(2) ? 'collapsible-body--open' : ''}`}>
                <div class="collapsible-content">
                    {req.requirements.length > 0 && (
                        <RequirementList
                            requirements={req.requirements}
                            onUpdate={req.setRequirements}
                            onGenerateChildren={req.generateChildren}
                            onGenerateTests={req.generateTests}
                            generatingChildrenId={req.generatingChildrenId}
                            generatingTestsId={req.generatingTestsId}
                            pendingTests={req.pendingTests}
                            onApprovePendingTests={req.approvePendingTests}
                            onCancelPendingTests={req.cancelPendingTests}
                            onChat={onChatRequirement}
                        />
                    )}
                    <button
                        class="button"
                        onClick={onGenerateRequirements}
                        disabled={isCheckedOut || req.loadingRequirements}
                    >
                        {req.loadingRequirements ? 'Generating\u2026' : req.requirements.length > 0 ? 'Generate More' : 'Generate Requirements'}
                    </button>
                </div>
            </div>
        </div>
    );
}
