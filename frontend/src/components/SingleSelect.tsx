import { Label, ListBox, Select } from '@heroui/react';
type Option<T extends string> = {
    value: T;
    label: string;
};
type Props<T extends string> = {
    label: string;
    value: T;
    onChange(value: T): void;
    options: readonly Option<T>[];
    disabled?: boolean;
};
export function SingleSelect<T extends string>({ label, value, onChange, options, disabled }: Props<T>) {
    return <Select value={value} onChange={(next) => { if (typeof next === 'string')
        onChange(next as T); }} isDisabled={disabled} fullWidth variant="secondary">
    <Label>{label}</Label>
    <Select.Trigger><Select.Value /><Select.Indicator /></Select.Trigger>
    <Select.Popover>
      <ListBox>{options.map((option) => <ListBox.Item id={option.value} key={option.value} textValue={option.label}><Label>{option.label}</Label></ListBox.Item>)}</ListBox>
    </Select.Popover>
  </Select>;
}
