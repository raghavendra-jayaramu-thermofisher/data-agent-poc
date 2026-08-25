import { Button } from '@heroui/react';
import { Link } from 'react-router';
import { notifications } from '../../components/notifications';
import { formatLocalDateTime } from '../../lib/datetime';
import type { DashboardWidget } from '../api/dashboard-api';

export function WidgetProvenance({ widget, dataSourceName }: { widget: DashboardWidget; dataSourceName: string }) {
  async function copySql() {
    try { await navigator.clipboard.writeText(widget.sql_text); notifications.success('Copied SQL'); }
    catch { notifications.error('Unable to copy SQL'); }
  }
  return <details className="widget-provenance">
    <summary>View source</summary>
    <div className="provenance-grid">
      <div><span>Question</span><strong>{widget.question ?? 'Not available'}</strong></div>
      <div><span>Data source</span><strong>{dataSourceName}</strong></div>
      <div><span>Last refreshed</span><strong>{widget.last_refreshed_at ? formatLocalDateTime(widget.last_refreshed_at) : 'Original analysis'}</strong></div>
      <div><span>Originating job</span><strong>{widget.created_from_job_id ? <Link to={`/jobs/${widget.created_from_job_id}`}>View job</Link> : 'Not available'}</strong></div>
      <div><span>SQL execution</span><strong>{widget.created_from_sql_execution_id ?? 'Not available'}</strong></div>
    </div>
    <div className="provenance-sql-header"><strong>Saved SQL</strong><Button size="sm" variant="secondary" onPress={() => void copySql()}>Copy SQL</Button></div>
    <pre className="sql-block">{widget.sql_text}</pre>
  </details>;
}
