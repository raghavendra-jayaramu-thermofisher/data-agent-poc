import { useRef, useState } from 'react';
import { ChevronRight } from 'lucide-react';

export function FollowUpSuggestions({ suggestions, onSubmit, disabled = false }: {
  suggestions: unknown;
  onSubmit(question: string): Promise<void> | void;
  disabled?: boolean;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submitting = useRef(false);
  const questions = Array.isArray(suggestions)
    ? [...new Set(suggestions.filter((item): item is string => typeof item === 'string' && item.trim().length > 0 && item.length <= 600).map((item) => item.trim()))]
    : [];
  if (!questions.length) return null;
  const submit = async (question: string) => {
    if (disabled || submitting.current) return;
    submitting.current = true;
    setPending(true);
    setError(null);
    try {
      await onSubmit(question);
    } catch {
      setError('Unable to send the follow-up. Please try again.');
    } finally {
      submitting.current = false;
      setPending(false);
    }
  };
  return <section className="follow-up-suggestions" aria-label="Suggested follow-ups">
    <div className="follow-up-suggestions-list">
      {questions.map((question) => <button key={question} type="button" aria-label={question} title={question} disabled={disabled || pending} onClick={() => void submit(question)}>
        <span>{question}</span><ChevronRight size={14} aria-hidden="true" />
      </button>)}
    </div>
    {error && <p role="alert">{error}</p>}
  </section>;
}
