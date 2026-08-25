import type { Key } from '@heroui/react';
import { Button, ComboBox, Input, Label, ListBox } from '@heroui/react';
import type { DataSource } from '../../api/types';
import { StatusChip } from '../../components/StatusChip';

type Props = {
  dataSources: DataSource[];
  value: string[];
  onChange(value: string[]): void;
  error?: string;
  disabled?: boolean;
};

function displayType(value: string) {
  return value === 'postgres' ? 'PostgreSQL' : value === 'mysql' ? 'MySQL' : value === 'mssql' ? 'Microsoft SQL Server' : value === 'excel' ? 'Excel' : value;
}

export function DataSourceScopeSelector({ dataSources, value, onChange, error, disabled }: Props) {
  const selected = value.map((id) => dataSources.find((source) => source.id === id)).filter((source): source is DataSource => Boolean(source));
  const handleChange = (next: Key | Key[] | null) => {
    if (!Array.isArray(next)) return;
    const ids = next.map(String).slice(0, 10);
    onChange(ids);
  };
  return <div className="source-scope-field">
    <ComboBox
      selectionMode="multiple"
      value={value}
      onChange={handleChange}
      isDisabled={disabled}
      isInvalid={Boolean(error)}
      fullWidth
      variant="secondary"
      defaultFilter={(text, inputValue) => !inputValue || text.toLowerCase().includes(inputValue.toLowerCase())}
    >
      <Label>Data sources</Label>
      <ComboBox.InputGroup>
        <Input placeholder="Search data sources…" />
        <ComboBox.Trigger />
      </ComboBox.InputGroup>
      <ComboBox.Value placeholder="No data sources selected" />
      <ComboBox.Popover>
        <ListBox selectionMode="multiple">
          {dataSources.map((source) => <ListBox.Item key={source.id} id={source.id} textValue={`${source.name} ${displayType(source.display_type)} ${source.status}`}>
            <div className="source-option"><div><strong>{source.name}</strong><span>{displayType(source.display_type)}</span></div><StatusChip status={source.status}/><ListBox.ItemIndicator /></div>
          </ListBox.Item>)}
        </ListBox>
      </ComboBox.Popover>
    </ComboBox>
    <div className="source-scope-meta"><span>{value.length}/10 selected</span>{error ? <span className="field-error" role="alert">{error}</span> : null}</div>
    {selected.length ? <div className="selected-source-list" aria-label="Selected data sources">{selected.map((source) => <div className="selected-source-row" key={source.id}><div><strong>{source.name}</strong><span>{displayType(source.display_type)}</span></div><StatusChip status={source.status}/><Button size="sm" variant="ghost" onPress={() => onChange(value.filter((id) => id !== source.id))} aria-label={`Remove ${source.name}`}>Remove</Button></div>)}</div> : null}
  </div>;
}
