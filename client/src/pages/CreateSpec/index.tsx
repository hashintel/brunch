import './style.css';
import { useState, useEffect } from 'preact/hooks';
import { useSpecWizard } from './useSpecWizard';
import { LandingScreen } from './LandingScreen';
import { ClarifyScreen } from './ClarifyScreen';
import { SkeletonLoader } from './SkeletonLoader';
import type { Model } from '../Home/types';

export function CreateSpec() {
    const [selectedModel, setSelectedModel] = useState('claude-haiku-4-5');
    const [models, setModels] = useState<Model[]>([]);

    useEffect(() => {
        fetch('/api/models').then(r => r.json()).then((data: Model[]) => setModels(data)).catch(() => {});
    }, []);

    const wizard = useSpecWizard({ selectedModel });

    return (
        <div class="create-spec">
            <div class="create-spec__header">
                <a href="/" class="create-spec__back-link">&larr; Home</a>
                <select
                    class="create-spec__model-select"
                    value={selectedModel}
                    onChange={(e) => setSelectedModel((e.target as HTMLSelectElement).value)}
                >
                    {models.map(m => (
                        <option key={m.id} value={m.id}>{m.label}</option>
                    ))}
                </select>
            </div>

            {wizard.screen === 'landing' && (
                <LandingScreen onSubmit={wizard.submit} />
            )}

            {wizard.screen === 'loading' && (
                <div class="create-spec__loading">
                    <h2>Analyzing your project idea...</h2>
                    <SkeletonLoader lines={5} />
                    <SkeletonLoader lines={4} />
                </div>
            )}

            {wizard.screen === 'clarify' && (
                <ClarifyScreen
                    questions={wizard.questions.questions}
                    answers={wizard.questions.answers}
                    currentIndex={wizard.questions.currentIndex}
                    answeredCount={wizard.questions.answeredCount}
                    remainingCount={wizard.questions.remainingCount}
                    onAnswer={wizard.questions.answerQuestion}
                    onSkip={wizard.questions.skipQuestion}
                    onNext={wizard.questions.goNext}
                    onBack={wizard.questions.goBack}
                    onSkipAll={wizard.skipAllAndGenerate}
                    spec={wizard.spec.spec}
                    specLoading={wizard.spec.loading}
                    onUpdateSection={wizard.spec.updateSection}
                />
            )}

            {(wizard.questions.error || wizard.spec.error) && (
                <div class="create-spec__error">
                    {wizard.questions.error || wizard.spec.error}
                </div>
            )}
        </div>
    );
}
