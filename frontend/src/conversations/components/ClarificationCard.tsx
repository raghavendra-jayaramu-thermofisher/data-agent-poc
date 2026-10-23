import { Button } from '@heroui/react';
import { MessageCircleQuestion } from 'lucide-react';
import { useId, useState, type FormEvent } from 'react';
import type { AppError } from '../../api/errors';
import {
  answerErrors,
  type ClarificationAnswer,
  type ClarificationQuestion,
  type ClarificationRequest,
} from '../clarification';

function answerSummary(question: ClarificationQuestion, answer: ClarificationAnswer | undefined) {
  if (question.kind === 'text') return answer?.text?.trim() || 'No answer';
  const other = question.options?.find((option) => option.is_other)?.label;
  const chosen = (answer?.selected ?? []).map((label) =>
    label === other ? `${label}: ${answer?.other_text ?? ''}` : label,
  );
  return chosen.join('; ') || 'No answer';
}

export function ClarificationCard({
  request,
  answered,
  canAnswer,
  onSubmit,
  onCancel,
}: {
  request: ClarificationRequest;
  /** Answers already submitted for these questions, shown read-only. */
  answered: ClarificationAnswer[] | null;
  /** False once the conversation has moved on or an analysis is running. */
  canAnswer: boolean;
  onSubmit(answers: ClarificationAnswer[]): Promise<void>;
  /** Present while a paused analysis waits for these answers. */
  onCancel?(): Promise<void>;
}) {
  const formId = useId();
  const [answers, setAnswers] = useState<Record<string, ClarificationAnswer>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState('');
  const [busy, setBusy] = useState(false);
  // Shown until the saved answers arrive with the conversation's next message.
  const [sent, setSent] = useState<ClarificationAnswer[] | null>(null);
  const update = (id: string, change: Partial<ClarificationAnswer>) => {
    setAnswers((current) => ({ ...current, [id]: { question_id: id, ...current[id], ...change } }));
    setErrors((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const found = answerErrors(request, answers);
    setErrors(found);
    setFailure('');
    if (Object.keys(found).length) return;
    setBusy(true);
    const list = request.questions.map(
      (question) => answers[question.id] ?? { question_id: question.id },
    );
    try {
      await onSubmit(list);
      setSent(list);
    } catch (error) {
      const appError = error as Partial<AppError>;
      if (appError.fieldErrors) setErrors(appError.fieldErrors);
      setFailure(appError.message ?? 'Unable to send your answers. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const heading = (
    <header className="clarification-card-header">
      <MessageCircleQuestion size={18} aria-hidden="true" />
      <h2>A few questions before I continue</h2>
    </header>
  );

  const shown = answered ?? sent;
  if (shown || !canAnswer) {
    const byId = new Map((shown ?? []).map((answer) => [answer.question_id, answer]));
    return (
      <section className="clarification-card" aria-label="Clarifying questions">
        {heading}
        {request.reason && <p className="clarification-reason">{request.reason}</p>}
        <dl className="clarification-summary">
          {request.questions
            .filter((question) => !question.is_extra || byId.get(question.id)?.text)
            .map((question) => (
              <div key={question.id}>
                <dt>{question.prompt}</dt>
                <dd>{shown ? answerSummary(question, byId.get(question.id)) : 'Not answered'}</dd>
              </div>
            ))}
        </dl>
      </section>
    );
  }

  return (
    <section className="clarification-card" aria-label="Clarifying questions">
      {heading}
      {request.reason && <p className="clarification-reason">{request.reason}</p>}
      <form
        id={formId}
        className="clarification-form"
        onSubmit={(event) => void submit(event)}
        noValidate
      >
        {request.questions.map((question, index) => {
          const name = `${formId}-${question.id}`;
          const answer = answers[question.id];
          const error = errors[question.id];
          const errorId = `${name}-error`;
          const optional = question.required === false;
          return (
            <fieldset
              key={question.id}
              className="clarification-question"
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? errorId : undefined}
            >
              <legend>
                <span className="clarification-number">{index + 1}.</span> {question.prompt}
                {optional && <span className="clarification-optional"> (optional)</span>}
              </legend>
              {question.kind === 'text' ? (
                <textarea
                  aria-label={question.prompt}
                  rows={2}
                  maxLength={2000}
                  placeholder={question.placeholder ?? 'Type your answer'}
                  value={answer?.text ?? ''}
                  onChange={(event) => update(question.id, { text: event.target.value })}
                />
              ) : (
                <div className="clarification-options">
                  {(question.options ?? []).map((option) => {
                    const selected = answer?.selected ?? [];
                    const checked = selected.includes(option.label);
                    return (
                      <div key={option.label} className="clarification-option">
                        <label>
                          <input
                            type={question.multiple ? 'checkbox' : 'radio'}
                            name={name}
                            checked={checked}
                            onChange={() =>
                              update(question.id, {
                                selected: question.multiple
                                  ? checked
                                    ? selected.filter((label) => label !== option.label)
                                    : [...selected, option.label]
                                  : [option.label],
                              })
                            }
                          />
                          <span>
                            {option.label}
                            {option.description && (
                              <span className="clarification-option-description">
                                {option.description}
                              </span>
                            )}
                          </span>
                        </label>
                        {option.is_other && checked && (
                          <input
                            type="text"
                            className="clarification-other"
                            aria-label={`Other answer for: ${question.prompt}`}
                            maxLength={2000}
                            placeholder="Describe your answer"
                            value={answer?.other_text ?? ''}
                            onChange={(event) =>
                              update(question.id, { other_text: event.target.value })
                            }
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
              {error && (
                <p id={errorId} className="clarification-error">
                  {error}
                </p>
              )}
            </fieldset>
          );
        })}
        {failure && (
          <p className="clarification-error" role="alert">
            {failure}
          </p>
        )}
        <div className="clarification-actions">
          {onCancel && (
            <Button
              variant="secondary"
              isDisabled={busy}
              onPress={() => {
                setBusy(true);
                void onCancel().finally(() => setBusy(false));
              }}
            >
              Cancel analysis
            </Button>
          )}
          <Button variant="primary" type="submit" form={formId} isPending={busy}>
            Send answers
          </Button>
        </div>
      </form>
    </section>
  );
}
