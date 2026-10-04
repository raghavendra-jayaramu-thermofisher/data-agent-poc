import { Link } from 'react-router';
import type { components } from '../../api/generated/schema';
import { notifications } from '../../components/notifications';

type Diagnostics = components['schemas']['ConnectionDiagnostics'];

export function ConnectionDiagnosticsPanel({ diagnostics, code, sourceId, canManage, testing, onTest }: {
  diagnostics?: Diagnostics | null;
  code: string | null;
  sourceId: string;
  canManage: boolean;
  testing: boolean;
  onTest(): void;
}) {
  if (!code && !diagnostics) return null;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(diagnostics ?? { code }, null, 2));
      notifications.success('Diagnostics copied');
    } catch {
      notifications.error('Unable to copy diagnostics. Copy the technical details manually.');
    }
  };
  return <section className="bg-[#FFFDFC] border border-[#E8B4B4] rounded-lg p-5 mb-6" aria-label="Connection diagnostics">
    <h2 className="text-sm font-semibold text-[#A84545]">Connection test failed</h2>
    <p className="text-sm mt-2">{diagnostics?.message ?? 'This test has no detailed diagnostics. Run Test Again to collect the failure details.'}</p>
    {diagnostics && <>
      <p className="text-xs text-[#625C64] mt-2">Stage: {diagnostics.stage}</p>
      <ul className="list-disc pl-5 text-xs my-3">{diagnostics.next_steps.map((step) => <li key={step}>{step}</li>)}</ul>
      <details className="text-xs my-3">
        <summary className="cursor-pointer font-semibold">Technical details</summary>
        <dl className="mt-2 space-y-1">
          <dt>Error code</dt><dd>{code}</dd>
          {diagnostics.sqlstate && <><dt>SQLSTATE</dt><dd>{diagnostics.sqlstate}</dd></>}
          {diagnostics.error_number != null && <><dt>Driver error number</dt><dd>{diagnostics.error_number}</dd></>}
        </dl>
        <pre className="whitespace-pre-wrap break-words mt-2 bg-[#FBFAF7] p-3 rounded">{diagnostics.driver_message}</pre>
      </details>
    </>}
    <div className="flex flex-wrap items-center gap-3 text-xs">
      {canManage && <>
        <Link to={`/data-sources/${sourceId}/edit`} className="text-[#4B123F] underline">Edit Connection</Link>
        <button type="button" onClick={onTest} disabled={testing} className="text-[#4B123F] underline disabled:opacity-50">Test Again</button>
      </>}
      {diagnostics?.job_id && <Link to={`/jobs/${diagnostics.job_id}`} className="text-[#4B123F] underline">View Test Job</Link>}
      <button type="button" onClick={() => void copy()} className="text-[#4B123F] underline">Copy Diagnostics</button>
    </div>
  </section>;
}
