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

  const submitDraft = async () => {
    const submittedQuestion = question;
    await onSubmit(submittedQuestion);
    // A user can keep typing while this request is pending.
    setQuestion((current) => current === submittedQuestion ? '' : current);
  };

  return (
    <ChatComposer
      {...props}
      question={question}
      onQuestionChange={setQuestion}
      onSubmit={submitDraft}
    />
  );
}
