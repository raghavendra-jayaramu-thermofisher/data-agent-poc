import type { components } from '../../api/generated/schema';
import { formatLocalDateTime } from '../../lib/datetime';

type Version = components['schemas']['KnowledgeVersionResponse'];

export function KnowledgeVersionsTable({ versions }: { versions: Version[] }) {
  return (
    <div className="p-4 bg-[#FFFDFC] border border-[#DAD5CD] rounded-md mt-4">
      <h2 className="text-sm font-semibold text-[#252127] pb-2 mb-3 border-b border-[#E7E3DC]">
        Version History
      </h2>
      {versions.length ? (
        <div className="analytical-table-shell">
          <table className="analytical-table" aria-label="Knowledge versions">
            <thead>
              <tr>
                <th>Version</th>
                <th>Schema Fingerprint</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {versions.map((version) => (
                <tr key={version.id}>
                  <td className="font-semibold text-[#252127]">v{version.version_number}</td>
                  <td className="font-mono text-xs text-[#625C64]">{version.schema_fingerprint.slice(0, 16)}</td>
                  <td className="text-xs text-[#625C64]">{formatLocalDateTime(version.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-xs text-[#8B848C]">No version history recorded yet.</p>
      )}
    </div>
  );
}
