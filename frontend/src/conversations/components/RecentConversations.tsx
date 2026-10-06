import { Link } from 'react-router';
import type { Conversation } from '../api/conversation-api';
import { ConversationListItemContent } from './ConversationListItemContent';

type Props = { conversations: Conversation[] };

export function RecentConversations({ conversations }: Props) {
  if (!conversations.length) {
    return <p className="text-xs text-[#8B848C] py-2">No recent conversations.</p>;
  }

  return (
    <nav className="flex flex-col gap-1" aria-label="Recent conversations">
      {conversations.slice(0, 12).map((conversation) => (
        <Link
          key={conversation.id}
          to={`/conversations/${conversation.id}`}
          className="group flex flex-col gap-0.5 p-2 rounded hover:bg-[#F0EEE9] text-[#252127] transition-colors border border-transparent hover:border-[#DAD5CD]"
        >
          <ConversationListItemContent conversation={conversation} />
        </Link>
      ))}
    </nav>
  );
}
