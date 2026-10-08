import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Button, Modal } from '@heroui/react';
import { queryKeys } from '../../api/queryKeys';
import { BadgeCheck, BadgeAlert, BadgeX, ShieldQuestion } from 'lucide-react';
import { useOrganization } from '../../organizations/OrganizationProvider';
import { formatLocalDateTime } from '../../lib/datetime';
import { AssistantMarkdown } from './AssistantMarkdown';
import { saveVerification, type ConversationMessage } from '../api/conversation-api';

type Status = 'CORRECT' | 'PARTIALLY_CORRECT' | 'INCORRECT';
const labels = { CORRECT: 'Verified · Correct', PARTIALLY_CORRECT: 'Verified · Partially correct', INCORRECT: 'Reviewed · Incorrect' };
export function AnswerVerification({ message }: { message: ConversationMessage }) {
  const queryClient = useQueryClient();
  const { activeOrganization } = useOrganization();
  const canReview = activeOrganization?.role === 'owner' || activeOrganization?.role === 'admin';
  const [savedState, setSavedState] = useState<{ source: ConversationMessage; value: ConversationMessage } | null>(null);
  const saved = savedState?.source === message ? savedState.value : message;
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [status, setStatus] = useState<Status>('CORRECT');
  const [summary, setSummary] = useState('');
  const [percentage, setPercentage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
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
      setSavedState({ source: message, value: updated }); setEditing(false);
      void queryClient.invalidateQueries({ queryKey: queryKeys.conversations.all(activeOrganization?.id ?? null) });
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to save verification.'); }
    finally { setBusy(false); }
  };
  const badge = saved.verification_status ? labels[saved.verification_status] + (saved.verification_status === 'PARTIALLY_CORRECT' ? ` · ${saved.verification_percentage}%` : '') : 'Not verified';
  const Icon = saved.verification_status === 'CORRECT' ? BadgeCheck : saved.verification_status === 'PARTIALLY_CORRECT' ? BadgeAlert : saved.verification_status === 'INCORRECT' ? BadgeX : ShieldQuestion;
  const color = saved.verification_status === 'CORRECT' ? 'text-green-700' : saved.verification_status === 'PARTIALLY_CORRECT' ? 'text-amber-700' : saved.verification_status === 'INCORRECT' ? 'text-red-700' : 'text-[#8B848C]';
  const close = () => {
    if (busy) return;
    setOpen(false);
    setEditing(false);
    setError('');
  };

  return (
    <>
      <button
        type="button"
        className={`assistant-card-action shrink-0 ${color}`}
        aria-label={badge}
        title={badge}
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      >
        <Icon size={18} aria-hidden="true" />
      </button>
      <Modal.Backdrop
        isOpen={open}
        isDismissable={!busy}
        isKeyboardDismissDisabled={busy}
        onOpenChange={(value) => {
          if (!value) close();
          else setOpen(true);
        }}
      >
        <Modal.Container size="md">
          <Modal.Dialog>
            <Modal.CloseTrigger isDisabled={busy} />
            <Modal.Header>
              <Modal.Heading>Answer verification</Modal.Heading>
            </Modal.Header>
            <Modal.Body>
              <div className="space-y-3 text-sm">
                <p className={`flex items-center gap-2 font-semibold ${color}`}>
                  <Icon size={18} aria-hidden="true" />
                  {badge}
                </p>
                {saved.verification_summary && <AssistantMarkdown content={saved.verification_summary} />}
                {saved.verified_at && (
                  <p className="text-[#625C64]">
                    Reviewed by {saved.verified_by_name || 'workspace reviewer'} · {formatLocalDateTime(saved.verified_at)}
                  </p>
                )}
                {!saved.verification_status && <p>No verification has been recorded for this answer.</p>}
                {canReview && editing && (
                  <form
                    id={`verify-answer-${message.id}`}
                    className="space-y-3"
                    onSubmit={(event) => { event.preventDefault(); void persist(); }}
                  >
                    <label className="block">
                      Verification status
                      <select className="block border rounded p-2 mt-1 w-full" value={status} onChange={(event) => setStatus(event.target.value as Status)}>
                        <option value="CORRECT">Correct</option>
                        <option value="PARTIALLY_CORRECT">Partially correct</option>
                        <option value="INCORRECT">Incorrect</option>
                      </select>
                    </label>
                    {status === 'PARTIALLY_CORRECT' && (
                      <label className="block">
                        Correctness percentage
                        <input type="number" min="1" max="99" step="1" required className="block border rounded p-2 mt-1" value={percentage} onChange={(event) => setPercentage(event.target.value)} />
                        <span>Correct claims ÷ checked claims × 100. Describe what was checked in the summary.</span>
                      </label>
                    )}
                    <label className="block">
                      Verification summary (Markdown)
                      <textarea required maxLength={20000} rows={5} className="block border rounded p-2 mt-1 w-full" value={summary} onChange={(event) => setSummary(event.target.value)} />
                    </label>
                  </form>
                )}
                {error && <p role="alert" className="text-red-700">{error}</p>}
              </div>
            </Modal.Body>
            <Modal.Footer>
              {canReview && editing ? (
                <>
                  <Button variant="secondary" isDisabled={busy} onPress={() => setEditing(false)}>Cancel</Button>
                  <Button variant="primary" type="submit" form={`verify-answer-${message.id}`} isPending={busy} isDisabled={!summary.trim()}>
                    Save verification
                  </Button>
                </>
              ) : (
                <>
                  {canReview && saved.verification_status && (
                    <Button variant="secondary" isDisabled={busy} onPress={() => void persist(true)}>Clear verification</Button>
                  )}
                  {canReview && <Button variant="secondary" onPress={edit}>{saved.verification_status ? 'Edit verification' : 'Verify answer'}</Button>}
                  <Button variant="primary" isDisabled={busy} onPress={close}>Close</Button>
                </>
              )}
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </>
  );
}
