import { SingleSelect } from '../../components/SingleSelect';
import type { SaveWidgetValues, WidgetType } from '../schemas/dashboard-schemas';

export function WidgetMappingFields({ widgetType, columns, values, onChange }: {
  widgetType: WidgetType;
  columns: string[];
  values: Pick<SaveWidgetValues, 'metricField' | 'xField' | 'valueField' | 'categoryField'>;
  onChange(name: 'metricField' | 'xField' | 'valueField' | 'categoryField', value: string): void;
}) {
  const options = columns.map((column) => ({ value: column, label: column }));
  if (widgetType === 'table') return <p className="muted-copy">The table keeps the source result columns and rows.</p>;
  if (widgetType === 'metric') return <SingleSelect label="Metric field" value={values.metricField} onChange={(value) => onChange('metricField', value)} options={options}/>;
  if (widgetType === 'pie') return <div className="form-grid-2"><SingleSelect label="Category field" value={values.categoryField} onChange={(value) => onChange('categoryField', value)} options={options}/><SingleSelect label="Value field" value={values.valueField} onChange={(value) => onChange('valueField', value)} options={options}/></div>;
  return <div className="form-grid-2"><SingleSelect label="X-axis field" value={values.xField} onChange={(value) => onChange('xField', value)} options={options}/><SingleSelect label="Value field" value={values.valueField} onChange={(value) => onChange('valueField', value)} options={options}/></div>;
}
