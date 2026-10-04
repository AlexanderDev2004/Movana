import * as React from 'react'
import { LuPencil, LuPlus, LuTrash2 } from 'react-icons/lu'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import { ExpenseIcon } from '~/components/icons'
import { RpInput } from './RpInput'
import {
  EXPENSE_CATEGORIES,
  createExpense,
  expenseLabel,
  totalExtra,
} from '~/lib/extra-expense'
import type { ExtraExpense } from '~/lib/extra-expense'
import { formatRp } from '~/lib/calc'

/**
 * Editor pengeluaran tambahan satu hari.
 * Alur cepat: ketuk chip kategori → item langsung dibuat + fokus ke nominal.
 * Dipakai di baris expand / mode Detail agar tampilan Ringkas tetap bersih.
 */
export function ExtraExpenseEditor({
  tanggal,
  value,
  onChange,
}: {
  tanggal: string
  value: ExtraExpense[]
  onChange: (next: ExtraExpense[]) => void
}) {
  const [editingId, setEditingId] = React.useState<string | null>(null)
  const [customFor, setCustomFor] = React.useState<string | null>(null)
  const [customText, setCustomText] = React.useState('')

  const add = (kategori: string) => {
    if (value.length >= 20) return
    const item = createExpense(kategori, 0)
    onChange([...value, item])
    setEditingId(item.id)
    if (kategori === 'lainnya') {
      setCustomFor(item.id)
      setCustomText('')
    }
  }

  const setJumlah = (id: string, digits: string) => {
    const jumlah = Math.max(0, Math.round(Number(digits) || 0))
    onChange(value.map((e) => (e.id === id ? { ...e, jumlah } : e)))
  }

  const setKategori = (id: string, kategori: string) => {
    const k = kategori.trim().toLowerCase() || 'lainnya'
    onChange(value.map((e) => (e.id === id ? { ...e, kategori: k } : e)))
    if (k !== 'lainnya' && customFor === id) setCustomFor(null)
  }

  const remove = (id: string) => {
    onChange(value.filter((e) => e.id !== id))
    if (editingId === id) setEditingId(null)
    if (customFor === id) setCustomFor(null)
  }

  const commitCustom = (id: string) => {
    const t = customText.trim().toLowerCase()
    if (t) setKategori(id, t)
    setCustomFor(null)
  }

  const total = totalExtra(value)

  return (
    <div className="space-y-1.5">
      {value.length > 0 && (
        <ul className="space-y-1">
          {value.map((e) => {
            const isEditing = editingId === e.id
            const isCustom = customFor === e.id
            return (
              <li
                key={e.id}
                className="flex items-center gap-1.5 rounded-lg bg-background border px-1.5 py-1"
              >
                <ExpenseIcon kategori={e.kategori} className="size-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  {isCustom ? (
                    <div className="flex items-center gap-1">
                      <Input
                        autoFocus
                        value={customText}
                        onChange={(ev) => setCustomText(ev.target.value)}
                        onKeyDown={(ev) => {
                          if (ev.key === 'Enter') commitCustom(e.id)
                          if (ev.key === 'Escape') setCustomFor(null)
                        }}
                        onBlur={() => {
                          if (customText.trim()) commitCustom(e.id)
                          else setCustomFor(null)
                        }}
                        placeholder="Nama pengeluaran…"
                        className="h-7 text-xs"
                        aria-label={`Nama pengeluaran ${tanggal}`}
                      />
                    </div>
                  ) : (
                    <button
                      className="block max-w-full truncate text-left text-xs font-medium hover:underline"
                      title="Ubah kategori"
                      onClick={() => {
                        // Siklus cepat ganti kategori via prompt bawaan? Tidak —
                        // pakai select kecil di mode edit.
                        setEditingId(isEditing ? null : e.id)
                      }}
                    >
                      {expenseLabel(e.kategori)}
                    </button>
                  )}
                  {isEditing || e.jumlah === 0 ? (
                    <div className="mt-1 flex items-center gap-1">
                      <RpInput
                        autoFocus={e.jumlah === 0}
                        value={e.jumlah === 0 ? '' : String(e.jumlah)}
                        onChange={(d) => setJumlah(e.id, d)}
                        onBlur={() => setEditingId(null)}
                        onKeyDown={(ev) => {
                          if (ev.key === 'Enter') (ev.target as HTMLInputElement).blur()
                          if (ev.key === 'Escape') setEditingId(null)
                        }}
                        placeholder="0"
                        className="h-7 text-xs"
                        aria-label={`Nominal ${expenseLabel(e.kategori)} ${tanggal}`}
                      />
                      <select
                        className="border-input rounded-md border bg-transparent text-xs h-7 max-w-[110px]"
                        value={EXPENSE_CATEGORIES.some((c) => c.id === e.kategori) ? e.kategori : 'lainnya'}
                        onChange={(ev) => {
                          const v = ev.target.value
                          if (v === 'lainnya' && !EXPENSE_CATEGORIES.some((c) => c.id === e.kategori)) {
                            setCustomFor(e.id)
                            setCustomText(e.kategori === 'lainnya' ? '' : e.kategori)
                          } else {
                            setKategori(e.id, v)
                            if (v === 'lainnya') {
                              setCustomFor(e.id)
                              setCustomText('')
                            }
                          }
                        }}
                        aria-label={`Kategori pengeluaran ${tanggal}`}
                      >
                        {EXPENSE_CATEGORIES.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.label}
                          </option>
                        ))}
                        {!EXPENSE_CATEGORIES.some((c) => c.id === e.kategori) && (
                          <option value="lainnya">{expenseLabel(e.kategori)} (custom)</option>
                        )}
                      </select>
                    </div>
                  ) : (
                    <div className="text-xs tabular-nums text-muted-foreground">
                      {formatRp(e.jumlah)}
                    </div>
                  )}
                </div>
                {!isEditing && e.jumlah !== 0 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0 text-muted-foreground"
                    onClick={() => setEditingId(e.id)}
                    title="Edit nominal"
                    aria-label={`Edit pengeluaran ${expenseLabel(e.kategori)} ${tanggal}`}
                  >
                    <LuPencil className="size-3.5" aria-hidden />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                  onClick={() => remove(e.id)}
                  title="Hapus"
                  aria-label={`Hapus pengeluaran ${expenseLabel(e.kategori)} ${tanggal}`}
                >
                  <LuTrash2 className="size-3.5" aria-hidden />
                </Button>
              </li>
            )
          })}
        </ul>
      )}

      <div>
        <Label className="text-[11px] text-muted-foreground flex items-center gap-1">
          <LuPlus className="size-3" aria-hidden /> Tambah pengeluaran
        </Label>
        <div className="mt-1 flex flex-wrap gap-1">
          {EXPENSE_CATEGORIES.map((c) => (
            <Button
              key={c.id}
              size="sm"
              variant="outline"
              className="h-7 text-xs px-2"
              onClick={() => add(c.id)}
              title={`Tambah ${c.label}`}
            >
              <ExpenseIcon kategori={c.id} className="size-3.5" /> {c.label}
            </Button>
          ))}
        </div>
      </div>

      {value.length > 0 && (
        <p className="text-xs tabular-nums text-muted-foreground">
          Total extra: <b className="text-foreground">{formatRp(total)}</b> • Bersih = Pendapatan − BBM −{' '}
          {formatRp(total)}
        </p>
      )}
    </div>
  )
}

/** Badge total untuk mode Ringkas: "Rp 35.000" atau "—" bila kosong. */
export function ExtraTotalBadge({ value }: { value: ExtraExpense[] }) {
  const total = totalExtra(value)
  if (total <= 0) return <span className="text-muted-foreground text-xs">—</span>
  return (
    <span className="inline-flex items-center gap-1 text-xs tabular-nums font-medium" title={value.map((e) => `${expenseLabel(e.kategori)} ${formatRp(e.jumlah)}`).join(', ')}>
      <LuPlus className="size-3" aria-hidden /> {formatRp(total)}
    </span>
  )
}
