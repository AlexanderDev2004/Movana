import * as React from 'react'
import { Link } from '@tanstack/react-router'
import { useTable } from '@tanstack/react-table'
import type { ColumnDef, Row } from '@tanstack/react-table'
import { LuBike, LuCar, LuChevronDown, LuChevronRight, LuChevronsUpDown, LuChevronUp, LuClock, LuFileJson, LuFootprints, LuMapPin, LuPencil, LuPlus, LuRotateCcw, LuTriangleAlert, LuUpload, LuZap } from 'react-icons/lu'
import { formatRp } from '~/lib/calc'
import type { Platform } from '~/lib/calc'
import { saveTimelineImport } from '~/lib/daily-log'
import {
  DATE_PRESETS,
  DEFAULT_FILTER,
  computeTimelineRows,
  dateBounds,
  dayShortId,
  filterTimelineRows,
  isFilterNarrow,
  isWeekendDay,
  loadTimelineFilter,
  resolveJamRange,
  saveTimelineFilter,
  todayLocal,
} from '~/lib/timeline-import'
import type { TimelineFilter, TimelineRow } from '~/lib/timeline-import'
import { movanaTableFeatures } from '~/lib/tables'
import type { MovanaTableFeatures } from '~/lib/tables'
import { normalizeExpenses, totalExtra } from '~/lib/extra-expense'
import type { ExtraExpense } from '~/lib/extra-expense'
import { hashText, parseTimelineJson } from '~/lib/timeline'
import type { DailyKm, DayMaps } from '~/lib/timeline'
import { getDayMapsTarget } from '~/lib/maps'
import {
  PLATFORM_LABEL,
  isMultiPlatform,
  loadImportHashes,
  saveImportHash,
  tracksIncome,
} from '~/lib/workspace'
import type { Workspace } from '~/lib/workspace'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import { CalcField } from './CalcField'
import { ExtraExpenseEditor } from './ExtraExpenseEditor'
import { RpInput, formatRibuan } from './RpInput'
import { TakeoutGuide } from './TakeoutGuide'

const MAX_FILE_BYTES = 300 * 1024 * 1024
const MIN_KM_OPTIONS = [0, 10, 15, 20]
const DEFAULT_MIN_KM = 15

export function TimelineImport({ ws }: { ws: Workspace }) {
  const multi = isMultiPlatform(ws)
  const withIncome = tracksIncome(ws)

  const [days, setDays] = React.useState<DailyKm[] | null>(null)
  const [fileName, setFileName] = React.useState('')
  const [fileHash, setFileHash] = React.useState<string | null>(null)
  const [duplicate, setDuplicate] = React.useState(false)
  const [skipped, setSkipped] = React.useState(0)
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [saved, setSaved] = React.useState(false)

  const [kmPerLiter, setKmPerLiter] = React.useState('45')
  const [hargaBbm, setHargaBbm] = React.useState('10000')
  const [kmEdit, setKmEdit] = React.useState<Record<string, string>>({})
  const [bbmEdit, setBbmEdit] = React.useState<Record<string, string>>({})
  const [kotorEdit, setKotorEdit] = React.useState<Record<string, string>>({})
  const [platEdit, setPlatEdit] = React.useState<Record<string, Record<string, string>>>({})

  const [view, setView] = React.useState<'ringkas' | 'detail'>('ringkas')
  const [filter, setFilter] = React.useState<TimelineFilter>(() => ({
    ...DEFAULT_FILTER,
    minKm: DEFAULT_MIN_KM,
  }))
  const [filterLoaded, setFilterLoaded] = React.useState(false)
  const [extraEdit, setExtraEdit] = React.useState<Record<string, ExtraExpense[]>>({})
  const [showJam, setShowJam] = React.useState(false)
  const [showBulk, setShowBulk] = React.useState(false)
  const [bulkAmount, setBulkAmount] = React.useState('')
  const [bulkTarget, setBulkTarget] = React.useState<'visible' | 'big' | 'empty'>('empty')
  const [bulkPlatform, setBulkPlatform] = React.useState<Platform>(ws.platforms[0] ?? 'lainnya')
  const [bulkOverwrite, setBulkOverwrite] = React.useState(false)

  const pickFile = async (f: File | undefined) => {
    if (!f) return
    setError(null)
    setSaved(false)
    if (f.size > MAX_FILE_BYTES) {
      setError(`File terlalu besar (${(f.size / 1048576).toFixed(0)} MB). Maksimal 300 MB.`)
      return
    }
    setBusy(true)
    try {
      await new Promise((r) => setTimeout(r, 30)) // beri waktu UI tampil "memproses"
      const text = await f.text()
      const hash = hashText(text)
      const parsed = parseTimelineJson(JSON.parse(text))
      if (parsed.days.length === 0) throw new Error('Tidak ada hari terdeteksi di file ini')
      setDays(parsed.days)
      setSkipped(parsed.skipped)
      setFileName(f.name)
      setFileHash(hash)
      setDuplicate(loadImportHashes(ws.id).includes(hash))
    } catch (e) {
      setDays(null)
      setError(e instanceof Error ? e.message : 'Gagal membaca file')
    } finally {
      setBusy(false)
    }
  }

  const reset = () => {
    setDays(null)
    setFileName('')
    setFileHash(null)
    setDuplicate(false)
    setSkipped(0)
    setError(null)
    setSaved(false)
    setKmEdit({})
    setBbmEdit({})
    setKotorEdit({})
    setPlatEdit({})
    setExtraEdit({})
    setFilter({ ...DEFAULT_FILTER, minKm: DEFAULT_MIN_KM })
    setShowJam(false)
    setShowBulk(false)
    setBulkAmount('')
  }

  // Muat preferensi filter terakhir per workspace; simpan tiap berubah.
  React.useEffect(() => {
    const savedFilter = loadTimelineFilter(ws.id)
    if (savedFilter) {
      setFilter(savedFilter)
      if (savedFilter.jamMode !== 'all') setShowJam(true)
    }
    setFilterLoaded(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ws.id])

  React.useEffect(() => {
    if (!filterLoaded) return
    saveTimelineFilter(ws.id, filter)
  }, [ws.id, filter, filterLoaded])

  const resetKm = (tanggal: string) =>
    setKmEdit((p) => {
      if (!(tanggal in p)) return p
      const next = { ...p }
      delete next[tanggal]
      return next
    })

  /** Hari dianggap "sudah isi pendapatan" bila user mengetik sesuatu (termasuk 0). */
  const isFilled = React.useCallback(
    (tanggal: string): boolean => {
      if (!withIncome) return false
      if (multi) {
        const m = platEdit[tanggal]
        return !!m && Object.values(m).some((v) => (v ?? '').trim() !== '')
      }
      return (kotorEdit[tanggal] ?? '').trim() !== ''
    },
    [withIncome, multi, kotorEdit, platEdit],
  )

  const kotorPerTanggal = React.useMemo(() => {
    const m: Record<string, number> = {}
    if (!days) return m
    for (const d of days) {
      m[d.tanggal] = multi
        ? ws.platforms.reduce((a, p) => a + (Number(platEdit[d.tanggal]?.[p]) || 0), 0)
        : Number(kotorEdit[d.tanggal]) || 0
    }
    return m
  }, [days, multi, ws.platforms, kotorEdit, platEdit])

  const extraPerTanggal = React.useMemo(() => {
    const m: Record<string, number> = {}
    for (const [tanggal, list] of Object.entries(extraEdit)) {
      const t = totalExtra(normalizeExpenses(list))
      if (t > 0) m[tanggal] = t
    }
    return m
  }, [extraEdit])

  const extraCountPerTanggal = React.useMemo(() => {
    const m: Record<string, number> = {}
    for (const [tanggal, list] of Object.entries(extraEdit)) {
      if (list.length > 0) m[tanggal] = list.length
    }
    return m
  }, [extraEdit])

  const jamRange = React.useMemo(() => resolveJamRange(filter), [filter])

  const { rows, totals } = React.useMemo(
    () =>
      computeTimelineRows(days ?? [], {
        kmEdit,
        kmPerLiter: Number(kmPerLiter),
        hargaBbm: Number(hargaBbm),
        bbmEdit,
        kotorPerTanggal,
        withIncome,
        extraPerTanggal,
        extraCountPerTanggal,
        jamRange,
      }),
    [days, kmEdit, kmPerLiter, hargaBbm, bbmEdit, kotorPerTanggal, withIncome, extraPerTanggal, extraCountPerTanggal, jamRange],
  )

  const todayStr = React.useMemo(() => todayLocal(), [])
  const dateBoundsActive = React.useMemo(() => dateBounds(filter, todayStr), [filter, todayStr])
  const visible = React.useMemo(
    () => filterTimelineRows(rows, filter, isFilled, todayStr),
    [rows, filter, isFilled, todayStr],
  )

  const avgKm = totals.days > 0 ? totals.totalKm / totals.days : 0
  const visibleFilled = withIncome ? visible.filter((r) => isFilled(r.tanggal)) : []
  const detail = view === 'detail'

  const columns = React.useMemo(
    () =>
      makeTimelineColumns({
        detail,
        withIncome,
        multi,
        platforms: ws.platforms,
        kmEdit,
        bbmEdit,
        kotorEdit,
        platEdit,
        isFilled,
        setKmEdit,
        setBbmEdit,
        setKotorEdit,
        setPlatEdit,
        resetKm,
      }),
    [detail, withIncome, multi, ws.platforms, kmEdit, bbmEdit, kotorEdit, platEdit, isFilled],
  )

  const table = useTable({
    key: 'timeline-import',
    features: movanaTableFeatures,
    columns,
    data: visible,
    getRowId: (row) => row.tanggal,
    // Koreksi ketikan tidak boleh menutup rincian yang sedang dibuka.
    autoResetExpanded: false,
  })

  const tableRows = table.getRowModel().rows
  const colCount = table.getAllLeafColumns().length

  const kplNum = Number(kmPerLiter)
  const kplWarn = kmPerLiter.trim() !== '' && Number.isFinite(kplNum) && (kplNum < 25 || kplNum > 60)

  const applyBulk = () => {
    const amount = bulkAmount.trim()
    if (amount === '') return
    const targets = rows.filter((r) => {
      if (bulkTarget === 'big' && r.km < 20) return false
      if (bulkTarget === 'visible' && !visible.some((v) => v.tanggal === r.tanggal)) return false
      if (!bulkOverwrite && isFilled(r.tanggal)) return false
      return true
    })
    if (targets.length === 0) return
    if (multi) {
      setPlatEdit((prev) => {
        const next = { ...prev }
        for (const r of targets) next[r.tanggal] = { ...next[r.tanggal], [bulkPlatform]: amount }
        return next
      })
    } else {
      setKotorEdit((prev) => {
        const next = { ...prev }
        for (const r of targets) next[r.tanggal] = amount
        return next
      })
    }
    setShowBulk(false)
  }

  const simpan = () => {
    const n = saveTimelineImport(
      ws.id,
      rows.map((r) => {
        const extras = normalizeExpenses(extraEdit[r.tanggal] ?? [])
        return {
          tanggal: r.tanggal,
          km: r.km,
          kotor: withIncome ? r.pendapatan : 0,
          biayaBensin: r.biayaBbm,
          biayaLain: r.extra,
          rincianKm: r.rincian,
          rincian:
            multi && withIncome
              ? ws.platforms.map((p) => ({ platform: p, jumlah: Number(platEdit[r.tanggal]?.[p]) || 0 }))
              : undefined,
          ...(extras.length > 0
            ? { rincianBiaya: extras.map((e) => ({ kategori: e.kategori, jumlah: e.jumlah })) }
            : {}),
        }
      }),
    )
    if (n > 0) {
      if (fileHash) {
        saveImportHash(ws.id, fileHash)
        setDuplicate(true)
      }
      setSaved(true)
      setError(null)
    }
  }

  if (!days) {
    return (
      <div className="space-y-3">
        <Card className="border-dashed">
          <CardContent className="space-y-3 text-center py-6">
            <LuUpload className="size-8 mx-auto text-muted-foreground" aria-hidden />
            <div>
              <p className="font-bold">Import dari Timeline Google</p>
              <p className="text-sm text-muted-foreground">
                Upload export Linimasa (JSON). KM motor per hari terisi otomatis.
              </p>
            </div>
            <label className="block">
              <span className="sr-only">Pilih file JSON Linimasa</span>
              <Input
                type="file"
                accept="application/json,.json"
                disabled={busy}
                onChange={(e) => void pickFile(e.target.files?.[0])}
                className="cursor-pointer file:mr-3 file:rounded file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-primary-foreground file:font-bold"
              />
            </label>
            {busy && <p className="text-sm text-muted-foreground">Memproses file besar… tunggu sebentar.</p>}
          </CardContent>
        </Card>

        {error && (
          <p className="rounded-xl bg-destructive/10 border border-destructive/30 text-destructive text-sm p-3">
            {error}
          </p>
        )}

        <TakeoutGuide />
      </div>
    )
  }

  const footPendapatan = visible.reduce((a, r) => a + r.pendapatan, 0)
  const footBiaya = visible.reduce((a, r) => a + r.biayaBbm, 0)
  const footExtra = visible.reduce((a, r) => a + r.extra, 0)
  const footBersihVisible = visible.reduce((a, r) => a + r.bersih, 0)
  const footKeluarVisible = footBiaya + footExtra
  const narrow = isFilterNarrow(filter)

  return (
    <div className="space-y-4">
      <Card className="py-3">
        <CardContent className="flex items-center gap-2 text-sm">
          <LuFileJson className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          <span className="min-w-0 flex-1 truncate font-medium">{fileName}</span>
          <Badge variant="secondary">{totals.days} hari</Badge>
          {duplicate && <Badge variant="outline">pernah diimport</Badge>}
          <Button variant="outline" size="sm" onClick={reset}>
            Ganti file
          </Button>
        </CardContent>
      </Card>

      {duplicate && (
        <p className="rounded-xl bg-amber-500/10 border border-amber-500/30 text-sm p-3">
          File ini sudah pernah disimpan ke log. Import ulang akan menimpa entri tanggal yang sama.
        </p>
      )}
      {skipped > 0 && (
        <p className="text-xs text-muted-foreground">{skipped} segmen rusak dilewati saat parse.</p>
      )}
      {error && (
        <p className="rounded-xl bg-destructive/10 border border-destructive/30 text-destructive text-sm p-3">
          {error}
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Efisiensi & harga</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="grid grid-cols-2 gap-3">
            <CalcField
              label="Konsumsi motor"
              value={kmPerLiter}
              onChange={setKmPerLiter}
              inputMode="decimal"
              suffix="km/L"
              placeholder="cth 45"
            />
            <CalcField label="Harga BBM" value={hargaBbm} onChange={setHargaBbm} suffix="Rp" />
          </div>
          {kplWarn ? (
            <p className="flex items-start gap-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-xs p-2">
              <LuTriangleAlert className="size-4 shrink-0" aria-hidden />
              <span>Tidak biasa untuk motor (normal 35–50 km/L). Cek lagi angkanya.</span>
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">Berlaku ke semua {totals.days} hari.</p>
          )}
        </CardContent>
      </Card>

      {/* Filter: tanggal + KM + jam */}
      <Card className="py-3">
        <CardContent className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-bold">
              Menampilkan {visible.length} dari {totals.days} hari
            </p>
            {narrow && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  setFilter((f) => ({
                    ...f,
                    minKm: 0,
                    weekdaysOnly: false,
                    filledOnly: false,
                    preset: 'all',
                    dari: '',
                    sampai: '',
                    jamMode: 'all',
                  }))
                }
              >
                Tampilkan semua
              </Button>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Rentang tanggal">
            {DATE_PRESETS.map((p) => (
              <Button
                key={p.id}
                size="sm"
                variant={filter.preset === p.id ? 'default' : 'outline'}
                onClick={() => setFilter((f) => ({ ...f, preset: p.id }))}
                role="tab"
                aria-selected={filter.preset === p.id}
              >
                {p.label}
              </Button>
            ))}
          </div>
          {filter.preset === 'custom' ? (
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label htmlFor="tl-dari" className="text-xs">
                  Dari
                </Label>
                <Input
                  id="tl-dari"
                  type="date"
                  value={filter.dari}
                  onChange={(e) => setFilter((f) => ({ ...f, dari: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="tl-sampai" className="text-xs">
                  Sampai
                </Label>
                <Input
                  id="tl-sampai"
                  type="date"
                  value={filter.sampai}
                  onChange={(e) => setFilter((f) => ({ ...f, sampai: e.target.value }))}
                />
              </div>
            </div>
          ) : (
            dateBoundsActive && (
              <p className="text-xs text-muted-foreground tabular-nums">
                {formatDate(dateBoundsActive.dari)}
                {dateBoundsActive.dari !== dateBoundsActive.sampai
                  ? ` – ${formatDate(dateBoundsActive.sampai)}`
                  : ''}
              </p>
            )
          )}
          <div className="flex flex-wrap gap-1.5">
            {MIN_KM_OPTIONS.map((v) => (
              <Button
                key={v}
                size="sm"
                variant={filter.minKm === v ? 'default' : 'outline'}
                onClick={() => setFilter((f) => ({ ...f, minKm: v }))}
                aria-pressed={filter.minKm === v}
              >
                {v === 0 ? 'Semua KM' : `≥ ${v} km`}
              </Button>
            ))}
            <Button
              size="sm"
              variant={filter.weekdaysOnly ? 'default' : 'outline'}
              onClick={() => setFilter((f) => ({ ...f, weekdaysOnly: !f.weekdaysOnly }))}
              aria-pressed={filter.weekdaysOnly}
            >
              Hari kerja
            </Button>
            {withIncome && (
              <Button
                size="sm"
                variant={filter.filledOnly ? 'default' : 'outline'}
                onClick={() => setFilter((f) => ({ ...f, filledOnly: !f.filledOnly }))}
                aria-pressed={filter.filledOnly}
              >
                Sudah terisi
              </Button>
            )}
          </div>
          <div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowJam((v) => !v)}
              aria-expanded={showJam}
              className="px-1 text-xs text-muted-foreground"
            >
              {showJam ? <LuChevronDown className="size-3.5" aria-hidden /> : <LuChevronRight className="size-3.5" aria-hidden />}{' '}
              <LuClock className="size-3.5" aria-hidden /> Filter jam
              {filter.jamMode !== 'all' && (
                <span className="ml-1 font-bold text-foreground tabular-nums">
                  {filter.jamMulai}–{filter.jamSelesai}
                </span>
              )}
            </Button>
            {showJam && (
              <div className="mt-1 space-y-1.5 rounded-lg bg-muted/60 p-2">
                <div className="flex flex-wrap gap-1.5">
                  <Button
                    size="sm"
                    variant={filter.jamMode === 'all' ? 'default' : 'outline'}
                    onClick={() => setFilter((f) => ({ ...f, jamMode: 'all' }))}
                    aria-pressed={filter.jamMode === 'all'}
                  >
                    Semua waktu
                  </Button>
                  <Button
                    size="sm"
                    variant={filter.jamMode === 'kerja' ? 'default' : 'outline'}
                    onClick={() => setFilter((f) => ({ ...f, jamMode: 'kerja' }))}
                    aria-pressed={filter.jamMode === 'kerja'}
                  >
                    Jam kerja
                  </Button>
                  <Button
                    size="sm"
                    variant={filter.jamMode === 'custom' ? 'default' : 'outline'}
                    onClick={() => setFilter((f) => ({ ...f, jamMode: 'custom' }))}
                    aria-pressed={filter.jamMode === 'custom'}
                  >
                    Custom
                  </Button>
                </div>
                {filter.jamMode !== 'all' && (
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label htmlFor="tl-jam-mulai" className="text-xs">
                        Jam mulai
                      </Label>
                      <Input
                        id="tl-jam-mulai"
                        type="time"
                        value={filter.jamMulai}
                        onChange={(e) => setFilter((f) => ({ ...f, jamMulai: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="tl-jam-selesai" className="text-xs">
                        Jam selesai
                      </Label>
                      <Input
                        id="tl-jam-selesai"
                        type="time"
                        value={filter.jamSelesai}
                        onChange={(e) => setFilter((f) => ({ ...f, jamSelesai: e.target.value }))}
                      />
                    </div>
                  </div>
                )}
                <p className="text-[11px] text-muted-foreground">
                  Hanya KM motor di jam tersebut yang dihitung. Koreksi KM manual tidak difilter.
                </p>
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1" role="tablist" aria-label="Mode tampilan tabel">
            <Button
              size="sm"
              variant={!detail ? 'default' : 'ghost'}
              onClick={() => setView('ringkas')}
              role="tab"
              aria-selected={!detail}
            >
              Ringkas
            </Button>
            <Button
              size="sm"
              variant={detail ? 'default' : 'ghost'}
              onClick={() => setView('detail')}
              role="tab"
              aria-selected={detail}
            >
              Detail
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Kartu total (mengikuti filter tampil) */}
      <Card className="py-3">
        <CardContent className="space-y-1">
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-sm text-muted-foreground">
              {withIncome ? `Bersih tampil · ${visibleFilled.length} hari terisi` : 'Keluar tampil (BBM + extra)'}
            </p>
            <Badge variant="secondary">rata-rata {Math.round(avgKm)} km/hari</Badge>
          </div>
          <p
            className={`text-3xl font-bold tabular-nums tracking-tight ${
              withIncome && visibleFilled.length === 0 ? 'text-muted-foreground' : ''
            }`}
          >
            {withIncome
              ? visibleFilled.length > 0
                ? formatRp(visibleFilled.reduce((a, r) => a + r.bersih, 0))
                : 'belum ada pendapatan'
              : formatRp(footKeluarVisible)}
          </p>
          {withIncome ? (
            <p className="text-xs text-muted-foreground tabular-nums">
              Masuk {formatRp(visibleFilled.reduce((a, r) => a + r.pendapatan, 0))} (
              {visibleFilled.length} hari) • BBM {formatRp(footBiaya)}
              {footExtra > 0 && <> • Extra {formatRp(footExtra)}</>}
            </p>
          ) : (
            footExtra > 0 && (
              <p className="text-xs text-muted-foreground tabular-nums">
                BBM {formatRp(footBiaya)} • Extra {formatRp(footExtra)}
              </p>
            )
          )}
        </CardContent>
      </Card>

      {withIncome && (
        <div>
          {!showBulk ? (
            <Button variant="outline" size="sm" onClick={() => setShowBulk(true)}>
              <LuZap aria-hidden /> Isi pendapatan massal
            </Button>
          ) : (
            <Card className="py-3 bg-muted border-0 shadow-none">
              <CardContent className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1.5">
                    <Label>Nominal (Rp)</Label>
                    <RpInput
                      placeholder="cth 200.000"
                      value={bulkAmount}
                      onChange={setBulkAmount}
                      className="h-10"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Target hari</Label>
                    <select
                      className="border-input rounded-md border bg-transparent px-2 h-10 text-sm w-full"
                      value={bulkTarget}
                      onChange={(e) => setBulkTarget(e.target.value as typeof bulkTarget)}
                    >
                      <option value="empty">Yang masih kosong</option>
                      <option value="visible">Yang tampil</option>
                      <option value="big">KM ≥ 20</option>
                    </select>
                  </div>
                </div>
                {multi && (
                  <div className="space-y-1.5">
                    <Label>Platform</Label>
                    <select
                      className="border-input rounded-md border bg-transparent px-2 h-10 text-sm w-full"
                      value={bulkPlatform}
                      onChange={(e) => setBulkPlatform(e.target.value as Platform)}
                    >
                      {ws.platforms.map((p) => (
                        <option key={p} value={p}>
                          {PLATFORM_LABEL[p]}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={bulkOverwrite}
                    onChange={(e) => setBulkOverwrite(e.target.checked)}
                    className="size-4"
                  />
                  Timpa yang sudah terisi
                </label>
                <div className="flex gap-1.5">
                  <Button size="sm" onClick={applyBulk} disabled={bulkAmount.trim() === ''}>
                    Terapkan
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setShowBulk(false)}>
                    Batal
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {visible.length === 0 && (
        <p className="rounded-xl border border-dashed text-sm text-muted-foreground p-4 text-center">
          Tidak ada hari cocok dengan filter. Ubah filter atau tekan “Tampilkan semua”.
        </p>
      )}

      {/* Tampilan kartu (layar kecil) — urutan mengikuti sorting tabel */}
      <div className="md:hidden space-y-2">
        {tableRows.map((row) => {
          const r = row.original
          return (
            <DayCard
              key={row.id}
              row={r}
              highlight={r.km > avgKm && avgKm > 0}
              withIncome={withIncome}
              filled={isFilled(r.tanggal)}
              kmValue={kmEdit[r.tanggal] ?? ''}
              onKmChange={(v) => setKmEdit((p) => ({ ...p, [r.tanggal]: v }))}
              onResetKm={() => resetKm(r.tanggal)}
              bbmValue={bbmEdit[r.tanggal] ?? ''}
              onBbmChange={(digits) => setBbmEdit((p) => ({ ...p, [r.tanggal]: digits }))}
              onResetBbm={() =>
                setBbmEdit((p) => {
                  if (!(r.tanggal in p)) return p
                  const next = { ...p }
                  delete next[r.tanggal]
                  return next
                })
              }
              extras={extraEdit[r.tanggal] ?? []}
              onExtrasChange={(next) => setExtraEdit((p) => ({ ...p, [r.tanggal]: next }))}
              incomeSlot={
                <IncomeInputs
                  tanggal={r.tanggal}
                  multi={multi}
                  platforms={ws.platforms}
                  kotorEdit={kotorEdit}
                  platEdit={platEdit}
                  setKotorEdit={setKotorEdit}
                  setPlatEdit={setPlatEdit}
                />
              }
            />
          )
        })}
      </div>

      {/* Tampilan tabel (layar ≥ md) */}
      <div className="hidden md:block overflow-x-auto rounded-xl border">
        <table
          className={`w-full text-sm tabular-nums ${detail ? 'min-w-[800px]' : 'min-w-[640px]'}`}
        >
          <thead>
            <tr className="bg-muted text-xs text-muted-foreground">
              {table.getHeaderGroups().map((hg) =>
                hg.headers.map((header) => {
                  const canSort = header.column.getCanSort()
                  const sorted = header.column.getIsSorted()
                  const right = TL_RIGHT.has(header.column.id)
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
                      className={`px-2 py-2 font-medium ${right ? 'text-right' : 'text-left'}`}
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
            {tableRows.map((row) => {
              const r = row.original
              const highlight = r.km > avgKm && avgKm > 0
              return (
                <React.Fragment key={row.id}>
                  <tr className={`group border-t ${highlight ? 'bg-amber-500/[0.07]' : ''}`}>
                    {row.getAllCells().map((cell) => (
                      <td key={cell.id} className={tlCellClass(cell.column.id)}>
                        <table.FlexRender cell={cell} />
                      </td>
                    ))}
                  </tr>
                  {row.getIsExpanded() && (
                    <tr className={highlight ? 'bg-amber-500/[0.07]' : ''}>
                      <td colSpan={colCount} className="px-2 py-1.5 bg-muted/40">
                        <div className="space-y-1.5">
                          {!detail && (
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                              <ModeBadges row={r} />
                              <span className="tabular-nums">Liter {r.liter}</span>
                              <span>{r.keterangan}</span>
                              <MapsDetailLink maps={r.maps} tanggal={r.tanggal} compact />
                            </div>
                          )}
                          <ExtraExpenseEditor
                            tanggal={r.tanggal}
                            value={extraEdit[r.tanggal] ?? []}
                            onChange={(next) => setExtraEdit((p) => ({ ...p, [r.tanggal]: next }))}
                          />
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              )
            })}
          </tbody>
          <tfoot>
            <tr className="border-t bg-muted/50 font-bold">
              <td className="px-2 py-2 whitespace-nowrap">Total tampil</td>
              <td className="px-2 py-2 text-right whitespace-nowrap">
                {Math.round(visible.reduce((a, r) => a + r.km, 0) * 100) / 100}
              </td>
              {detail && (
                <td className="px-2 py-2 text-right whitespace-nowrap">
                  {Math.round(visible.reduce((a, r) => a + r.liter, 0) * 100) / 100}
                </td>
              )}
              <td className="px-2 py-2 text-right whitespace-nowrap">{formatRp(footBiaya)}</td>
              <td className="px-2 py-2 text-right whitespace-nowrap">
                {footExtra === 0 ? (
                  <span className="text-muted-foreground font-normal">—</span>
                ) : (
                  formatRp(footExtra)
                )}
              </td>
              {withIncome && (
                <td className="px-2 py-2 text-right whitespace-nowrap">
                  {footPendapatan === 0 ? (
                    <span className="text-muted-foreground font-normal">—</span>
                  ) : (
                    formatRp(footPendapatan)
                  )}
                </td>
              )}
              <td className="px-2 py-2 text-right whitespace-nowrap">
                {withIncome && visibleFilled.length === 0 ? (
                  <span className="text-muted-foreground font-normal">—</span>
                ) : (
                  formatRp(withIncome ? footBersihVisible : footKeluarVisible)
                )}
              </td>
              {detail && <td />}
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">
        Baris disorot = KM di atas rata-rata ({Math.round(avgKm)} km/hari). Ketuk angka KM
        untuk koreksi dan angka BBM untuk isi aktual SPBU (Esc = batal). Ketuk panah di tanggal
        atau nominal Extra untuk rincian & kelola pengeluaran.
      </p>

      <Button size="lg" className="w-full text-base font-bold" onClick={simpan}>
        {saved ? 'Tersimpan ✓' : `Simpan ${totals.days} hari ke log`}
      </Button>

      {saved && (
        <div className="rounded-xl bg-green-600/10 border border-green-600/30 p-3 flex items-center gap-2">
          <p className="flex-1 text-sm font-bold">Berhasil disimpan ✓</p>
          <Button size="sm" asChild>
            <Link to="/riwayat">Lihat Riwayat</Link>
          </Button>
          <Button size="sm" variant="outline" onClick={() => setSaved(false)}>
            Tutup
          </Button>
        </div>
      )}

      <details className="text-xs text-muted-foreground">
        <summary className="cursor-pointer">Rumus per baris</summary>
        <p className="mt-1">
          Liter = KM / konsumsi; BBM = liter × harga; Bersih = pendapatan − BBM − extra. KM default =
          motor hasil parse (dibatasi jam bila filter jam aktif), BBM default = hasil rumus — keduanya bisa diketik ulang bila beda
          dengan struk SPBU (liter menyesuaikan otomatis). Filter hanya mengubah tampilan — yang disimpan
          tetap semua {totals.days} hari.
        </p>
      </details>
    </div>
  )
}

/** Kolom angka rata kanan di tabel import. */
const TL_RIGHT = new Set(['km', 'liter', 'bbm', 'extra', 'pendapatan', 'bersih'])

function tlCellClass(columnId: string): string {
  if (TL_RIGHT.has(columnId)) return 'px-2 py-1.5 text-right whitespace-nowrap'
  if (columnId === 'tanggal') return 'px-2 py-1.5 whitespace-nowrap'
  if (columnId === 'keterangan') return 'px-2 py-1.5 text-xs text-muted-foreground whitespace-nowrap'
  return 'px-2 py-1.5'
}

interface TimelineColumnOpts {
  detail: boolean
  withIncome: boolean
  multi: boolean
  platforms: Platform[]
  kmEdit: Record<string, string>
  bbmEdit: Record<string, string>
  kotorEdit: Record<string, string>
  platEdit: Record<string, Record<string, string>>
  isFilled: (tanggal: string) => boolean
  setKmEdit: React.Dispatch<React.SetStateAction<Record<string, string>>>
  setBbmEdit: React.Dispatch<React.SetStateAction<Record<string, string>>>
  setKotorEdit: React.Dispatch<React.SetStateAction<Record<string, string>>>
  setPlatEdit: React.Dispatch<React.SetStateAction<Record<string, Record<string, string>>>>
  resetKm: (tanggal: string) => void
}

/**
 * Definisi kolom tabel import — sel edit (KM/BBM/pendapatan) membaca state
 * draf komponen, nilai sort diambil dari baris final. Dibangun ulang saat
 * input berubah; state sorting/expanded tabel (keyed by tanggal) bertahan.
 */
function makeTimelineColumns(o: TimelineColumnOpts): ColumnDef<MovanaTableFeatures, TimelineRow>[] {
  const cols: ColumnDef<MovanaTableFeatures, TimelineRow>[] = [
    {
      accessorKey: 'tanggal',
      header: 'Tanggal',
      cell: (info) => {
        const r = info.row.original
        const expanded = info.row.getIsExpanded()
        return (
          <div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-muted-foreground"
                onClick={info.row.getToggleExpandedHandler()}
                aria-expanded={expanded}
                aria-label={expanded ? `Tutup rincian ${r.tanggal}` : `Buka rincian ${r.tanggal}`}
              >
                {expanded ? <LuChevronDown className="size-4" aria-hidden /> : <LuChevronRight className="size-4" aria-hidden />}
              </Button>
              <DateCell tanggal={r.tanggal} />
              <MapsIconLink maps={r.maps} tanggal={r.tanggal} />
            </div>
            {o.detail && (
              <div className="mt-1 space-y-1">
                <ModeBadges row={r} />
                {r.jamFiltered && (
                  <div className="flex items-center gap-1 text-[11px] text-muted-foreground tabular-nums">
                    <LuClock className="size-3" aria-hidden />
                    {r.km} km di jam filter (penuh {r.kmParsed} km)
                  </div>
                )}
                <MapsDetailLink maps={r.maps} tanggal={r.tanggal} />
              </div>
            )}
          </div>
        )
      },
      sortFn: 'alphanumeric',
    },
    {
      accessorFn: (r) => r.km,
      id: 'km',
      header: 'KM',
      cell: (info) => {
        const r = info.row.original
        return (
          <KmCell
            row={r}
            value={o.kmEdit[r.tanggal] ?? ''}
            onChange={(v) => o.setKmEdit((p) => ({ ...p, [r.tanggal]: v }))}
            onReset={() => o.resetKm(r.tanggal)}
            clickToEdit={!o.detail}
          />
        )
      },
      sortFn: 'alphanumeric',
    },
  ]
  if (o.detail) {
    cols.push({
      accessorFn: (r) => r.liter,
      id: 'liter',
      header: 'Liter',
      cell: (info) => info.getValue<number>(),
      sortFn: 'alphanumeric',
    })
  }
  cols.push(
    {
      accessorFn: (r) => r.biayaBbm,
      id: 'bbm',
      header: 'BBM',
      cell: (info) => {
        const r = info.row.original
        return (
          <BbmCell
            row={r}
            value={o.bbmEdit[r.tanggal] ?? ''}
            onChange={(digits) => o.setBbmEdit((p) => ({ ...p, [r.tanggal]: digits }))}
            onReset={() =>
              o.setBbmEdit((p) => {
                if (!(r.tanggal in p)) return p
                const next = { ...p }
                delete next[r.tanggal]
                return next
              })
            }
            clickToEdit={!o.detail}
          />
        )
      },
      sortFn: 'alphanumeric',
    },
    {
      accessorFn: (r) => r.extra,
      id: 'extra',
      header: 'Extra',
      cell: (info) => <ExtraCell row={info.row} />,
      sortFn: 'alphanumeric',
    },
  )
  if (o.withIncome) {
    cols.push({
      accessorFn: (r) => r.pendapatan,
      id: 'pendapatan',
      header: 'Pendapatan',
      cell: (info) => {
        const r = info.row.original
        return (
          <IncomeInputs
            tanggal={r.tanggal}
            multi={o.multi}
            platforms={o.platforms}
            kotorEdit={o.kotorEdit}
            platEdit={o.platEdit}
            setKotorEdit={o.setKotorEdit}
            setPlatEdit={o.setPlatEdit}
          />
        )
      },
      sortFn: 'alphanumeric',
    })
  }
  cols.push({
    accessorFn: (r) => (o.withIncome ? r.bersih : r.biayaBbm + r.extra),
    id: 'bersih',
    header: o.withIncome ? 'Bersih' : 'Keluar',
    cell: (info) => {
      const r = info.row.original
      if (o.withIncome && !o.isFilled(r.tanggal)) {
        return <span className="text-muted-foreground font-normal text-xs">belum diisi</span>
      }
      return (
        <span className="font-bold">
          {formatRp(o.withIncome ? r.bersih : r.biayaBbm + r.extra)}
        </span>
      )
    },
    sortFn: 'alphanumeric',
  })
  if (o.detail) {
    cols.push({
      accessorKey: 'keterangan',
      header: 'Keterangan',
      cell: (info) => info.getValue<string>(),
      enableSorting: false,
    })
  }
  return cols
}

/**
 * Sel Extra mode Ringkas: hanya total (Rp 35.000 / tombol tambah). Ketuk untuk
 * expand ke rincian + editor. Tetap satu baris agar tabel tidak ramai.
 */
function ExtraCell({ row }: { row: Row<MovanaTableFeatures, TimelineRow> }) {
  const r = row.original
  const expanded = row.getIsExpanded()
  const onToggle = row.getToggleExpandedHandler()
  if (r.extra <= 0) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={onToggle}
        title={`Tambah pengeluaran ${r.tanggal}`}
        aria-expanded={expanded}
        aria-label={`Tambah pengeluaran ${r.tanggal}`}
        className="h-7 border-dashed text-xs font-normal text-muted-foreground"
      >
        <LuPlus aria-hidden /> {expanded ? 'tutup' : 'tambah'}
      </Button>
    )
  }
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={onToggle}
      title="Lihat rincian & kelola"
      aria-expanded={expanded}
      aria-label={`Kelola pengeluaran ${r.tanggal}, total ${formatRp(r.extra)}`}
      className="h-7 text-xs tabular-nums"
    >
      <LuPlus aria-hidden /> {formatRp(r.extra)}
      <span className="font-normal text-muted-foreground">
        {r.extraCount > 1 ? `(${r.extraCount})` : ''} {expanded ? <LuChevronDown className="size-3" aria-hidden /> : <LuChevronRight className="size-3" aria-hidden />}
      </span>
    </Button>
  )
}

function DateCell({ tanggal }: { tanggal: string }) {  const weekend = isWeekendDay(tanggal)
  return (
    <div className="flex items-center gap-1.5">
      <span className="font-medium">{formatDate(tanggal)}</span>
      <span
        className={`text-[10px] font-bold px-1 rounded ${
          weekend ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300' : 'text-muted-foreground'
        }`}
      >
        {dayShortId(tanggal)}
      </span>
    </div>
  )
}

/**
 * Ikon kecil pin untuk mode Ringkas: ditaruh di kolom Tanggal.
 * Selalu mungil (size-5) supaya baris tidak tambah tinggi/ramai;
 * koordinat mentah tidak pernah dirender — hanya dipakai di href.
 */
function MapsIconLink({ maps, tanggal }: { maps?: DayMaps; tanggal: string }) {
  const target = getDayMapsTarget(maps)
  if (!target) return null
  return (
    <a
      href={target.url}
      target="_blank"
      rel="noopener noreferrer"
      title={`Lihat ${tanggal} di Google Maps`}
      aria-label={`Lihat ${tanggal} di Google Maps`}
      onClick={(e) => e.stopPropagation()}
      className="inline-flex size-5 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-2"
    >
      <LuMapPin className="size-3.5" aria-hidden />
    </a>
  )
}

/**
 * Tombol jelas "Lihat di Maps" untuk mode Detail / baris yang di-expand.
 * Label tempat (mis. "Rumah → Area kerja") hanya teks ramah-baca, tanpa koordinat.
 */
function MapsDetailLink({
  maps,
  tanggal,
  compact,
}: {
  maps?: DayMaps
  tanggal: string
  compact?: boolean
}) {
  const target = getDayMapsTarget(maps)
  if (!target) return null
  return (
    <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-0.5">
      <a
        href={target.url}
        target="_blank"
        rel="noopener noreferrer"
        title={
          target.kind === 'route'
            ? `Buka rute harian ${tanggal} di Google Maps`
            : `Lihat lokasi ${tanggal} di Google Maps`
        }
        aria-label={
          target.kind === 'route'
            ? `Lihat rute ${tanggal} di Google Maps`
            : `Lihat lokasi ${tanggal} di Google Maps`
        }
        onClick={(e) => e.stopPropagation()}
        className={`inline-flex items-center gap-1 rounded-md border font-medium hover:bg-muted ${
          compact ? 'px-1.5 py-0.5 text-[11px]' : 'px-2 py-1 text-xs'
        }`}
      >
        <LuMapPin className="size-3.5" aria-hidden /> Lihat di Maps
      </a>
      {maps?.placeLabel && (
        <span className={compact ? 'text-[11px]' : 'text-[11px] text-muted-foreground'}>
          {maps.placeLabel}
        </span>
      )}
    </span>
  )
}

/**
 * Sel KM: angka statis + ikon edit (klik → jadi input) di mode Ringkas,
 * input langsung di mode Detail. Ukuran sama (h-9 w-20) supaya tidak layout shift.
 */
function KmCell({
  row: r,
  value,
  onChange,
  onReset,
  clickToEdit,
}: {
  row: TimelineRow
  value: string
  onChange: (v: string) => void
  onReset: () => void
  clickToEdit: boolean
}) {
  const [editing, setEditing] = React.useState(false)
  const showInput = !clickToEdit || editing
  const display = value.trim() !== '' ? value : String(r.kmParsed)

  return (
    <div>
      <div className="flex items-center justify-end gap-1">
        {showInput ? (
          <Input
            inputMode="decimal"
            autoComplete="off"
            autoFocus={clickToEdit}
            placeholder={String(r.kmParsed)}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onBlur={() => {
              if (clickToEdit) setEditing(false)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
              if (e.key === 'Escape') {
                onChange('')
                setEditing(false)
              }
            }}
            className="h-9 w-20 text-right tabular-nums"
            aria-label={`KM ${r.tanggal}`}
          />
        ) : (
          <button
            onClick={() => setEditing(true)}
            title="Ketuk untuk koreksi KM"
            className="flex h-9 w-20 items-center justify-end gap-1 rounded-md border border-transparent hover:border-input hover:bg-muted px-2 text-right tabular-nums"
            aria-label={`Koreksi KM ${r.tanggal}, saat ini ${display} km`}
          >
            {display} <LuPencil className="size-3 shrink-0 text-muted-foreground" aria-hidden />
          </button>
        )}
        {r.edited && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-muted-foreground"
            onClick={onReset}
            title={`Kembalikan ke ${r.kmParsed} km`}
            aria-label={`Reset KM ${r.tanggal}`}
          >
            <LuRotateCcw className="size-3.5" aria-hidden />
          </Button>
        )}
      </div>
      {r.edited && <div className="text-[11px] text-muted-foreground">asli {r.kmParsed}</div>}
    </div>
  )
}

/**
 * Sel BBM: tampil biaya (hasil rumus / isi aktual) + ikon edit, ketuk → RpInput.
 * Sama seperti KmCell: ukuran tetap supaya tidak layout shift.
 */
function BbmCell({
  row: r,
  value,
  onChange,
  onReset,
  clickToEdit,
  widthClass = 'w-24',
}: {
  row: TimelineRow
  value: string
  onChange: (digits: string) => void
  onReset: () => void
  clickToEdit: boolean
  widthClass?: string
}) {
  const [editing, setEditing] = React.useState(false)
  const showInput = !clickToEdit || editing
  const display = value.trim() !== '' ? formatRibuan(value) : formatRp(r.biayaBbm)

  return (
    <div>
      <div className="flex items-center justify-end gap-1">
        {showInput ? (
          <RpInput
            autoFocus={clickToEdit}
            placeholder={String(r.biayaBbm)}
            value={value}
            onChange={onChange}
            onBlur={() => {
              if (clickToEdit) setEditing(false)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
              if (e.key === 'Escape') {
                onChange('')
                setEditing(false)
              }
            }}
            className={`h-9 ${widthClass}`}
            aria-label={`Biaya BBM ${r.tanggal}`}
          />
        ) : (
          <button
            onClick={() => setEditing(true)}
            title="Ketuk untuk isi biaya BBM aktual"
            className={`flex h-9 items-center justify-end gap-1 rounded-md border border-transparent hover:border-input hover:bg-muted px-2 text-right tabular-nums ${widthClass}`}
            aria-label={`Isi BBM aktual ${r.tanggal}, saat ini ${display}`}
          >
            {display} <LuPencil className="size-3 shrink-0 text-muted-foreground" aria-hidden />
          </button>
        )}
        {r.bbmEdited && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-muted-foreground"
            onClick={onReset}
            title="Kembali ke hasil rumus"
            aria-label={`Reset BBM ${r.tanggal}`}
          >
            <LuRotateCcw className="size-3.5" aria-hidden />
          </Button>
        )}
      </div>
      {r.bbmEdited && <div className="text-[11px] text-muted-foreground">aktual SPBU</div>}
    </div>
  )
}

function ModeBadges({ row }: { row: TimelineRow }) {
  const parts: { icon: React.ReactNode; value: number }[] = []
  if (row.rincian.motor > 0)
    parts.push({ icon: <LuBike className="size-3" aria-hidden />, value: row.rincian.motor })
  if (row.rincian.mobil > 0)
    parts.push({ icon: <LuCar className="size-3" aria-hidden />, value: row.rincian.mobil })
  if (row.rincian.jalan > 0)
    parts.push({ icon: <LuFootprints className="size-3" aria-hidden />, value: row.rincian.jalan })
  if (row.rincian.lain > 0)
    parts.push({ icon: <LuPlus className="size-3" aria-hidden />, value: row.rincian.lain })
  if (parts.length === 0) return <div className="text-[11px] text-muted-foreground">tanpa pergerakan</div>
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground tabular-nums">
      {parts.map((p, i) => (
        <span key={i} className="inline-flex items-center gap-1">
          {p.icon} {p.value}
        </span>
      ))}
    </div>
  )
}

function IncomeInputs({
  tanggal,
  multi,
  platforms,
  kotorEdit,
  platEdit,
  setKotorEdit,
  setPlatEdit,
}: {
  tanggal: string
  multi: boolean
  platforms: Platform[]
  kotorEdit: Record<string, string>
  platEdit: Record<string, Record<string, string>>
  setKotorEdit: React.Dispatch<React.SetStateAction<Record<string, string>>>
  setPlatEdit: React.Dispatch<React.SetStateAction<Record<string, Record<string, string>>>>
}) {
  if (!multi) {
    return (
      <RpInput
        placeholder="0"
        value={kotorEdit[tanggal] ?? ''}
        onChange={(digits) => setKotorEdit((p) => ({ ...p, [tanggal]: digits }))}
        className="h-9 w-28 placeholder:text-muted-foreground/60"
        aria-label={`Pendapatan ${tanggal}`}
      />
    )
  }
  return (
    <div className="space-y-1">
      {platforms.map((p) => (
        <div key={p} className="flex items-center justify-end gap-1">
          <Label className="text-[11px] text-muted-foreground">{PLATFORM_LABEL[p]}</Label>
          <RpInput
            placeholder="0"
            value={platEdit[tanggal]?.[p] ?? ''}
            onChange={(digits) =>
              setPlatEdit((prev) => ({
                ...prev,
                [tanggal]: { ...prev[tanggal], [p]: digits },
              }))
            }
            className="h-8 w-24 placeholder:text-muted-foreground/60"
            aria-label={`${PLATFORM_LABEL[p]} ${tanggal}`}
          />
        </div>
      ))}
    </div>
  )
}

function DayCard({
  row: r,
  highlight,
  withIncome,
  filled,
  kmValue,
  onKmChange,
  onResetKm,
  bbmValue,
  onBbmChange,
  onResetBbm,
  incomeSlot,
  extras,
  onExtrasChange,
}: {
  row: TimelineRow
  highlight: boolean
  withIncome: boolean
  filled: boolean
  kmValue: string
  onKmChange: (v: string) => void
  onResetKm: () => void
  bbmValue: string
  onBbmChange: (digits: string) => void
  onResetBbm: () => void
  incomeSlot: React.ReactNode
  extras: ExtraExpense[]
  onExtrasChange: (next: ExtraExpense[]) => void
}) {
  const [showExtra, setShowExtra] = React.useState(false)
  const keluarNonIncome = r.biayaBbm + r.extra
  return (
    <Card className={`py-3 gap-2 ${highlight ? 'border-amber-500/50' : ''}`}>
      <CardContent className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1">
            <DateCell tanggal={r.tanggal} />
            <MapsIconLink maps={r.maps} tanggal={r.tanggal} />
          </div>
          <span className="text-[11px] text-muted-foreground">{r.keterangan}</span>
        </div>
        <details className="text-[11px]">
          <summary className="cursor-pointer text-muted-foreground">Rincian moda</summary>
          <div className="mt-0.5 space-y-1">
            <ModeBadges row={r} />
            <MapsDetailLink maps={r.maps} tanggal={r.tanggal} compact />
          </div>
        </details>
        <div className={`grid gap-2 ${withIncome ? 'grid-cols-2' : 'grid-cols-1'}`}>
          <div className="space-y-1">
            <Label className="text-[11px] text-muted-foreground">KM motor</Label>
            <div className="flex items-center gap-1">
              <Input
                inputMode="decimal"
                autoComplete="off"
                placeholder={String(r.kmParsed)}
                value={kmValue}
                onChange={(e) => onKmChange(e.target.value)}
                className="h-10 text-right tabular-nums"
                aria-label={`KM ${r.tanggal}`}
              />
              {kmValue.trim() !== '' && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0 text-muted-foreground"
                  onClick={onResetKm}
                  title={`Kembalikan ke ${r.kmParsed} km`}
                  aria-label={`Reset KM ${r.tanggal}`}
                >
                  <LuRotateCcw className="size-4" aria-hidden />
                </Button>
              )}
            </div>
            {kmValue.trim() !== '' && (
              <div className="text-[11px] text-muted-foreground">asli {r.kmParsed} km</div>
            )}
            {r.jamFiltered && (
              <div className="flex items-center gap-1 text-[11px] text-muted-foreground tabular-nums">
                <LuClock className="size-3" aria-hidden />
                {r.km} km di jam filter (penuh {r.kmParsed} km)
              </div>
            )}
          </div>
          {withIncome && (
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">Pendapatan (Rp)</Label>
              {incomeSlot}
            </div>
          )}
        </div>
        <div className="grid grid-cols-3 gap-2 rounded-lg bg-muted/60 p-2 text-center">
          <div>
            <div className="text-[11px] text-muted-foreground">Liter</div>
            <div className="font-bold tabular-nums">{r.liter}</div>
          </div>
          <div>
            <div className="text-[11px] text-muted-foreground">BBM</div>
            <BbmCell
              row={r}
              value={bbmValue}
              onChange={onBbmChange}
              onReset={onResetBbm}
              clickToEdit
              widthClass="w-full"
            />
          </div>
          <div>
            <div className="text-[11px] text-muted-foreground">{withIncome ? 'Bersih' : 'Keluar'}</div>
            {withIncome && !filled ? (
              <div className="text-xs text-muted-foreground pt-0.5">belum diisi</div>
            ) : (
              <div className="font-bold tabular-nums text-xs pt-0.5">
                {formatRp(withIncome ? r.bersih : keluarNonIncome)}
              </div>
            )}
          </div>
        </div>
        <div className="rounded-lg border px-2 py-1.5">
          <button
            onClick={() => setShowExtra((v) => !v)}
            aria-expanded={showExtra}
            className="flex w-full items-center justify-between gap-2 text-xs"
          >
            <span className="inline-flex items-center gap-1 text-muted-foreground">
              <LuPlus className="size-3.5" aria-hidden /> Extra{' '}
              {extras.length > 0 && <b className="text-foreground tabular-nums">{formatRp(r.extra)}</b>}
              {extras.length === 0 && <span className="tabular-nums"> —</span>}
            </span>
            <span className="inline-flex items-center gap-0.5 text-muted-foreground">
              {showExtra ? <LuChevronDown className="size-3.5" aria-hidden /> : <LuChevronRight className="size-3.5" aria-hidden />}
              {showExtra ? 'tutup' : 'kelola'}
            </span>
          </button>
          {showExtra && (
            <div className="pt-1.5">
              <ExtraExpenseEditor tanggal={r.tanggal} value={extras} onChange={onExtrasChange} />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function formatDate(iso: string): string {
  try {
    return new Date(`${iso}T00:00:00`).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  } catch {
    return iso
  }
}
