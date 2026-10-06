import { useEffect, useState } from 'react';
import { BadgeCheck, BadgeAlert, BadgeX, ShieldQuestion } from 'lucide-react';
import { useOrganization } from '../../organizations/OrganizationProvider';
import { formatLocalDateTime } from '../../lib/datetime';
import { AssistantMarkdown } from './AssistantMarkdown';
import { saveVerification, type ConversationMessage } from '../api/conversation-api';

type Status = 'CORRECT' | 'PARTIALLY_CORRECT' | 'INCORRECT';
const labels = { CORRECT: 'Verified · Correct', PARTIALLY_CORRECT: 'Verified · Partially correct', INCORRECT: 'Reviewed · Incorrect' };
export function AnswerVerification({ message }: { message: ConversationMessage }) {
  const { activeOrganization } = useOrganization();
  const canReview = activeOrganization?.role === 'owner' || activeOrganization?.role === 'admin';
  const [saved, setSaved] = useState(message);
  const [editing, setEditing] = useState(false);
  const [status, setStatus] = useState<Status>('CORRECT');
  const [summary, setSummary] = useState('');
  const [percentage, setPercentage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { setSaved(message); }, [message]);
  const edit = () => {
    setStatus(saved.verification_status ?? 'CORRECT');
    setSummary(saved.verification_summary ?? '');
    setPercentage(saved.verification_percentage?.toString() ?? '');
    setError(''); setEditing(true);
  };
  const persist = async (clear = false) => {
    setBusy(true); setError('');
    try {
      const updated = await saveVerification(message, clear ? { verification_status: null } : {
        verification_status: status, verification_summary: summary,
        verification_percentage: status === 'PARTIALLY_CORRECT' ? Number(percentage) : null,
      });
      setSaved(updated); setEditing(false);
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to save verification.'); }
    finally { setBusy(false); }
  };
  const badge = saved.verification_status ? labels[saved.verification_status] + (saved.verification_status === 'PARTIALLY_CORRECT' ? ` · ${saved.verification_percentage}%` : '') : 'Not verified';
  const Icon = saved.verification_status === 'CORRECT' ? BadgeCheck : saved.verification_status === 'PARTIALLY_CORRECT' ? BadgeAlert : saved.verification_status === 'INCORRECT' ? BadgeX : ShieldQuestion;
  const color = saved.verification_status === 'CORRECT' ? 'text-green-700' : saved.verification_status === 'PARTIALLY_CORRECT' ? 'text-amber-700' : saved.verification_status === 'INCORRECT' ? 'text-red-700' : 'text-[#8B848C]';
  return <details className="relative shrink-0 text-xs">
    <summary aria-label={badge} title={badge} className={`cursor-pointer list-none [&::-webkit-details-marker]:hidden rounded-full p-1 hover:bg-[#F0EEE9] ${color}`}><Icon size={18} aria-hidden="true" /></summary>
    <div className="absolute right-0 top-full mt-2 z-30 w-[min(32rem,calc(100vw-3rem))] max-h-[70vh] overflow-auto rounded-lg border border-[#DAD5CD] bg-[#FFFDFC] p-4 shadow-lg space-y-3">
      <p className={`font-semibold ${color}`}>{badge}</p>
      {saved.verification_summary && <AssistantMarkdown content={saved.verification_summary} />}
      {saved.verified_at && <p className="text-[#625C64]">Reviewed by {saved.verified_by_name || 'workspace reviewer'} · {formatLocalDateTime(saved.verified_at)}</p>}
      {!saved.verification_status && <p>No verification has been recorded for this answer.</p>}
      {canReview && !editing && <div className="flex gap-3"><button type="button" onClick={edit} className="underline">{saved.verification_status ? 'Edit verification' : 'Verify answer'}</button>{saved.verification_status && <button type="button" disabled={busy} onClick={() => void persist(true)} className="underline">Clear verification</button>}</div>}
      {canReview && editing && <form className="space-y-3 max-w-2xl" onSubmit={(e) => { e.preventDefault(); void persist(); }}>
        <label className="block">Verification status<select className="block border rounded p-2 mt-1 w-full" value={status} onChange={(e) => setStatus(e.target.value as Status)}><option value="CORRECT">Correct</option><option value="PARTIALLY_CORRECT">Partially correct</option><option value="INCORRECT">Incorrect</option></select></label>
        {status === 'PARTIALLY_CORRECT' && <label className="block">Correctness percentage<input type="number" min="1" max="99" step="1" required className="block border rounded p-2 mt-1" value={percentage} onChange={(e) => setPercentage(e.target.value)} /><span>Correct claims ÷ checked claims × 100. Describe what was checked in the summary.</span></label>}
        <label className="block">Verification summary (Markdown)<textarea required maxLength={20000} rows={5} className="block border rounded p-2 mt-1 w-full" value={summary} onChange={(e) => setSummary(e.target.value)} /></label>
        <div className="flex gap-3"><button type="submit" disabled={busy || !summary.trim()} className="underline">{busy ? 'Saving…' : 'Save verification'}</button><button type="button" disabled={busy} onClick={() => setEditing(false)}>Cancel</button></div>
      </form>}
      {error && <p role="alert">{error}</p>}
    </div>
  </details>;
}
