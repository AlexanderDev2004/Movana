import * as React from 'react'
import { Input } from '~/components/ui/input'

/** "50.000" -> "50000", "007" -> "7". Kembalikan '' bila kosong. */
export function toDigits(raw: string): string {
  return raw.replace(/[^\d]/g, '').replace(/^0+(?=\d)/, '')
}

/** "50000" -> "50.000", '' -> ''. Selalu aman dipanggil saat render. */
export function formatRibuan(raw: string): string {
  const digits = toDigits(raw)
  if (digits === '') return ''
  return Number(digits).toLocaleString('id-ID')
}

/**
 * Input Rupiah: tampil otomatis berformat ribuan (50.000),
 * tapi `onChange` selalu menerima digit murni ("50000").
 * Kursor dijaga di ujung (cocok untuk ketik angka dari kiri ke kanan).
 */
export function RpInput({
  value,
  onChange,
  className = '',
  ...props
}: {
  value: string
  onChange: (digits: string) => void
  className?: string
} & Omit<React.ComponentProps<'input'>, 'value' | 'onChange' | 'className'>) {
  const ref = React.useRef<HTMLInputElement>(null)

  return (
    <Input
      ref={ref}
      inputMode="numeric"
      autoComplete="off"
      value={formatRibuan(value)}
      onChange={(e) => {
        onChange(toDigits(e.target.value))
        requestAnimationFrame(() => {
          const el = ref.current
          if (el) el.setSelectionRange(el.value.length, el.value.length)
        })
      }}
      className={`text-right tabular-nums ${className}`}
      {...props}
    />
  )
}
