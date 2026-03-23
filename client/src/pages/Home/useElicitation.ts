import { useEffect, useState } from 'preact/hooks';

interface UseElicitationParams {
    response: string;
    clarifyingDone: boolean;
    assumptionsDone: boolean;
    requirementsCount: number;
    hasSpec?: boolean;
}

export function useElicitation({ response, clarifyingDone, assumptionsDone, requirementsCount, hasSpec }: UseElicitationParams) {
    const [openSections, setOpenSections] = useState<Set<number>>(() => new Set([0]));

    const stepCompleted = [
        clarifyingDone,
        assumptionsDone,
        requirementsCount > 0,
    ];
    const stepActive = [
        true,
        clarifyingDone,
        assumptionsDone,
    ];

    // Auto-open sections as they become active; collapse previous sections
    useEffect(() => {
        setOpenSections(prev => {
            const next = new Set(prev);
            for (let i = 0; i < 3; i++) {
                if (stepActive[i] && !stepCompleted[i]) next.add(i);
            }
            // Collapse goal when assumptions active
            if (stepActive[1]) next.delete(0);
            // Collapse assumptions when requirements active
            if (stepActive[2]) next.delete(1);
            // Auto-open spec section when spec appears
            if (hasSpec) next.add(3);
            return next;
        });
    }, [response, clarifyingDone, assumptionsDone, requirementsCount, hasSpec]);

    function toggleSection(index: number) {
        setOpenSections(prev => {
            const next = new Set(prev);
            if (next.has(index)) next.delete(index);
            else next.add(index);
            return next;
        });
    }

    return { openSections, toggleSection, stepCompleted, stepActive };
}
