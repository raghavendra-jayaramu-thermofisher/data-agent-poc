import { GitBranch, Box, Clock, Fingerprint } from 'lucide-react';
import type { components } from '../../api/generated/schema';
import { formatLocalDateTime } from '../../lib/datetime';

type KnowledgeStatus = components['schemas']['KnowledgeStatusResponse'];

export function KnowledgeSummary({ status }: { status: KnowledgeStatus | undefined }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 my-4">
      <div className="p-3.5 bg-[#FFFDFC] border border-[#DAD5CD] rounded-lg shadow-2xs">
        <div className="flex items-center gap-1.5 text-xs text-[#8B848C] font-semibold uppercase tracking-wider">
          <GitBranch size={13} className="text-[#4B123F]" />
          <span>Version</span>
        </div>
        <div className="text-lg font-bold text-[#252127] mt-1">
          {status?.current_version_number != null ? `v${status.current_version_number}` : '—'}
        </div>
      </div>

      <div className="p-3.5 bg-[#FFFDFC] border border-[#DAD5CD] rounded-lg shadow-2xs">
        <div className="flex items-center gap-1.5 text-xs text-[#8B848C] font-semibold uppercase tracking-wider">
          <Box size={13} className="text-[#4B123F]" />
          <span>Schema Objects</span>
        </div>
        <div className="text-lg font-bold text-[#252127] mt-1">
          {status?.object_count?.toLocaleString() ?? '—'}
        </div>
      </div>

      <div className="p-3.5 bg-[#FFFDFC] border border-[#DAD5CD] rounded-lg shadow-2xs">
        <div className="flex items-center gap-1.5 text-xs text-[#8B848C] font-semibold uppercase tracking-wider">
          <Clock size={13} className="text-[#4B123F]" />
          <span>Generated At</span>
        </div>
        <div className="text-xs font-medium text-[#252127] mt-1 truncate">
          {status?.generated_at ? formatLocalDateTime(status.generated_at) : 'Never'}
        </div>
      </div>

      <div className="p-3.5 bg-[#FFFDFC] border border-[#DAD5CD] rounded-lg shadow-2xs">
        <div className="flex items-center gap-1.5 text-xs text-[#8B848C] font-semibold uppercase tracking-wider">
          <Fingerprint size={13} className="text-[#4B123F]" />
          <span>Fingerprint</span>
        </div>
        <div className="text-xs font-mono font-medium text-[#252127] mt-1 truncate">
          {status?.schema_fingerprint ? status.schema_fingerprint.slice(0, 14) : '—'}
        </div>
      </div>
    </div>
  );
}
