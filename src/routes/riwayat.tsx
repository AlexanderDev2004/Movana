import { Link, createFileRoute } from '@tanstack/react-router'
import * as React from 'react'
import { Pencil, Trash2 } from 'lucide-react'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import { Card, CardContent } from '~/components/ui/card'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import { formatRp } from '~/lib/calc'
import {
  deleteLog,
  filterLogs,
  formatTanggalPendek,
  loadLogs,
  sumberLabel,
  summarize,
  updateLog,
} from '~/lib/history'
import type { Rentang } from '~/lib/history'
import { bbmOf, bersihOf, kmOf, tracksIncome } from '~/lib/workspace'
import type { LogEntry } from '~/lib/workspace'
import { useWorkspaces } from '~/lib/workspace'

export const Route = createFileRoute('/riwayat')({
  component: RiwayatPage,
})

const RENTANG_LABEL: { id: Rentang; label: string }[] = [
  { id: 'minggu', label: 'Minggu ini' },
  { id: 'bulan', label: 'Bulan ini' },
  { id: 'semua', label: 'Semua' },
  { id: 'custom', label: 'Custom' },
]

function RiwayatPage() {
  const { workspaces, active, ready, setActiveId } = useWorkspaces()
  const [logs, setLogs] = React.useState<LogEntry[]>([])
  const [rentang, setRentang] = React.useState<Rentang>('semua')
  const [dari, setDari] = React.useState('')
  const [sampai, setSampai] = React.useState('')
  const [hanyaPendapatan, setHanyaPendapatan] = React.useState(false)
  const [editingTanggal, setEditingTanggal] = React.useState<string | null>(null)
  const [confirmHapus, setConfirmHapus] = React.useState<string | null>(null)

  const wsId = active?.id ?? null

  const refresh = React.useCallback(() => {
    setLogs(loadLogs(wsId))
  }, [wsId])

  React.useEffect(() => {
    refresh()
  }, [refresh])

  React.useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key?.startsWith('movana:log-harian')) refresh()
    }
    window.addEventListener('storage', onStorage)
    window.addEventListener('focus', refresh)
    return () => {
      window.removeEventListener('storage', onStorage)
      window.removeEventListener('focus', refresh)
    }
  }, [refresh])

  const filtered = React.useMemo(
    () => filterLogs(logs, { rentang, dari, sampai, hanyaPendapatan }),
    [logs, rentang, dari, sampai, hanyaPendapatan],
  )
  const summary = React.useMemo(() => summarize(filtered), [filtered])
  const withIncome = tracksIncome(active)

  if (!ready) {
    return <div className="max-w-2xl mx-auto p-4 text-sm text-muted-foreground">Memuat...</div>
  }

  if (workspaces.length === 0 || !active) {
    return (
      <div className="max-w-2xl mx-auto p-4 space-y-4">
        <h1 className="text-xl font-bold">Riwayat</h1>
        <Card className="border-dashed py-6">
          <CardContent className="text-center space-y-2">
            <p className="font-bold">Belum ada workspace</p>
            <p className="text-sm text-muted-foreground">
              Buat workspace dulu sebelum melihat riwayat log harian.
            </p>
            <Button asChild>
              <Link to="/">Buat workspace</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const resetFilter = () => {
    setRentang('semua')
    setDari('')
    setSampai('')
    setHanyaPendapatan(false)
  }

  const hapus = (tanggal: string) => {
    if (wsId && deleteLog(wsId, tanggal)) {
      setConfirmHapus(null)
      if (editingTanggal === tanggal) setEditingTanggal(null)
      refresh()
    }
  }

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-4">
      <header className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-xl font-bold">Riwayat</h1>
          <Badge variant="secondary">{filtered.length} hari tampil</Badge>
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor="riwayat-ws" className="text-xs text-muted-foreground shrink-0">
            Workspace
          </Label>
          <select
            id="riwayat-ws"
            className="border-input rounded-md border bg-transparent px-2 py-2 text-sm flex-1 min-w-0"
            value={active.id}
            onChange={(e) => {
              setActiveId(e.target.value)
            }}
            title="Workspace aktif"
          >
            {workspaces.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Rentang tanggal">
          {RENTANG_LABEL.map((r) => (
            <Button
              key={r.id}
              size="sm"
              variant={rentang === r.id ? 'default' : 'outline'}
              onClick={() => setRentang(r.id)}
              role="tab"
              aria-selected={rentang === r.id}
            >
              {r.label}
            </Button>
          ))}
        </div>
        {rentang === 'custom' && (
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label htmlFor="riwayat-dari" className="text-xs">
                Dari
              </Label>
              <Input id="riwayat-dari" type="date" value={dari} onChange={(e) => setDari(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="riwayat-sampai" className="text-xs">
                Sampai
              </Label>
              <Input
                id="riwayat-sampai"
                type="date"
                value={sampai}
                onChange={(e) => setSampai(e.target.value)}
              />
            </div>
          </div>
        )}
        <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
          <input
            type="checkbox"
            checked={hanyaPendapatan}
            onChange={(e) => setHanyaPendapatan(e.target.checked)}
            className="size-4"
          />
          Hanya yang punya pendapatan
        </label>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <SummaryCard label={withIncome ? 'Total Bersih' : 'Total Keluar'} value={formatRp(summary.totalBersih)} highlight />
        <SummaryCard label="Total KM" value={`${summary.totalKm} km`} />
        <SummaryCard label="Total BBM" value={formatRp(summary.totalBbm)} />
        <SummaryCard label="Jumlah Hari" value={`${summary.jumlahHari} hari`} />
      </div>

      {logs.length === 0 ? (
        <Card className="border-dashed py-6">
          <CardContent className="text-center space-y-2">
            <p className="font-bold">Belum ada catatan.</p>
            <p className="text-sm text-muted-foreground">
              Import Timeline atau isi lewat Odo manual dulu.
            </p>
            <div className="flex gap-2 justify-center pt-1">
              <Button asChild>
                <Link to="/">Isi Odo manual</Link>
              </Button>
              <Button asChild variant="outline">
                <Link to="/">Import Timeline</Link>
              </Button>
            </div>
            <p className="text-xs text-muted-foreground pt-1">
              Buka workspace “{active.name}”, pilih tab Odo manual / Import Timeline, lalu Simpan.
            </p>
          </CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <Card className="border-dashed py-6">
          <CardContent className="text-center space-y-2">
            <p className="text-sm text-muted-foreground">
              Tidak ada hari cocok dengan filter. Ubah rentang atau matikan toggle pendapatan.
            </p>
            <Button variant="outline" size="sm" onClick={resetFilter}>
              Tampilkan semua
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="hidden md:block overflow-x-auto rounded-xl border">
            <table className="w-full text-sm tabular-nums min-w-[640px]">
              <thead>
                <tr className="bg-muted text-left text-xs text-muted-foreground">
                  <th className="px-2 py-2 font-medium">Tanggal</th>
                  <th className="px-2 py-2 font-medium text-right">KM</th>
                  <th className="px-2 py-2 font-medium text-right">Biaya BBM</th>
                  <th className="px-2 py-2 font-medium text-right">Pendapatan</th>
                  <th className="px-2 py-2 font-medium text-right">Bersih</th>
                  <th className="px-2 py-2 font-medium">Sumber</th>
                  <th className="px-2 py-2 font-medium text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((e) => (
                  <React.Fragment key={e.tanggal}>
                    <tr className="border-t">
                      <td className="px-2 py-1.5 whitespace-nowrap font-medium">
                        {formatTanggalPendek(e.tanggal)}
                      </td>
                      <td className="px-2 py-1.5 text-right whitespace-nowrap">{kmOf(e)}</td>
                      <td className="px-2 py-1.5 text-right whitespace-nowrap">{formatRp(bbmOf(e))}</td>
                      <td className="px-2 py-1.5 text-right whitespace-nowrap">{formatRp(e.kotor)}</td>
                      <td className="px-2 py-1.5 text-right whitespace-nowrap font-bold">
                        {formatRp(bersihOf(e))}
                      </td>
                      <td className="px-2 py-1.5">
                        <Badge variant={e.sumber === 'linimasa' ? 'default' : 'secondary'}>
                          {sumberLabel(e)}
                        </Badge>
                      </td>
                      <td className="px-2 py-1.5 text-right whitespace-nowrap">
                        <RowActions
                          onEdit={() => {
                            setConfirmHapus(null)
                            setEditingTanggal((cur) => (cur === e.tanggal ? null : e.tanggal))
                          }}
                          onHapus={() => setConfirmHapus(e.tanggal)}
                        />
                      </td>
                    </tr>
                    {editingTanggal === e.tanggal && wsId && (
                      <tr className="bg-muted/40">
                        <td colSpan={7} className="px-2 py-2">
                          <EditForm
                            entry={e}
                            onCancel={() => setEditingTanggal(null)}
                            onSave={(patch) => {
                              if (updateLog(wsId, e.tanggal, patch)) {
                                setEditingTanggal(null)
                                refresh()
                              }
                            }}
                          />
                        </td>
                      </tr>
                    )}
                    {confirmHapus === e.tanggal && editingTanggal !== e.tanggal && (
                      <tr className="bg-destructive/5">
                        <td colSpan={7} className="px-2 py-2">
                          <ConfirmHapus
                            tanggal={e.tanggal}
                            onCancel={() => setConfirmHapus(null)}
                            onConfirm={() => hapus(e.tanggal)}
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
            {filtered.map((e) => (
              <li key={e.tanggal}>
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
                    {editingTanggal === e.tanggal && wsId ? (
                      <EditForm
                        entry={e}
                        onCancel={() => setEditingTanggal(null)}
                        onSave={(patch) => {
                          if (updateLog(wsId, e.tanggal, patch)) {
                            setEditingTanggal(null)
                            refresh()
                          }
                        }}
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
                          onClick={() => {
                            setConfirmHapus(null)
                            setEditingTanggal(e.tanggal)
                          }}
                        >
                          <Pencil aria-hidden /> Edit
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 text-destructive border-destructive/40 hover:text-destructive hover:bg-destructive/10"
                          onClick={() => setConfirmHapus(e.tanggal)}
                        >
                          <Trash2 aria-hidden /> Hapus
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        </>
      )}

      <p className="text-xs text-muted-foreground">
        Data tersimpan di HP ini (workspace “{active.name}”). Nanti pindah ke D1 + login tanpa ubah alur.
      </p>
    </div>
  )
}

function SummaryCard({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <Card className={`py-3 gap-1 ${highlight ? 'border-primary' : ''}`}>
      <CardContent className="space-y-0.5">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="font-bold tabular-nums text-base">{value}</div>
      </CardContent>
    </Card>
  )
}

function RowActions({ onEdit, onHapus }: { onEdit: () => void; onHapus: () => void }) {
  return (
    <div className="inline-flex gap-1">
      <Button variant="outline" size="sm" onClick={onEdit}>
        <Pencil aria-hidden /> Edit
      </Button>
      <Button
        variant="outline"
        size="sm"
        className="text-destructive border-destructive/40 hover:text-destructive hover:bg-destructive/10"
        onClick={onHapus}
      >
        <Trash2 aria-hidden /> Hapus
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
  onSave: (patch: { kotor: number; biayaBensin: number; km: number }) => void
  onCancel: () => void
}) {
  const [km, setKm] = React.useState(String(kmOf(entry)))
  const [bbm, setBbm] = React.useState(String(bbmOf(entry)))
  const [kotor, setKotor] = React.useState(String(entry.kotor))

  const simpan = () => {
    onSave({
      km: Math.max(0, Number(km) || 0),
      biayaBensin: Math.max(0, Math.round(Number(bbm) || 0)),
      kotor: Math.max(0, Math.round(Number(kotor) || 0)),
    })
  }

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
