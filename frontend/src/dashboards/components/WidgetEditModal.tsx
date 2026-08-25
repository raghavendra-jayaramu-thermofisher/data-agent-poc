import { Button, Label, Modal, Switch } from '@heroui/react';
import { useMemo, useState } from 'react';
import { useExecutionTrace } from '../../agent/hooks/useExecutionTrace';
import { FormField } from '../../auth/components/FormField';
import { SingleSelect } from '../../components/SingleSelect';
import type { DashboardWidget, DashboardWidgetUpdate } from '../api/dashboard-api';
import { buildVisualizationConfig, findSaveSource, validateWidgetMapping, widgetValuesFromConfig } from '../lib/widget-config';
import type { SaveWidgetValues, WidgetType } from '../schemas/dashboard-schemas';
import { WidgetMappingFields } from './WidgetMappingFields';

export function WidgetEditModal({ widget, onSave }: { widget: DashboardWidget; onSave(body: DashboardWidgetUpdate): Promise<void> }) {
  const [open, setOpen] = useState(false);
  const initial = useMemo(() => widgetValuesFromConfig(widget), [widget]);
  const [title, setTitle] = useState(widget.title);
  const [enabled, setEnabled] = useState(widget.enabled);
  const [mapping, setMapping] = useState(initial);
  const [columns, setColumns] = useState(Number(widget.layout_config.columns ?? (widget.widget_type === 'metric' ? 3 : 6)));
  const [rows, setRows] = useState(Number(widget.layout_config.rows ?? (widget.widget_type === 'metric' ? 1 : 2)));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const trace = useExecutionTrace(widget.created_from_job_id, open);
  const source = widget.created_from_sql_execution_id ? findSaveSource(trace.data, null, widget.created_from_sql_execution_id) : null;
  const widgetType = mapping.widgetType as WidgetType;

  async function save() {
    setError(null);
    if (!title.trim()) { setError('Widget title is required.'); return; }
    if (widgetType !== 'table' && source) {
      const mappingError = validateWidgetMapping({ dashboardId: '', title, ...mapping }, source.columns);
      if (mappingError) { setError(mappingError); return; }
    }
    setSaving(true);
    try {
      const body: DashboardWidgetUpdate = { title: title.trim(), enabled, layout_config: { columns, rows } };
      if (widgetType === 'table' || source) body.visualization_config = buildVisualizationConfig(mapping);
      await onSave(body);
      setOpen(false);
    } catch (caught) { setError((caught as { message?: string }).message ?? 'Unable to update widget.'); }
    finally { setSaving(false); }
  }

  return <>
    <Button size="sm" variant="secondary" onPress={() => setOpen(true)}>Edit</Button>
    <Modal><Modal.Backdrop isOpen={open} onOpenChange={setOpen}><Modal.Container size="lg" scroll="inside"><Modal.Dialog>
      <Modal.CloseTrigger/>
      <Modal.Header><Modal.Heading>Edit widget</Modal.Heading></Modal.Header>
      <Modal.Body><div className="form-stack">
        <FormField label="Title" value={title} onChange={(event) => setTitle(event.target.value)}/>
        <Switch isSelected={enabled} onChange={setEnabled}><Switch.Control><Switch.Thumb /></Switch.Control><Switch.Content><Label>Enabled</Label></Switch.Content></Switch>
        {source ? <WidgetMappingFields widgetType={widgetType} columns={source.columns} values={mapping} onChange={(name, value) => setMapping((current) => ({ ...current, [name]: value }))}/> : widgetType !== 'table' ? <p className="muted-copy">Loading original result fields…</p> : null}
        <div className="form-grid-2">
          <SingleSelect label="Width" value={String(columns)} onChange={(value) => setColumns(Number(value))} options={[{ value: '3', label: 'Quarter' }, { value: '6', label: 'Half' }, { value: '12', label: 'Full width' }]}/>
          <SingleSelect label="Height" value={String(rows)} onChange={(value) => setRows(Number(value))} options={[{ value: '1', label: 'Compact' }, { value: '2', label: 'Standard' }, { value: '3', label: 'Tall' }]}/>
        </div>
        {error ? <div className="inline-error" role="alert">{error}</div> : null}
      </div></Modal.Body>
      <Modal.Footer><Button variant="secondary" onPress={() => setOpen(false)}>Cancel</Button><Button variant="primary" isPending={saving} onPress={() => void save()}>Save changes</Button></Modal.Footer>
    </Modal.Dialog></Modal.Container></Modal.Backdrop></Modal>
  </>;
}
