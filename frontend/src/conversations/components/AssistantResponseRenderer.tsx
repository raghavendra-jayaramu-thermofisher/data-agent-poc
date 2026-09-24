import { useMemo } from 'react';
import type { JobArtifact, SqlExecution } from '../../agent/api/execution-api';
import { ArtifactRenderer } from '../../agent/components/ArtifactRenderer';
import { parseArtifactDirectives } from '../../agent/lib/artifact-directives';
import { AssistantMarkdown } from './AssistantMarkdown';

export function AssistantResponseRenderer({
  jobId,
  markdown,
  artifacts,
  sql,
  dataSourceNames = {},
  traceLoading = false,
  traceUnavailable = false,
  onFollowUp,
}: {
  jobId: string;
  markdown: string;
  artifacts: JobArtifact[];
  sql: SqlExecution[];
  dataSourceNames?: Record<string, string>;
  traceLoading?: boolean;
  traceUnavailable?: boolean;
  onFollowUp?(question: string): Promise<void> | void;
}) {
  const segments = useMemo(() => parseArtifactDirectives(markdown), [markdown]);
  const artifactsById = useMemo(
    () => new Map(artifacts.map((artifact) => [artifact.id, artifact])),
    [artifacts],
  );

  return (
    <div className="assistant-response-segments">
      {segments.map((segment, index) => {
        if (segment.type === 'markdown') {
          return <AssistantMarkdown key={`markdown-${index}`} content={segment.content} />;
        }

        const artifact = artifactsById.get(segment.artifactId);
        if (traceLoading) {
          return (
            <div
              key={`artifact-${segment.artifactId}`}
              className="my-3 p-3 border border-[#DAD5CD] bg-[#FBFAF7] text-xs text-[#8B848C]"
              role="status"
            >
              Loading output…
            </div>
          );
        }
        if (traceUnavailable || !artifact) {
          return (
            <div
              key={`artifact-${segment.artifactId}`}
              className="my-3 p-3 border border-[#DAD5CD] bg-[#F7E7E5] text-xs text-[#625C64]"
              role="status"
            >
              <strong>Output unavailable</strong>
              <p className="mt-1">
                The answer is preserved, but this referenced output could not be loaded.
              </p>
            </div>
          );
        }
        return (
          <ArtifactRenderer
            key={`artifact-${segment.artifactId}`}
            jobId={jobId}
            artifacts={[artifact]}
            sql={sql}
            dataSourceNames={dataSourceNames}
            renderReferencedHiddenTables
            onFollowUp={onFollowUp}
          />
        );
      })}
    </div>
  );
}
