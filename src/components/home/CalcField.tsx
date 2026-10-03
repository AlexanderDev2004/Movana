import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'

export function CalcField({
  label,
  value,
  onChange,
  inputMode = 'numeric',
  placeholder,
  suffix,
  hint,
  className = '',
}: {
  label: string
  value: string
  onChange: (v: string) => void
  inputMode?: 'numeric' | 'decimal'
  placeholder?: string
  suffix?: string
  hint?: string
  className?: string
}) {
  return (
    <div className={`space-y-1.5 ${className}`}>
      <div className="flex items-baseline justify-between gap-2">
        <Label>{label}</Label>
        {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
      </div>
      <div className="relative">
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          inputMode={inputMode}
          autoComplete="off"
          placeholder={placeholder}
          className="h-12 text-lg tabular-nums pr-12"
        />
        {suffix && (
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
            {suffix}
          </span>
        )}
      </div>
    </div>
  )
}
