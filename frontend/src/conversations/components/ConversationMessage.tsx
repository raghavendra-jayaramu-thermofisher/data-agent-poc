import { useState } from 'react';
import { Sparkles, User, Copy, Check } from 'lucide-react';
import type { ConversationMessage as Message } from '../api/conversation-api';
import { formatLocalDateTime } from '../../lib/datetime';
import { AssistantMarkdown } from './AssistantMarkdown';
import { MessageAnalysisDetails } from '../../agent/components/MessageAnalysisDetails';
import { BRANDING } from '../../lib/branding';

export function ConversationMessage({
  message,
  onFollowUp,
}: {
  message: Message;
  onFollowUp?(question: string): Promise<void> | void;
}) {
  const assistant = message.role === 'assistant';
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    void navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  if (!assistant) {
    return (
      <div className="chat-message-row user" data-message-id={message.id}>
        <div className="user-bubble-header">
          <span>You</span>
          <span className="user-avatar">
            <User size={11} />
          </span>
          <time className="user-time" dateTime={message.created_at}>
            {formatLocalDateTime(message.created_at)}
          </time>
        </div>
        <div className="user-bubble">
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div className="chat-message-row assistant" data-message-id={message.id}>
      <article className="assistant-card">
        <header className="assistant-card-header">
          <div className="assistant-avatar">
            <span className="w-5 h-5 rounded bg-[#F4E8F0] text-[#4B123F] grid place-items-center">
              <Sparkles size={11} />
            </span>
            <span>{BRANDING.name}</span>
          </div>

          <div className="flex items-center gap-2">
            <time className="assistant-time" dateTime={message.created_at}>
              {formatLocalDateTime(message.created_at)}
            </time>
            <button
              type="button"
              className="p-1 rounded text-[#8B848C] hover:text-[#252127] hover:bg-[#F0EEE9] transition-colors"
              title="Copy answer"
              onClick={handleCopy}
            >
              {copied ? <Check size={12} className="text-[#32745A]" /> : <Copy size={12} />}
            </button>
          </div>
        </header>

        <div className="assistant-card-content">
          <AssistantMarkdown content={message.content} />
        </div>

        {message.job_id ? (
          <MessageAnalysisDetails
            jobId={message.job_id}
            answerMarkdown={message.content}
            onFollowUp={onFollowUp}
          />
        ) : null}
      </article>
    </div>
  );
}
