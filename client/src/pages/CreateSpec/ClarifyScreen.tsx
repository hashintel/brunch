import { QuestionPanel } from './QuestionPanel';
import { SpecPreviewPanel } from './SpecPreviewPanel';
import type { SpecQuestion, SpecAnswer, StructuredSpec, SpecSection } from './types';

interface Props {
    questions: SpecQuestion[];
    answers: SpecAnswer[];
    currentIndex: number;
    answeredCount: number;
    remainingCount: number;
    onAnswer: (index: number, answer: SpecAnswer) => void;
    onSkip: (index: number) => void;
    onNext: () => void;
    onBack: () => void;
    onSkipAll: () => void;
    spec: StructuredSpec | null;
    specLoading: boolean;
    onUpdateSection: (index: number, updates: Partial<SpecSection>) => void;
}

export function ClarifyScreen({
    questions, answers, currentIndex,
    answeredCount, remainingCount,
    onAnswer, onSkip, onNext, onBack, onSkipAll,
    spec, specLoading, onUpdateSection,
}: Props) {
    return (
        <div class="create-spec__clarify">
            <QuestionPanel
                questions={questions}
                answers={answers}
                currentIndex={currentIndex}
                onAnswer={onAnswer}
                onSkip={onSkip}
                onNext={onNext}
                onBack={onBack}
                onSkipAll={onSkipAll}
                answeredCount={answeredCount}
                remainingCount={remainingCount}
            />
            <SpecPreviewPanel
                spec={spec}
                loading={specLoading}
                onUpdateSection={onUpdateSection}
            />
        </div>
    );
}
