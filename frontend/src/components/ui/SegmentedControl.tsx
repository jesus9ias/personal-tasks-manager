import * as ToggleGroup from '@radix-ui/react-toggle-group';

interface Option {
  value: string;
  label?: string;
  icon?: string;
}

interface SegmentedControlProps {
  value: string;
  onValueChange: (value: string) => void;
  options: Option[];
}

export function SegmentedControl({ value, onValueChange, options }: SegmentedControlProps) {
  return (
    <ToggleGroup.Root
      type="single"
      value={value}
      onValueChange={(v) => v && onValueChange(v)}
      className="mode-toggle"
    >
      {options.map((opt) => (
        <ToggleGroup.Item key={opt.value} value={opt.value} className="mode-btn">
          {opt.label && <span className="btn-label">{opt.label}</span>}
          {opt.icon && <span className="btn-icon">{opt.icon}</span>}
        </ToggleGroup.Item>
      ))}
    </ToggleGroup.Root>
  );
}
