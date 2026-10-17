import { SingleSelect } from '../../components/SingleSelect';
import { FormField } from '../../auth/components/FormField';
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
  const rawSeries = values.series?.length
    ? values.series
    : [{ field: values.valueField, label: values.valueField }];
  const series = rawSeries.map((item) =>
    widgetType === 'combo'
      ? { ...item, type: item.type ?? 'bar', axis: item.axis ?? 'primary' }
      : item,
  );
  function updateSeries(index: number, changes: Partial<(typeof series)[number]>) {
    onChange(
      'series',
      series.map((item, i) => (i === index ? { ...item, ...changes } : item)),
    );
  }
  const unused = columns.find(
    (column) => column !== values.xField && !series.some((item) => item.field === column),
  );
  function changeSeries(index: number, field: string) {
    onChange(
      'series',
      series.map((item, i) => (i === index ? { ...item, field, label: field } : item)),
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
          {widgetType === 'combo' && (
            <>
              <SingleSelect
                label={`Series ${index + 1} type`}
                value={item.type ?? 'bar'}
                onChange={(value) =>
                  updateSeries(index, { type: value as 'bar' | 'line', axis: 'primary' })
                }
                options={[
                  { value: 'bar', label: 'Column' },
                  { value: 'line', label: 'Line' },
                ]}
              />
              <SingleSelect
                label={`Series ${index + 1} axis`}
                value={item.axis ?? 'primary'}
                onChange={(value) =>
                  updateSeries(index, { axis: value as 'primary' | 'secondary' })
                }
                options={
                  item.type === 'line'
                    ? [
                        { value: 'primary', label: 'Primary (shared scale)' },
                        { value: 'secondary', label: 'Secondary (right)' },
                      ]
                    : [{ value: 'primary', label: 'Primary (left)' }]
                }
              />
              <FormField
                label={`Series ${index + 1} label`}
                value={item.label ?? ''}
                onChange={(event) => updateSeries(index, { label: event.target.value })}
              />
              <FormField
                label={`Series ${index + 1} unit`}
                value={item.unit ?? ''}
                onChange={(event) => updateSeries(index, { unit: event.target.value })}
              />
            </>
          )}
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
          onClick={() =>
            onChange('series', [
              ...series,
              {
                field: unused,
                label: unused,
                ...(widgetType === 'combo' ? ({ type: 'bar', axis: 'primary' } as const) : {}),
              },
            ])
          }
        >
          Add series
        </button>
      ) : null}
      {widgetType === 'bar' || widgetType === 'combo' ? (
        <div className="form-grid-2">
          {widgetType === 'bar' && (
            <SingleSelect
              label="Orientation"
              value={values.orientation ?? 'vertical'}
              onChange={(value) => onChange('orientation', value as 'vertical' | 'horizontal')}
              options={[
                { value: 'vertical', label: 'Vertical columns' },
                { value: 'horizontal', label: 'Horizontal bars' },
              ]}
            />
          )}
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
      {widgetType === 'combo' && (
        <div className="form-grid-2">
          <FormField
            label="Primary y-axis title"
            value={values.yLabel ?? ''}
            onChange={(event) => onChange('yLabel', event.target.value)}
          />
          <FormField
            label="Secondary y-axis title"
            value={values.secondaryYLabel ?? ''}
            onChange={(event) => onChange('secondaryYLabel', event.target.value)}
          />
        </div>
      )}
    </div>
  );
}
