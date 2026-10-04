import * as React from 'react'
import type { Atom } from '@tanstack/store'
import { useTable } from '@tanstack/react-table'
import type { ColumnDef, SortingState } from '@tanstack/react-table'
import { LuChevronDown, LuChevronRight, LuChevronUp, LuChevronsUpDown, LuPencil, LuPlus, LuTrash2 } from 'react-icons/lu'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import { Card, CardContent } from '~/components/ui/card'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import { ExpenseIcon } from '~/components/icons'
import { ExtraExpenseEditor } from '~/components/home/ExtraExpenseEditor'
import { formatRp } from '~/lib/calc'
import { normalizeExpenses, totalExtra } from '~/lib/extra-expense'
import type { ExtraExpense } from '~/lib/extra-expense'
import { expenseLabel } from '~/lib/extra-expense'
import { deleteLog, formatTanggalPendek, sumberLabel, updateLog } from '~/lib/history'
import type { LogPatch } from '~/lib/history'
import { movanaTableFeatures } from '~/lib/tables'
import type { MovanaTableFeatures } from '~/lib/tables'
import { bbmOf, bersihOf, extraOf, kmOf } from '~/lib/workspace'
import type { EntrySumber, LogEntry } from '~/lib/workspace'

/** Kolom rata kanan (angka). */
const RIGHT_ALIGN = new Set(['km', 'bbm', 'extra', 'kotor', 'bersih'])

function cellClass(columnId: string): string {
  if (RIGHT_ALIGN.has(columnId)) return 'px-2 py-1.5 text-right whitespace-nowrap tabular-nums'
  if (columnId === 'aksi') return 'px-2 py-1.5 text-right whitespace-nowrap'
  if (columnId === 'tanggal') return 'px-2 py-1.5 whitespace-nowrap font-medium'
  return 'px-2 py-1.5'
}

function makeHistoryColumns(
  onEdit: (tanggal: string) => void,
  onHapus: (tanggal: string) => void,
): ColumnDef<MovanaTableFeatures, LogEntry>[] {
  return [
    {
      accessorKey: 'tanggal',
      header: 'Tanggal',
      cell: (info) => formatTanggalPendek(info.getValue<string>()),
      sortFn: 'alphanumeric',
    },
    {
      accessorFn: (row) => kmOf(row),
      id: 'km',
      header: 'KM',
      cell: (info) => info.getValue<number>(),
      sortFn: 'alphanumeric',
    },
    {
      accessorFn: (row) => bbmOf(row),
      id: 'bbm',
      header: 'Biaya BBM',
      cell: (info) => formatRp(info.getValue<number>()),
      sortFn: 'alphanumeric',
    },
    {
      accessorFn: (row) => extraOf(row),
      id: 'extra',
      header: 'Extra',
      cell: (info) => {
        const extra = info.getValue<number>()
        if (extra <= 0) return <span className="text-muted-foreground">—</span>
        const row = info.row
        const expanded = row.getIsExpanded()
        return (
          <button
            onClick={row.getToggleExpandedHandler()}
            aria-expanded={expanded}
            className="inline-flex items-center gap-1 font-medium hover:underline tabular-nums"
            title="Lihat rincian"
          >
            {formatRp(extra)}{' '}
            {expanded ? (
              <LuChevronDown className="size-3.5" aria-hidden />
            ) : (
              <LuChevronRight className="size-3.5" aria-hidden />
            )}
          </button>
        )
      },
      sortFn: 'alphanumeric',
    },
    {
      accessorKey: 'kotor',
      header: 'Pendapatan',
      cell: (info) => formatRp(info.getValue<number>()),
      sortFn: 'alphanumeric',
    },
    {
      accessorFn: (row) => bersihOf(row),
      id: 'bersih',
      header: 'Bersih',
      cell: (info) => <span className="font-bold">{formatRp(info.getValue<number>())}</span>,
      sortFn: 'alphanumeric',
    },
    {
      accessorKey: 'sumber',
      header: 'Sumber',
      cell: (info) => {
        const sumber = info.getValue<EntrySumber>()
        return (
          <Badge variant={sumber === 'linimasa' ? 'default' : 'secondary'}>
            {sumberLabel({ sumber })}
          </Badge>
        )
      },
      enableSorting: false,
    },
    {
      id: 'aksi',
      header: 'Aksi',
      cell: ({ row }) => (
        <RowActions
          onEdit={() => onEdit(row.original.tanggal)}
          onHapus={() => onHapus(row.original.tanggal)}
        />
      ),
      enableSorting: false,
    },
  ]
}

/**
 * Grid riwayat headless (TanStack Table V9).
 * State tabel (sorting, expanded) didukung TanStack Store internal —
 * kecuali `sorting` yang dimiliki app lewat external atom (sinkron URL).
 * Render memakai elemen tabel semantik + gaya shadcn yang sudah ada.
 */
export function HistoryTable({
  data,
  wsId,
  sortingAtom,
  onDataChange,
}: {
  /** Log yang sudah difilter halaman (filter bukan fitur tabel). */
  data: LogEntry[]
  wsId: string
  /** Slice sorting milik app — satu-satunya external atom tabel ini. */
  sortingAtom: Atom<SortingState>
  onDataChange: () => void
}) {
  // Mode UI transien (bukan state tabel): tidak perlu atom/URL.
  const [editingTanggal, setEditingTanggal] = React.useState<string | null>(null)
  const [confirmHapus, setConfirmHapus] = React.useState<string | null>(null)

  const onEdit = React.useCallback((tanggal: string) => {
    setConfirmHapus(null)
    setEditingTanggal((cur) => (cur === tanggal ? null : tanggal))
  }, [])
  const onHapus = React.useCallback((tanggal: string) => {
    setEditingTanggal((cur) => (cur === tanggal ? null : cur))
    setConfirmHapus(tanggal)
  }, [])

  const columns = React.useMemo(() => makeHistoryColumns(onEdit, onHapus), [onEdit, onHapus])

  const table = useTable({
    key: 'riwayat',
    features: movanaTableFeatures,
    columns,
    data,
    getRowId: (row) => row.tanggal,
    // Data baru (refresh setelah simpan) tidak boleh menutup rincian terbuka.
    autoResetExpanded: false,
    atoms: {
      sorting: sortingAtom,
    },
  })

  const rows = table.getRowModel().rows
  const colCount = table.getAllLeafColumns().length

  const hapus = (tanggal: string) => {
    if (deleteLog(wsId, tanggal)) {
      setConfirmHapus(null)
      if (editingTanggal === tanggal) setEditingTanggal(null)
      onDataChange()
    }
  }

  const saveEdit = (tanggal: string, patch: LogPatch) => {
    if (updateLog(wsId, tanggal, patch)) {
      setEditingTanggal(null)
      onDataChange()
    }
  }

  return (
    <>
      <div className="hidden md:block overflow-x-auto rounded-xl border">
        <table className="w-full text-sm tabular-nums min-w-[680px]">
          <thead>
            <tr className="bg-muted text-xs text-muted-foreground">
              {table.getHeaderGroups().map((hg) =>
                hg.headers.map((header) => {
                  const canSort = header.column.getCanSort()
                  const sorted = header.column.getIsSorted()
                  return (
                    <th
                      key={header.id}
                      aria-sort={
                        sorted === 'asc'
                          ? 'ascending'
                          : sorted === 'desc'
                            ? 'descending'
                            : canSort
                              ? 'none'
                              : undefined
                      }
                      className={`px-2 py-2 font-medium ${RIGHT_ALIGN.has(header.column.id) || header.column.id === 'aksi' ? 'text-right' : 'text-left'}`}
                    >
                      {header.isPlaceholder ? null : canSort ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
                          onClick={header.column.getToggleSortingHandler()}
                          title={`Urutkan ${header.column.id}`}
                          aria-label={`Urutkan berdasarkan ${header.column.id}`}
                        >
                          <table.FlexRender header={header} />
                          {sorted === 'asc' ? (
                            <LuChevronUp className="size-3.5" aria-hidden />
                          ) : sorted === 'desc' ? (
                            <LuChevronDown className="size-3.5" aria-hidden />
                          ) : (
                            <LuChevronsUpDown className="size-3.5 opacity-40" aria-hidden />
                          )}
                        </Button>
                      ) : (
                        <table.FlexRender header={header} />
                      )}
                    </th>
                  )
                }),
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <React.Fragment key={row.id}>
                <tr className="border-t">
                  {row.getAllCells().map((cell) => (
                    <td key={cell.id} className={cellClass(cell.column.id)}>
                      <table.FlexRender cell={cell} />
                    </td>
                  ))}
                </tr>
                {row.getIsExpanded() && extraOf(row.original) > 0 && (
                  <tr className="bg-muted/40">
                    <td colSpan={colCount} className="px-2 py-1.5">
                      <ExtraDetail entry={row.original} />
                    </td>
                  </tr>
                )}
                {editingTanggal === row.original.tanggal && (
                  <tr className="bg-muted/40">
                    <td colSpan={colCount} className="px-2 py-2">
                      <EditForm
                        entry={row.original}
                        onCancel={() => setEditingTanggal(null)}
                        onSave={(patch) => saveEdit(row.original.tanggal, patch)}
                      />
                    </td>
                  </tr>
                )}
                {confirmHapus === row.original.tanggal && editingTanggal !== row.original.tanggal && (
                  <tr className="bg-destructive/5">
                    <td colSpan={colCount} className="px-2 py-2">
                      <ConfirmHapus
                        tanggal={row.original.tanggal}
                        onCancel={() => setConfirmHapus(null)}
                        onConfirm={() => hapus(row.original.tanggal)}
                      />
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="md:hidden space-y-2">
        {rows.map((row) => {
          const e = row.original
          const extra = extraOf(e)
          const expanded = row.getIsExpanded()
          return (
            <li key={row.id}>
              <Card className="py-3 gap-2">
                <CardContent className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-sm">{formatTanggalPendek(e.tanggal)}</span>
                    <Badge variant={e.sumber === 'linimasa' ? 'default' : 'secondary'}>
                      {sumberLabel(e)}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-2 rounded-lg bg-muted/60 p-2 text-center tabular-nums">
                    <div>
                      <div className="text-[11px] text-muted-foreground">KM</div>
                      <div className="font-bold text-sm">{kmOf(e)}</div>
                    </div>
                    <div>
                      <div className="text-[11px] text-muted-foreground">BBM</div>
                      <div className="font-bold text-sm">{formatRp(bbmOf(e))}</div>
                    </div>
                    <div>
                      <div className="text-[11px] text-muted-foreground">Pendapatan</div>
                      <div className="font-bold text-sm">{formatRp(e.kotor)}</div>
                    </div>
                    <div>
                      <div className="text-[11px] text-muted-foreground">Bersih</div>
                      <div className="font-bold text-sm">{formatRp(bersihOf(e))}</div>
                    </div>
                  </div>
                  <button
                    onClick={row.getToggleExpandedHandler()}
                    aria-expanded={expanded}
                    className="flex w-full items-center justify-between gap-2 rounded-lg border px-2 py-1.5 text-xs"
                  >
                    <span className="inline-flex items-center gap-1 text-muted-foreground">
                      <LuPlus className="size-3.5" aria-hidden /> Extra{' '}
                      {extra > 0 ? (
                        <b className="text-foreground tabular-nums">{formatRp(extra)}</b>
                      ) : (
                        '—'
                      )}
                    </span>
                    {extra > 0 && (
                      <span className="inline-flex items-center gap-0.5 text-muted-foreground">
                        {expanded ? (
                          <LuChevronDown className="size-3.5" aria-hidden />
                        ) : (
                          <LuChevronRight className="size-3.5" aria-hidden />
                        )}
                        {expanded ? 'tutup' : 'rincian'}
                      </span>
                    )}
                  </button>
                  {expanded && extra > 0 && <ExtraDetail entry={e} />}
                  {editingTanggal === e.tanggal ? (
                    <EditForm
                      entry={e}
                      onCancel={() => setEditingTanggal(null)}
                      onSave={(patch) => saveEdit(e.tanggal, patch)}
                    />
                  ) : confirmHapus === e.tanggal ? (
                    <ConfirmHapus
                      tanggal={e.tanggal}
                      onCancel={() => setConfirmHapus(null)}
                      onConfirm={() => hapus(e.tanggal)}
                    />
                  ) : (
                    <div className="flex gap-1.5">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => onEdit(e.tanggal)}
                      >
                        <LuPencil aria-hidden /> Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 text-destructive border-destructive/40 hover:text-destructive hover:bg-destructive/10"
                        onClick={() => onHapus(e.tanggal)}
                      >
                        <LuTrash2 aria-hidden /> Hapus
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </li>
          )
        })}
      </ul>
    </>
  )
}

function ExtraDetail({ entry }: { entry: LogEntry }) {
  const list = normalizeExpenses(entry.rincianBiaya ?? [])
  if (list.length === 0) return null
  return (
    <ul className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground tabular-nums">
      {list.map((e) => (
        <li key={e.id} className="inline-flex items-center gap-1">
          <ExpenseIcon kategori={e.kategori} className="size-3.5" />
          {expenseLabel(e.kategori)} {formatRp(e.jumlah)}
        </li>
      ))}
    </ul>
  )
}

function RowActions({ onEdit, onHapus }: { onEdit: () => void; onHapus: () => void }) {
  return (
    <div className="inline-flex gap-1">
      <Button variant="outline" size="sm" onClick={onEdit}>
        <LuPencil aria-hidden /> Edit
      </Button>
      <Button
        variant="outline"
        size="sm"
        className="text-destructive border-destructive/40 hover:text-destructive hover:bg-destructive/10"
        onClick={onHapus}
      >
        <LuTrash2 aria-hidden /> Hapus
      </Button>
    </div>
  )
}

function ConfirmHapus({
  tanggal,
  onCancel,
  onConfirm,
}: {
  tanggal: string
  onCancel: () => void
  onConfirm: () => void
}) {
  return (
    <div className="flex items-center gap-2 rounded-xl bg-destructive/10 border border-destructive/30 p-2">
      <span className="flex-1 text-xs">
        Hapus log <b>{formatTanggalPendek(tanggal)}</b>?
      </span>
      <Button variant="destructive" size="sm" onClick={onConfirm}>
        Ya, hapus
      </Button>
      <Button variant="outline" size="sm" onClick={onCancel}>
        Batal
      </Button>
    </div>
  )
}

function EditForm({
  entry,
  onSave,
  onCancel,
}: {
  entry: LogEntry
  onSave: (patch: LogPatch) => void
  onCancel: () => void
}) {
  const [km, setKm] = React.useState(String(kmOf(entry)))
  const [bbm, setBbm] = React.useState(String(bbmOf(entry)))
  const [kotor, setKotor] = React.useState(String(entry.kotor))
  const [extras, setExtras] = React.useState<ExtraExpense[]>(() =>
    normalizeExpenses(entry.rincianBiaya ?? []),
  )

  const simpan = () => {
    const norm = normalizeExpenses(extras).filter((e) => e.jumlah > 0)
    onSave({
      km: Math.max(0, Number(km) || 0),
      biayaBensin: Math.max(0, Math.round(Number(bbm) || 0)),
      kotor: Math.max(0, Math.round(Number(kotor) || 0)),
      rincianBiaya: norm.map((e) => ({ kategori: e.kategori, jumlah: e.jumlah })),
    })
  }

  const previewBersih =
    Math.round(Number(kotor) || 0) - Math.round(Number(bbm) || 0) - totalExtra(extras)

  return (
    <div className="rounded-xl bg-muted p-2.5 space-y-2">
      <p className="text-xs font-bold">Edit {formatTanggalPendek(entry.tanggal)}</p>
      <div className="grid grid-cols-3 gap-2">
        <div className="space-y-1">
          <Label className="text-[11px]">KM</Label>
          <Input inputMode="decimal" value={km} onChange={(e) => setKm(e.target.value)} className="h-10 tabular-nums" />
        </div>
        <div className="space-y-1">
          <Label className="text-[11px]">BBM (Rp)</Label>
          <Input inputMode="numeric" value={bbm} onChange={(e) => setBbm(e.target.value)} className="h-10 tabular-nums" />
        </div>
        <div className="space-y-1">
          <Label className="text-[11px]">Masuk (Rp)</Label>
          <Input
            inputMode="numeric"
            value={kotor}
            onChange={(e) => setKotor(e.target.value)}
            className="h-10 tabular-nums"
          />
        </div>
      </div>
      <div className="rounded-lg bg-background border p-2">
        <ExtraExpenseEditor tanggal={entry.tanggal} value={extras} onChange={setExtras} />
      </div>
      <p className="text-[11px] text-muted-foreground tabular-nums">
        Bersih baru: <b className="text-foreground">{formatRp(previewBersih)}</b> = Masuk − BBM − Extra
      </p>
      <div className="flex gap-1.5">
        <Button size="sm" onClick={simpan}>
          Simpan
        </Button>
        <Button size="sm" variant="outline" onClick={onCancel}>
          Batal
        </Button>
      </div>
    </div>
  )
}
