import type { LucideIcon } from 'lucide-react';
import {
  ChevronRight,
  CircleStop,
  Clock3,
  Database,
  ShieldAlert,
  TriangleAlert,
} from 'lucide-react';
import { Link } from 'react-router';
import type { Job } from '../../api/types';

type FailureTone = 'stopped' | 'warning' | 'danger';

type FailurePresentation = {
  description: string;
  icon: LucideIcon;
  title: string;
  tone: FailureTone;
};

function failurePresentation(job: Job): FailurePresentation {
  const code = (job.error_code ?? '').toUpperCase();

  if (job.status === 'cancelled' || code === 'JOB_CANCELLED') {
    return {
      title: 'Analysis stopped',
      description: 'This request was stopped. You can revise your question and try again.',
      icon: CircleStop,
      tone: 'stopped',
    };
  }

  if (code.includes('TIMEOUT')) {
    return {
      title: 'This analysis took too long',
      description: 'Try a smaller date range, fewer filters, or a more focused question.',
      icon: Clock3,
      tone: 'warning',
    };
  }

  if (code.includes('DATASOURCE')) {
    return {
      title: 'Data source unavailable',
      description:
        'We could not reach the selected data source. Check its connection and try again.',
      icon: Database,
      tone: 'warning',
    };
  }

  if (code.includes('SAFETY') || code.includes('NOT_AUTHORIZED') || code === 'FORBIDDEN') {
    return {
      title: 'This request could not be run safely',
      description: 'Rephrase it as a read-only analytics question and try again.',
      icon: ShieldAlert,
      tone: 'warning',
    };
  }

  if (code.includes('SQL')) {
    return {
      title: 'The query could not be completed',
      description: 'Try simplifying your question or using a smaller set of data.',
      icon: TriangleAlert,
      tone: 'warning',
    };
  }

  return {
    title: 'We could not complete this analysis',
    description: 'Try again in a moment. If the problem continues, review the execution details.',
    icon: TriangleAlert,
    tone: 'danger',
  };
}

export function AnalysisFailure({ job }: { job: Job }) {
  const presentation = failurePresentation(job);
  const Icon = presentation.icon;
  const isFailure = presentation.tone === 'danger';

  return (
    <div className="chat-message-row assistant" data-job-id={job.id}>
      <article
        className={`analysis-outcome analysis-outcome--${presentation.tone}`}
        role={isFailure ? 'alert' : 'status'}
      >
        <span className="analysis-outcome-icon" aria-hidden="true">
          <Icon size={18} strokeWidth={1.8} />
        </span>

        <div className="analysis-outcome-body">
          <div className="analysis-outcome-message">
            <h3>{presentation.title}</h3>
            <p>{presentation.description}</p>
          </div>

          <Link to={`/jobs/${job.id}`} className="analysis-outcome-details">
            <span>View details</span>
            <ChevronRight size={14} aria-hidden="true" />
          </Link>
        </div>
      </article>
    </div>
  );
}
