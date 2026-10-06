import { BadgeAlert, BadgeCheck, BadgeX, ListChecks, MessageSquare } from 'lucide-react';
import type { Conversation } from '../api/conversation-api';
import { formatRelativeTime } from '../../lib/datetime';

export function ConversationListItemContent({ conversation }: { conversation: Conversation }) {
  const counts = conversation.answer_review_counts;
  const total = counts?.total ?? 0;
  const correct = counts?.correct ?? 0;
  const partial = counts?.partially_correct ?? 0;
  const incorrect = counts?.incorrect ?? 0;
  const unreviewed = counts?.unreviewed ?? total;
  const reviewed = correct + partial + incorrect;
  const allCorrect = total > 0 && correct === total;
  const Icon = incorrect ? BadgeX : partial ? BadgeAlert : allCorrect ? BadgeCheck : reviewed ? ListChecks : MessageSquare;
  const color = incorrect ? 'text-red-700' : partial ? 'text-amber-700' : allCorrect ? 'text-green-700' : 'text-[#8B848C]';
  const reviewLabel = `${reviewed} reviewed · ${unreviewed} unreviewed`;
  const description = total
    ? `${reviewLabel}. ${correct} correct, ${partial} partially correct, ${incorrect} incorrect.`
    : 'No answers yet';

  return <div className="flex items-start gap-2 min-w-0">
    <span role="img" aria-label={description} title={description} className={`shrink-0 mt-0.5 ${color}`}>
      <Icon size={15} aria-hidden="true" />
    </span>
    <div className="min-w-0 flex-1">
      <div className="text-[13px] font-medium text-[#252127] line-clamp-2 break-words leading-5" title={conversation.title?.trim() || 'Untitled analysis'}>
        {conversation.title?.trim() || 'Untitled analysis'}
      </div>
      <div className="flex flex-wrap items-center gap-x-2 text-[11px] text-[#8B848C] leading-4 mt-0.5">
        <span>{formatRelativeTime(conversation.updated_at)}</span>
        {total > 1 && <span title={description}>{reviewLabel}</span>}
      </div>
    </div>
  </div>;
}
