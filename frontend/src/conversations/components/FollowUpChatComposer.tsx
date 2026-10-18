import { useState, type ComponentProps } from 'react';
import { ChatComposer } from './ChatComposer';

type FollowUpChatComposerProps = Omit<
  ComponentProps<typeof ChatComposer>,
  'question' | 'onQuestionChange' | 'onSubmit'
> & {
  onSubmit(question: string): Promise<void>;
};

// Keep each keystroke local so long answers and artifacts do not rerender with the draft.
export function FollowUpChatComposer({ onSubmit, ...props }: FollowUpChatComposerProps) {
  const [question, setQuestion] = useState('');
  const [error, setError] = useState('');

  const submitDraft = async () => {
    const submittedQuestion = question;
    setError('');
    try {
      await onSubmit(submittedQuestion);
      // A user can keep typing while this request is pending.
      setQuestion((current) => (current === submittedQuestion ? '' : current));
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Unable to send question. Try again.');
    }
  };

  return (
    <ChatComposer
      {...props}
      status={
        props.status || error ? (
          <>
            {props.status}
            {error && (
              <p className="chat-composer-error" role="alert">
                {error}
              </p>
            )}
          </>
        ) : undefined
      }
      question={question}
      onQuestionChange={setQuestion}
      onSubmit={submitDraft}
    />
  );
}
