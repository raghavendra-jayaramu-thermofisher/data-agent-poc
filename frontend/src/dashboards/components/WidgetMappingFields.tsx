import { SingleSelect } from '../../components/SingleSelect';
import type { WidgetMappingValues, WidgetType } from '../schemas/dashboard-schemas';

export function WidgetMappingFields({
  widgetType,
  columns,
  values,
  onChange,
}: {
  widgetType: WidgetType;
  columns: string[];
  values: WidgetMappingValues;
  onChange<K extends keyof WidgetMappingValues>(name: K, value: WidgetMappingValues[K]): void;
}) {
  const options = columns.map((column) => ({ value: column, label: column }));
  if (widgetType === 'table')
    return <p className="muted-copy">The table keeps the source result columns and rows.</p>;
  if (widgetType === 'metric')
    return (
      <SingleSelect
        label="Metric field"
        value={values.metricField}
        onChange={(value) => onChange('metricField', value)}
        options={options}
      />
    );
  if (widgetType === 'pie' || widgetType === 'donut')
    return (
      <div className="form-grid-2">
        <SingleSelect
          label="Category field"
          value={values.categoryField}
          onChange={(value) => onChange('categoryField', value)}
          options={options}
        />
        <SingleSelect
          label="Value field"
          value={values.valueField}
          onChange={(value) => onChange('valueField', value)}
          options={options}
        />
      </div>
    );
  const series = values.series?.length
    ? values.series
    : [{ field: values.valueField, label: values.valueField }];
  const unused = columns.find(
    (column) => column !== values.xField && !series.some((item) => item.field === column),
  );
  function changeSeries(index: number, field: string) {
    onChange(
      'series',
      series.map((item, i) => (i === index ? { field, label: field } : item)),
    );
    if (index === 0) onChange('valueField', field);
  }
  return (
    <div className="form-stack">
      <SingleSelect
        label="Category field"
        value={values.xField}
        onChange={(value) => onChange('xField', value)}
        options={options}
      />
      {series.map((item, index) => (
        <div className="form-grid-2" key={index}>
          <SingleSelect
            label={index === 0 ? 'Value field' : `Value field ${index + 1}`}
            value={item.field}
            onChange={(value) => changeSeries(index, value)}
            options={options}
          />
          {index > 0 ? (
            <button
              type="button"
              onClick={() =>
                onChange(
                  'series',
                  series.filter((_, i) => i !== index),
                )
              }
            >
              Remove series
            </button>
          ) : null}
        </div>
      ))}
      {series.length < 8 && unused ? (
        <button
          type="button"
          onClick={() => onChange('series', [...series, { field: unused, label: unused }])}
        >
          Add series
        </button>
      ) : null}
      {widgetType === 'bar' ? (
        <div className="form-grid-2">
          <SingleSelect
            label="Orientation"
            value={values.orientation ?? 'vertical'}
            onChange={(value) => onChange('orientation', value as 'vertical' | 'horizontal')}
            options={[
              { value: 'vertical', label: 'Vertical columns' },
              { value: 'horizontal', label: 'Horizontal bars' },
            ]}
          />
          <SingleSelect
            label="Series layout"
            value={values.stacked ? 'stacked' : 'grouped'}
            onChange={(value) => onChange('stacked', value === 'stacked')}
            options={[
              { value: 'grouped', label: 'Grouped' },
              { value: 'stacked', label: 'Stacked' },
            ]}
          />
        </div>
      ) : null}
    </div>
  );
}
