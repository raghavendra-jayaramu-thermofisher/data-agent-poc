import { Link } from 'react-router';
import { MessageSquare, Database, Clock } from 'lucide-react';
import type { Conversation } from '../api/conversation-api';
import { formatRelativeTime } from '../../lib/datetime';

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
          <div className="flex items-center gap-1.5 font-medium text-xs text-[#252127] group-hover:text-[#4B123F]">
            <MessageSquare size={12} className="flex-shrink-0 text-[#8B848C] group-hover:text-[#4B123F]" />
            <span className="truncate">{conversation.title?.trim() || 'Untitled analysis'}</span>
          </div>

          <div className="flex items-center gap-2 pl-4 text-[11px] text-[#8B848C]">
            <span className="flex items-center gap-0.5">
              <Database size={10} />
              <span>{conversation.data_source_ids?.length ?? 0}</span>
            </span>
            <span>·</span>
            <span className="flex items-center gap-0.5">
              <Clock size={10} />
              <span>{formatRelativeTime(conversation.updated_at)}</span>
            </span>
          </div>
        </Link>
      ))}
    </nav>
  );
}
