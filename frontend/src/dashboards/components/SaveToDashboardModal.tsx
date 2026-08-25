import { Button, Modal } from '@heroui/react';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { useExecutionTrace } from '../../agent/hooks/useExecutionTrace';
import { queryKeys } from '../../api/queryKeys';
import { FormField } from '../../auth/components/FormField';
import { notifications } from '../../components/notifications';
import { SingleSelect } from '../../components/SingleSelect';
import { useOrganization } from '../../organizations/OrganizationProvider';
import { addWidget, createDashboard } from '../api/dashboard-api';
import { buildWidgetCreate, findSaveSource, validateWidgetMapping } from '../lib/widget-config';
import type { SaveWidgetValues, WidgetType } from '../schemas/dashboard-schemas';
import { WidgetMappingFields } from './WidgetMappingFields';
import { useDashboards } from '../hooks/useDashboards';

const widgetOptions = [
  { value: 'metric', label: 'Metric' }, { value: 'table', label: 'Table' }, { value: 'bar', label: 'Bar chart' },
  { value: 'line', label: 'Line chart' }, { value: 'area', label: 'Area chart' }, { value: 'pie', label: 'Pie chart' },
];

export function SaveToDashboardModal() {
  const [params, setParams] = useSearchParams();
  const sourceJobId = params.get('sourceJobId');
  const sourceSqlExecutionId = params.get('sourceSqlExecutionId');
  const artifactId = params.get('artifactId');
  const open = Boolean(sourceJobId && sourceSqlExecutionId);
  const trace = useExecutionTrace(sourceJobId, open);
  const dashboards = useDashboards();
  const qc = useQueryClient();
  const { activeOrganization } = useOrganization();
  const orgId = activeOrganization?.id ?? null;
  const navigate = useNavigate();
  const source = useMemo(() => sourceSqlExecutionId ? findSaveSource(trace.data, artifactId, sourceSqlExecutionId) : null, [artifactId, sourceSqlExecutionId, trace.data]);
  const [values, setValues] = useState<SaveWidgetValues>({ dashboardId: '', widgetType: 'table', title: '', metricField: '', xField: '', valueField: '', categoryField: '' });
  const [newDashboardTitle, setNewDashboardTitle] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!source) return;
    setValues((current) => ({ ...current, widgetType: source.defaultWidgetType, ...source.defaults }));
  }, [source]);
  useEffect(() => {
    if (!values.dashboardId && dashboards.data) setValues((current) => ({ ...current, dashboardId: dashboards.data!.length ? dashboards.data![0]!.id : '__new__' }));
  }, [dashboards.data, values.dashboardId]);

  function close() {
    const next = new URLSearchParams(params);
    next.delete('sourceJobId'); next.delete('sourceSqlExecutionId'); next.delete('artifactId');
    setParams(next, { replace: true });
    setError(null);
  }
  async function save() {
    if (!sourceJobId || !sourceSqlExecutionId || !source) return;
    setError(null);
    const mappingError = validateWidgetMapping(values, source.columns);
    if (mappingError) { setError(mappingError); return; }
    if ((!values.dashboardId || values.dashboardId === '__new__') && !newDashboardTitle.trim()) { setError('Choose a dashboard or enter a new dashboard title.'); return; }
    setSaving(true);
    try {
      let dashboardId = values.dashboardId === '__new__' ? '' : values.dashboardId;
      if (!dashboardId) {
        const created = await createDashboard({ title: newDashboardTitle.trim() });
        dashboardId = created.id;
      }
      await addWidget(dashboardId, buildWidgetCreate(values, sourceJobId, sourceSqlExecutionId));
      await qc.invalidateQueries({ queryKey: queryKeys.dashboards.all(orgId) });
      notifications.success('Saved to dashboard');
      close();
      navigate(`/dashboards/${dashboardId}`);
    } catch (caught) {
      setError((caught as { message?: string }).message ?? 'Unable to save the widget.');
    } finally { setSaving(false); }
  }

  return <Modal>
    <Modal.Backdrop isOpen={open} onOpenChange={(isOpen) => { if (!isOpen) close(); }}>
      <Modal.Container size="lg" scroll="inside"><Modal.Dialog>
        <Modal.CloseTrigger/>
        <Modal.Header><Modal.Heading>Save analysis to dashboard</Modal.Heading></Modal.Header>
        <Modal.Body>
          {trace.isLoading ? <p className="muted-copy">Loading persisted source data…</p> : trace.isError ? <div className="inline-error">The analysis source could not be loaded.</div> : source ? <div className="form-stack">
            <p className="muted-copy">Widgets stay linked to the successful job and SQL execution. Leave the title blank to let the backend use the originating question.</p>
            <SingleSelect label="Dashboard" value={values.dashboardId} onChange={(value) => setValues((current) => ({ ...current, dashboardId: value }))} options={[{ value: '__new__', label: 'Create a new dashboard' }, ...(dashboards.data ?? []).map((dashboard) => ({ value: dashboard.id, label: dashboard.title }))]}/>
            {values.dashboardId === '__new__' ? <FormField label="New dashboard title" value={newDashboardTitle} onChange={(event) => setNewDashboardTitle(event.target.value)}/> : null}
            <SingleSelect label="Widget type" value={values.widgetType} onChange={(value) => setValues((current) => ({ ...current, widgetType: value as WidgetType }))} options={widgetOptions}/>
            <FormField label="Widget title (optional)" value={values.title} onChange={(event) => setValues((current) => ({ ...current, title: event.target.value }))}/>
            <WidgetMappingFields widgetType={values.widgetType} columns={source.columns} values={values} onChange={(name, value) => setValues((current) => ({ ...current, [name]: value }))}/>
            <div className="save-source-summary"><span>{source.columns.length} source columns</span><code>{sourceSqlExecutionId}</code></div>
            {error ? <div className="inline-error" role="alert">{error}</div> : null}
          </div> : <div className="inline-error">A persisted table result for this SQL execution is required before it can become a dashboard widget.</div>}
        </Modal.Body>
        <Modal.Footer><Button variant="secondary" onPress={close}>Cancel</Button><Button variant="primary" isPending={saving} isDisabled={!source} onPress={() => void save()}>Save widget</Button></Modal.Footer>
      </Modal.Dialog></Modal.Container>
    </Modal.Backdrop>
  </Modal>;
}
