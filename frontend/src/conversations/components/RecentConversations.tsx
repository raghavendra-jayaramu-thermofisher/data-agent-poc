import { Link } from 'react-router';
import type { Conversation } from '../api/conversation-api';
import { ConversationListItemContent } from './ConversationListItemContent';

type Props = { conversations: Conversation[] };

export function RecentConversations({ conversations }: Props) {
  if (!conversations.length) {
    return <p className="text-xs text-[var(--db-text-muted)] py-2">No recent conversations.</p>;
  }

  return (
    <nav className="flex flex-col gap-1" aria-label="Recent conversations">
      {conversations.slice(0, 12).map((conversation) => (
        <Link
          key={conversation.id}
          to={`/conversations/${conversation.id}`}
          className="group flex flex-col gap-0.5 p-2 rounded hover:bg-[var(--db-surface-muted)] text-[var(--db-text-primary)] transition-colors border border-transparent hover:border-[var(--db-border-default)]"
        >
          <ConversationListItemContent conversation={conversation} />
        </Link>
      ))}
    </nav>
  );
}
