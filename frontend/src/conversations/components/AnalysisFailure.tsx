import { Link } from 'react-router';
import { AlertTriangle, ExternalLink } from 'lucide-react';
import type { Job } from '../../api/types';

function failureTitle(job: Job) {
  if (job.status === 'cancelled') return 'Analysis cancelled';
  const code = (job.error_code ?? '').toUpperCase();
  if (code.includes('SQL') && code.includes('SAF')) return 'SQL rejected for safety';
  if (code.includes('TIMEOUT')) return 'Query timed out';
  if (code.includes('DATASOURCE')) return 'Data source unavailable';
  if (code.includes('SQL')) return 'SQL execution failed';
  return 'Analysis failed';
}

export function AnalysisFailure({ job }: { job: Job }) {
  return (
    <div className="chat-message-row assistant" data-job-id={job.id}>
      <article className="assistant-card border-[#A84545]/40 bg-[#F7E7E5]/30">
        <header className="assistant-card-header border-[#A84545]/20">
          <div className="flex items-center gap-1.5 text-[#A84545] font-semibold text-xs">
            <AlertTriangle size={14} />
            <span>{failureTitle(job)}</span>
          </div>
        </header>

        <p className="text-xs text-[#625C64] mb-2 leading-relaxed">
          {job.error_message ||
            'The analytical job did not complete. Ask a revised question or inspect the job record for safe operational details.'}
        </p>

        <Link
          to={`/jobs/${job.id}`}
          className="inline-flex items-center gap-1 text-xs text-[#4B123F] font-semibold hover:underline"
        >
          <span>View execution details</span>
          <ExternalLink size={11} />
        </Link>
      </article>
    </div>
  );
}
