import type { useAssumptions } from './useAssumptions';
import type { Assumption } from './types';
import { AssumptionReview } from './AssumptionReview';

type Props = {
    assumptions: ReturnType<typeof useAssumptions>;
    ui: { openSections: Set<number>; toggleSection: (i: number) => void };
    onChatAssumption: (a: Assumption) => void;
};

export function AssumptionSection({ assumptions, ui, onChatAssumption }: Props) {
    return (
        <div class="collapsible" ref={assumptions.assumptionsSectionRef}>
            <button class="collapsible-header" onClick={() => ui.toggleSection(1)}>
                <span class="collapsible-title">Assumptions</span>
                {assumptions.assumptions.length > 0 && (
                    <span class="collapsible-badge">
                        {assumptions.assumptions.filter(a => a.status !== 'pending').length}/{assumptions.assumptions.length}
                    </span>
                )}
                <span class={`collapsible-chevron ${ui.openSections.has(1) ? 'collapsible-chevron--open' : ''}`}>&#9654;</span>
            </button>
            <div class={`collapsible-body ${ui.openSections.has(1) ? 'collapsible-body--open' : ''}`}>
                <div class="collapsible-content">
                    <AssumptionReview
                        assumptions={assumptions.assumptions}
                        onUpdate={assumptions.setAssumptions}
                        onDone={assumptions.markDone}
                        onRegenerate={() => assumptions.generate()}
                        loading={assumptions.loadingAssumptions}
                        done={assumptions.assumptionsDone}
                        onChat={onChatAssumption}
                    />
                </div>
            </div>
        </div>
    );
}
