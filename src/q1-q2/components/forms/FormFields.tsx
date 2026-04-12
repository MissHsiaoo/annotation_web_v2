import { Checkbox } from '../../../components/ui/checkbox';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { RadioGroup, RadioGroupItem } from '../../../components/ui/radio-group';
import { Textarea } from '../../../components/ui/textarea';
import { TranslatedText } from '../display/TranslatedText';

interface RadioOption {
  value: string;
  label: string;
  description?: string;
}

interface RadioFieldProps {
  label: string;
  value: string;
  options: RadioOption[];
  onChange: (value: string) => void;
}

export function RadioField({ label, value, options, onChange }: RadioFieldProps) {
  return (
    <div className="space-y-3 rounded-2xl border border-slate-200/80 bg-slate-50/80 p-5 shadow-sm ring-1 ring-slate-200/20">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <RadioGroup value={value} onValueChange={onChange} className="grid gap-2 sm:grid-cols-2">
        {options.map((option) => (
          <Label
            key={option.value}
            className={`items-start gap-3 rounded-xl border px-3 py-3 transition-all ${
              value === option.value
                ? 'border-sky-300 bg-sky-50 shadow-sm ring-1 ring-sky-100'
                : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
            }`}
          >
            <RadioGroupItem value={option.value} className="mt-0.5" />
            <div className="space-y-1">
              <span className="text-sm font-medium text-slate-900">{option.label}</span>
              {option.description ? (
                <p className="text-xs leading-5 text-slate-500">{option.description}</p>
              ) : null}
            </div>
          </Label>
        ))}
      </RadioGroup>
    </div>
  );
}

interface CheckboxFieldProps {
  label: string;
  values: string[];
  options: RadioOption[];
  onChange: (nextValues: string[]) => void;
}

export function CheckboxField({ label, values, options, onChange }: CheckboxFieldProps) {
  const toggleValue = (optionValue: string, checked: boolean) => {
    const next = checked ? [...values, optionValue] : values.filter((value) => value !== optionValue);
    onChange(next);
  };

  return (
    <div className="space-y-3 rounded-2xl border border-slate-200/80 bg-slate-50/80 p-5 shadow-sm ring-1 ring-slate-200/20">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <div className="grid gap-2 sm:grid-cols-2">
        {options.map((option) => {
          const isChecked = values.includes(option.value);
          return (
            <Label
              key={option.value}
              className={`items-start gap-3 rounded-xl border px-3 py-3 transition-all ${
                isChecked
                  ? 'border-sky-300 bg-sky-50 shadow-sm ring-1 ring-sky-100'
                  : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
              }`}
            >
              <Checkbox
                checked={isChecked}
                onCheckedChange={(checked) => toggleValue(option.value, checked === true)}
                className="mt-0.5"
              />
              <div className="space-y-1">
                <span className="text-sm font-medium text-slate-900">{option.label}</span>
                {option.description ? (
                  <p className="text-xs leading-5 text-slate-500">{option.description}</p>
                ) : null}
              </div>
            </Label>
          );
        })}
      </div>
    </div>
  );
}

interface TextAreaFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  translationEnabled?: boolean;
  translationSourceText?: string;
}

export function TextAreaField({
  label,
  value,
  onChange,
  placeholder,
  translationEnabled = false,
  translationSourceText,
}: TextAreaFieldProps) {
  return (
    <div className="space-y-2.5 rounded-2xl border border-slate-200/80 bg-slate-50/80 p-5 shadow-sm ring-1 ring-slate-200/20">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <Textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="min-h-24 rounded-xl border-slate-300 bg-white select-text"
      />
      {translationEnabled && (translationSourceText ?? value).trim() ? (
        <TranslatedText text={translationSourceText ?? value} translationEnabled hideOriginal />
      ) : null}
    </div>
  );
}

interface NumberFieldProps {
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
  min?: number;
  max?: number;
}

export function NumberField({ label, value, onChange, min = 0, max = 100 }: NumberFieldProps) {
  return (
    <div className="space-y-2.5 rounded-2xl border border-slate-200/80 bg-slate-50/80 p-5 shadow-sm ring-1 ring-slate-200/20">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <Input
        type="number"
        min={min}
        max={max}
        value={value ?? ''}
        onChange={(event) => {
          const raw = event.target.value.trim();
          if (!raw) {
            onChange(null);
            return;
          }

          const parsed = Number.parseInt(raw, 10);
          if (Number.isNaN(parsed)) {
            onChange(null);
            return;
          }

          onChange(Math.min(max, Math.max(min, parsed)));
        }}
        placeholder={`${min}-${max}`}
        className="h-11 rounded-xl border-slate-300 bg-white"
      />
    </div>
  );
}
