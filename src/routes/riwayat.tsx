import { Link, createFileRoute } from '@tanstack/react-router'
import * as React from 'react'
import { useCreateAtom } from '@tanstack/react-store'
import type { SortingState } from '@tanstack/react-table'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import { Card, CardContent } from '~/components/ui/card'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import { HistoryTable } from '~/components/HistoryTable'
import { formatRp } from '~/lib/calc'
import {
  RENTANG_LIST,
  filterLogs,
  loadLogs,
  normalizeRentang,
  summarize,
} from '~/lib/history'
import type { Rentang } from '~/lib/history'
import { parseSortParam, serializeSorting } from '~/lib/tables'
import { tracksIncome } from '~/lib/workspace'
import type { LogEntry } from '~/lib/workspace'
import { useWorkspaces } from '~/lib/workspace'

export const Route = createFileRoute('/riwayat')({
  validateSearch: (search: Record<string, unknown>): { sort?: string } => ({
    sort: typeof search.sort === 'string' ? search.sort : undefined,
  }),
  component: RiwayatPage,
})

function riwayatFilterKey(wsId: string | null): string {
  return wsId ? `movana:riwayat-filter:${wsId}` : 'movana:riwayat-filter'
}

interface RiwayatFilterState {
  rentang: Rentang
  dari: string
  sampai: string
  hanyaPendapatan: boolean
}

function loadRiwayatFilter(wsId: string | null): RiwayatFilterState | null {
  if (typeof localStorage === 'undefined') return null
  try {
    const raw = localStorage.getItem(riwayatFilterKey(wsId))
    if (!raw) return null
    const o = JSON.parse(raw) as Record<string, unknown>
    return {
      rentang: normalizeRentang(o.rentang),
      dari: typeof o.dari === 'string' ? o.dari : '',
      sampai: typeof o.sampai === 'string' ? o.sampai : '',
      hanyaPendapatan: o.hanyaPendapatan === true,
    }
  } catch {
    return null
  }
}

function RiwayatPage() {
  const { workspaces, active, ready, setActiveId } = useWorkspaces()
  const [logs, setLogs] = React.useState<LogEntry[]>([])
  const [rentang, setRentang] = React.useState<Rentang>('all')
  const [dari, setDari] = React.useState('')
  const [sampai, setSampai] = React.useState('')
  const [hanyaPendapatan, setHanyaPendapatan] = React.useState(false)
  const [filterLoaded, setFilterLoaded] = React.useState(false)

  const wsId = active?.id ?? null

  // Sorting dimiliki app (bukan tabel) karena disinkron ke URL `?sort=`.
  // Satu-satunya external atom tabel ini; expanded + sisanya milik tabel.
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const sortingAtom = useCreateAtom<SortingState>(parseSortParam(search.sort))

  // URL -> atom (tombol back/forward, link eksternal).
  React.useEffect(() => {
    const next = parseSortParam(search.sort)
    const cur = sortingAtom.get()
    if (JSON.stringify(cur) !== JSON.stringify(next)) sortingAtom.set(next)
  }, [sortingAtom, search.sort])

  // Atom -> URL (klik header). replace agar riwayat browser tidak penuh.
  React.useEffect(() => {
    const sub = sortingAtom.subscribe(() => {
      const next = serializeSorting(sortingAtom.get())
      void navigate({
        search: (prev) => {
          const cur = typeof prev.sort === 'string' ? prev.sort : undefined
          if (cur === next) return prev
          return { ...prev, sort: next }
        },
        replace: true,
      })
    })
    return () => sub.unsubscribe()
  }, [sortingAtom, navigate])

  const refresh = React.useCallback(() => {
    setLogs(loadLogs(wsId))
  }, [wsId])

  React.useEffect(() => {
    refresh()
  }, [refresh])

  // Muat preferensi filter terakhir per workspace.
  React.useEffect(() => {
    const saved = loadRiwayatFilter(wsId)
    if (saved) {
      setRentang(saved.rentang)
      setDari(saved.dari)
      setSampai(saved.sampai)
      setHanyaPendapatan(saved.hanyaPendapatan)
    } else {
      setRentang('all')
      setDari('')
      setSampai('')
      setHanyaPendapatan(false)
    }
    setFilterLoaded(true)
  }, [wsId])

  React.useEffect(() => {
    if (!filterLoaded || !wsId) return
    try {
      localStorage.setItem(
        riwayatFilterKey(wsId),
        JSON.stringify({ rentang, dari, sampai, hanyaPendapatan }),
      )
    } catch {
      /* abaikan */
    }
  }, [wsId, rentang, dari, sampai, hanyaPendapatan, filterLoaded])

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
  const narrow =
    rentang !== 'all' || dari !== '' || sampai !== '' || hanyaPendapatan

  if (!ready) {
    return <div className="max-w-2xl mx-auto p-4 text-sm text-muted-foreground">Memuat...</div>
  }

  if (workspaces.length === 0 || !active || !wsId) {
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
    setRentang('all')
    setDari('')
    setSampai('')
    setHanyaPendapatan(false)
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
          {RENTANG_LIST.map((r) => (
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
          {narrow && (
            <Button size="sm" variant="ghost" onClick={resetFilter}>
              Tampilkan semua
            </Button>
          )}
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
        <SummaryCard
          label={withIncome ? 'Total Bersih' : 'Total Keluar'}
          value={formatRp(withIncome ? summary.totalBersih : summary.totalKeluar)}
          highlight
        />
        <SummaryCard label="Total KM" value={`${summary.totalKm} km`} />
        <SummaryCard label="Total BBM" value={formatRp(summary.totalBbm)} />
        <SummaryCard
          label="Extra"
          value={summary.totalExtra > 0 ? formatRp(summary.totalExtra) : '—'}
          sub={withIncome ? `Masuk ${formatRp(summary.totalKotor)}` : `${summary.jumlahHari} hari`}
        />
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
        <HistoryTable data={filtered} wsId={wsId} sortingAtom={sortingAtom} onDataChange={refresh} />
      )}

      <p className="text-xs text-muted-foreground">
        Data tersimpan di HP ini (workspace “{active.name}”). Nanti pindah ke D1 + login tanpa ubah alur.
      </p>
    </div>
  )
}

function SummaryCard({
  label,
  value,
  sub,
  highlight,
}: {
  label: string
  value: string
  sub?: string
  highlight?: boolean
}) {
  return (
    <Card className={`py-3 gap-1 ${highlight ? 'border-primary' : ''}`}>
      <CardContent className="space-y-0.5">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="font-bold tabular-nums text-base">{value}</div>
        {sub && <div className="text-[11px] text-muted-foreground tabular-nums">{sub}</div>}
      </CardContent>
    </Card>
  )
}
