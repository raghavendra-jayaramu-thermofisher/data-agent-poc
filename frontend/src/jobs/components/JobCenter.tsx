import { Button, Drawer } from '@heroui/react';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Activity, Loader2, X } from 'lucide-react';
import { StatusChip } from '../../components/StatusChip';
import { formatLocalDateTime, formatRelativeTime } from '../../lib/datetime';
import { getJobDestination, useJobManager } from '../JobManagerProvider';
import { isActiveJobStatus } from '../types';

export function JobCenter() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { jobs, activeJobs, cancel, currentLabel } = useJobManager();

  return (
    <Drawer>
      <button
        type="button"
        className="topbar-btn relative"
        onClick={() => setOpen(true)}
        aria-label="Open job center"
      >
        <Activity size={13} className={activeJobs.length ? 'text-[#E3AC19] animate-pulse' : 'opacity-70'} />
        <span>Jobs</span>
        {activeJobs.length > 0 && (
          <span className="inline-flex items-center justify-center px-1.5 py-0.2 text-[10px] font-bold bg-[#E3AC19] text-[#252127] rounded-full">
            {activeJobs.length}
          </span>
        )}
      </button>

      <Drawer.Backdrop isOpen={open} onOpenChange={setOpen}>
        <Drawer.Content placement="right">
          <Drawer.Dialog aria-label="Job Center">
            <Drawer.Header>
              <div className="flex items-center justify-between w-full">
                <Drawer.Heading>Job Center</Drawer.Heading>
                <button
                  type="button"
                  className="text-[#8B848C] hover:text-[#252127] p-1"
                  onClick={() => setOpen(false)}
                >
                  <X size={15} />
                </button>
              </div>
            </Drawer.Header>
            <Drawer.Body>
              <div className="job-center-list">
                {jobs.slice(0, 20).map(({ job, connectionState }) => (
                  <article className="job-center-row" key={job.id}>
                    <div className="job-center-title-row">
                      <button
                        className="link-button flex items-center gap-1.5 font-medium"
                        type="button"
                        onClick={() => {
                          setOpen(false);
                          navigate(getJobDestination(job) ?? `/jobs/${job.id}`);
                        }}
                      >
                        {isActiveJobStatus(job.status) && (
                          <Loader2 size={12} className="animate-spin text-[#4B123F]" />
                        )}
                        <span>{job.job_type.replaceAll('_', ' ')}</span>
                      </button>
                      <StatusChip status={job.status} />
                    </div>
                    <p>
                      {currentLabel(job.id) ??
                        (isActiveJobStatus(job.status)
                          ? 'Waiting for progress…'
                          : job.error_message ?? 'Finished')}
                    </p>
                    <div className="job-center-meta">
                      <span title={formatLocalDateTime(job.created_at)}>
                        {formatRelativeTime(job.finished_at ?? job.started_at ?? job.created_at)}
                      </span>
                      {isActiveJobStatus(job.status) ? (
                        <span className="text-[#32745A] font-semibold">
                          {connectionState === 'reconnecting' ? 'Reconnecting…' : 'Live'}
                        </span>
                      ) : null}
                    </div>
                    {isActiveJobStatus(job.status) ? (
                      <Button size="sm" variant="ghost" onPress={() => void cancel(job.id)}>
                        Cancel
                      </Button>
                    ) : null}
                  </article>
                ))}
                {!jobs.length ? <p className="muted-copy text-center py-4">No recent jobs.</p> : null}
              </div>
            </Drawer.Body>
            <Drawer.Footer>
              <Button
                variant="secondary"
                onPress={() => {
                  setOpen(false);
                  navigate('/jobs');
                }}
              >
                View all jobs
              </Button>
            </Drawer.Footer>
          </Drawer.Dialog>
        </Drawer.Content>
      </Drawer.Backdrop>
    </Drawer>
  );
}
