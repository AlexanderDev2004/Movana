import * as React from 'react'
import { Link } from '@tanstack/react-router'
import { FileJson, Upload } from 'lucide-react'
import { formatRp } from '~/lib/calc'
import type { Platform } from '~/lib/calc'
import { saveTimelineImport } from '~/lib/daily-log'
import {
  computeTimelineRows,
  dayShortId,
  filterTimelineRows,
  isWeekendDay,
} from '~/lib/timeline-import'
import type { TimelineFilter, TimelineRow } from '~/lib/timeline-import'
import { hashText, parseTimelineJson } from '~/lib/timeline'
import type { DailyKm } from '~/lib/timeline'
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
  const [expanded, setExpanded] = React.useState<Record<string, boolean>>({})
  const [filter, setFilter] = React.useState<TimelineFilter>({
    minKm: DEFAULT_MIN_KM,
    weekdaysOnly: false,
    filledOnly: false,
  })
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
    setExpanded({})
    setFilter({ minKm: DEFAULT_MIN_KM, weekdaysOnly: false, filledOnly: false })
    setShowBulk(false)
    setBulkAmount('')
  }

  const resetKm = (tanggal: string) =>
    setKmEdit((p) => {
      if (!(tanggal in p)) return p
      const next = { ...p }
      delete next[tanggal]
      return next
    })

  const toggleExpand = (tanggal: string) => setExpanded((p) => ({ ...p, [tanggal]: !p[tanggal] }))

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

  const { rows, totals } = React.useMemo(
    () =>
      computeTimelineRows(days ?? [], {
        kmEdit,
        kmPerLiter: Number(kmPerLiter),
        hargaBbm: Number(hargaBbm),
        bbmEdit,
        kotorPerTanggal,
        withIncome,
      }),
    [days, kmEdit, kmPerLiter, hargaBbm, bbmEdit, kotorPerTanggal, withIncome],
  )

  const visible = React.useMemo(() => filterTimelineRows(rows, filter, isFilled), [rows, filter, isFilled])

  const avgKm = totals.days > 0 ? totals.totalKm / totals.days : 0
  const filledRows = withIncome ? rows.filter((r) => isFilled(r.tanggal)) : []
  const bersihFilled = filledRows.reduce((a, r) => a + r.bersih, 0)
  const masukFilled = filledRows.reduce((a, r) => a + r.pendapatan, 0)
  const visibleFilled = withIncome ? visible.filter((r) => isFilled(r.tanggal)) : []

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
      rows.map((r) => ({
        tanggal: r.tanggal,
        km: r.km,
        kotor: withIncome ? r.pendapatan : 0,
        biayaBensin: r.biayaBbm,
        rincianKm: r.rincian,
        rincian:
          multi && withIncome
            ? ws.platforms.map((p) => ({ platform: p, jumlah: Number(platEdit[r.tanggal]?.[p]) || 0 }))
            : undefined,
      })),
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
            <Upload className="size-8 mx-auto text-muted-foreground" aria-hidden />
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

  const hasilLabel = withIncome ? 'Bersih' : 'Keluar'
  const detail = view === 'detail'
  const footPendapatan = visible.reduce((a, r) => a + r.pendapatan, 0)
  const footBiaya = visible.reduce((a, r) => a + r.biayaBbm, 0)
  const colSpan = (detail ? 7 : 5) - (withIncome ? 0 : 1)

  return (
    <div className="space-y-4">
      <Card className="py-3">
        <CardContent className="flex items-center gap-2 text-sm">
          <FileJson className="size-4 shrink-0 text-muted-foreground" aria-hidden />
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
            <p className="rounded-lg bg-amber-500/10 border border-amber-500/30 text-xs p-2">
              ⚠️ Tidak biasa untuk motor (normal 35–50 km/L). Cek lagi angkanya.
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">Berlaku ke semua {totals.days} hari.</p>
          )}
        </CardContent>
      </Card>

      {/* Filter cepat */}
      <Card className="py-3">
        <CardContent className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-bold">
              Menampilkan {visible.length} dari {totals.days} hari
            </p>
            {(filter.minKm !== 0 || filter.weekdaysOnly || filter.filledOnly) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setFilter({ minKm: 0, weekdaysOnly: false, filledOnly: false })}
              >
                Tampilkan semua
              </Button>
            )}
          </div>
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

      {/* Kartu total */}
      <Card className="py-3">
        <CardContent className="space-y-1">
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-sm text-muted-foreground">
              {withIncome ? `Bersih · ${filledRows.length} hari terisi` : 'Keluar (BBM)'}
            </p>
            <Badge variant="secondary">rata-rata {Math.round(avgKm)} km/hari</Badge>
          </div>
          <p
            className={`text-3xl font-bold tabular-nums tracking-tight ${
              withIncome && filledRows.length === 0 ? 'text-muted-foreground' : ''
            }`}
          >
            {withIncome
              ? filledRows.length > 0
                ? formatRp(bersihFilled)
                : 'belum ada pendapatan'
              : formatRp(totals.totalBiaya)}
          </p>
          {withIncome && (
            <p className="text-xs text-muted-foreground tabular-nums">
              Masuk {formatRp(masukFilled)} ({filledRows.length} hari) • BBM semua {totals.days} hari{' '}
              {formatRp(totals.totalBiaya)}
            </p>
          )}
        </CardContent>
      </Card>

      {withIncome && (
        <div>
          {!showBulk ? (
            <Button variant="outline" size="sm" onClick={() => setShowBulk(true)}>
              ⚡ Isi pendapatan massal
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

      {/* Tampilan kartu (layar kecil) */}
      <div className="md:hidden space-y-2">
        {visible.map((r) => (
          <DayCard
            key={r.tanggal}
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
        ))}
      </div>

      {/* Tampilan tabel (layar ≥ md) */}
      <div className="hidden md:block overflow-x-auto rounded-xl border">
        <table
          className={`w-full text-sm tabular-nums ${detail ? 'min-w-[720px]' : 'min-w-[560px]'}`}
        >
          <thead>
            <tr className="bg-muted text-left text-xs text-muted-foreground">
              <th className="px-2 py-2 font-medium">Tanggal</th>
              <th className="px-2 py-2 font-medium text-right">KM</th>
              {detail && <th className="px-2 py-2 font-medium text-right">Liter</th>}
              <th className="px-2 py-2 font-medium text-right" title="Biaya BBM">
                BBM
              </th>
              {withIncome && <th className="px-2 py-2 font-medium text-right">Pendapatan</th>}
              <th className="px-2 py-2 font-medium text-right whitespace-nowrap">{hasilLabel}</th>
              {detail && <th className="px-2 py-2 font-medium">Keterangan</th>}
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => (
              <React.Fragment key={r.tanggal}>
                <tr className={`border-t ${r.km > avgKm && avgKm > 0 ? 'bg-amber-500/[0.07]' : ''}`}>
                  <td className="px-2 py-1.5 whitespace-nowrap">
                    <div className="flex items-center gap-1">
                      {!detail && (
                        <button
                          onClick={() => toggleExpand(r.tanggal)}
                          className="text-muted-foreground hover:text-foreground text-sm leading-none w-4"
                          aria-expanded={!!expanded[r.tanggal]}
                          aria-label={expanded[r.tanggal] ? `Tutup rincian ${r.tanggal}` : `Buka rincian ${r.tanggal}`}
                        >
                          {expanded[r.tanggal] ? '▾' : '▸'}
                        </button>
                      )}
                      <DateCell tanggal={r.tanggal} />
                    </div>
                    {detail && <ModeBadges row={r} />}
                  </td>
                  <td className="px-2 py-1.5 text-right whitespace-nowrap">
                    <KmCell
                      row={r}
                      value={kmEdit[r.tanggal] ?? ''}
                      onChange={(v) => setKmEdit((p) => ({ ...p, [r.tanggal]: v }))}
                      onReset={() => resetKm(r.tanggal)}
                      clickToEdit={!detail}
                    />
                  </td>
                  {detail && <td className="px-2 py-1.5 text-right whitespace-nowrap">{r.liter}</td>}
                  <td className="px-2 py-1.5 text-right whitespace-nowrap">
                    <BbmCell
                      row={r}
                      value={bbmEdit[r.tanggal] ?? ''}
                      onChange={(digits) => setBbmEdit((p) => ({ ...p, [r.tanggal]: digits }))}
                      onReset={() =>
                        setBbmEdit((p) => {
                          if (!(r.tanggal in p)) return p
                          const next = { ...p }
                          delete next[r.tanggal]
                          return next
                        })
                      }
                      clickToEdit={!detail}
                    />
                  </td>
                  {withIncome && (
                    <td className="px-2 py-1.5 text-right">
                      <IncomeInputs
                        tanggal={r.tanggal}
                        multi={multi}
                        platforms={ws.platforms}
                        kotorEdit={kotorEdit}
                        platEdit={platEdit}
                        setKotorEdit={setKotorEdit}
                        setPlatEdit={setPlatEdit}
                      />
                    </td>
                  )}
                  <td className="px-2 py-1.5 text-right whitespace-nowrap">
                    {withIncome && !isFilled(r.tanggal) ? (
                      <span className="text-muted-foreground font-normal text-xs">belum diisi</span>
                    ) : (
                      <span className="font-bold">{formatRp(withIncome ? r.bersih : r.biayaBbm)}</span>
                    )}
                  </td>
                  {detail && (
                    <td className="px-2 py-1.5 text-xs text-muted-foreground whitespace-nowrap">
                      {r.keterangan}
                    </td>
                  )}
                </tr>
                {!detail && expanded[r.tanggal] && (
                  <tr className={r.km > avgKm && avgKm > 0 ? 'bg-amber-500/[0.07]' : ''}>
                    <td colSpan={colSpan} className="px-2 py-1.5 bg-muted/40">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                        <ModeBadges row={r} />
                        <span className="tabular-nums">Liter {r.liter}</span>
                        <span>{r.keterangan}</span>
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
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
                  formatRp(
                    withIncome
                      ? visible.reduce((a, r) => a + r.bersih, 0)
                      : footBiaya,
                  )
                )}
              </td>
              {detail && <td />}
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">
        Baris disorot = KM di atas rata-rata ({Math.round(avgKm)} km/hari). Ketuk angka KM
        untuk koreksi dan angka BBM untuk isi aktual SPBU (Esc = batal).
        {!detail && ' Ketuk ▸ di tanggal untuk rincian moda.'}
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
          Liter = KM / konsumsi; BBM = liter × harga; Bersih = pendapatan − BBM. KM default =
          motor hasil parse, BBM default = hasil rumus — keduanya bisa diketik ulang bila beda
          dengan struk SPBU (liter menyesuaikan otomatis). Filter hanya mengubah tampilan — yang disimpan
          tetap semua {totals.days} hari.
        </p>
      </details>
    </div>
  )
}

function DateCell({ tanggal }: { tanggal: string }) {
  const weekend = isWeekendDay(tanggal)
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
 * Sel KM: angka statis + ✏️ (klik → jadi input) di mode Ringkas,
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
            className="h-9 w-20 rounded-md border border-transparent hover:border-input hover:bg-muted px-2 text-right tabular-nums"
            aria-label={`Koreksi KM ${r.tanggal}, saat ini ${display} km`}
          >
            {display} <span className="text-xs text-muted-foreground">✏️</span>
          </button>
        )}
        {r.edited && (
          <button
            onClick={onReset}
            title={`Kembalikan ke ${r.kmParsed} km`}
            className="text-muted-foreground hover:text-foreground text-base leading-none px-0.5"
            aria-label={`Reset KM ${r.tanggal}`}
          >
            ↺
          </button>
        )}
      </div>
      {r.edited && <div className="text-[11px] text-muted-foreground">asli {r.kmParsed}</div>}
    </div>
  )
}

/**
 * Sel BBM: tampil biaya (hasil rumus / isi aktual) + ✏️, ketuk → RpInput.
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
            className={`h-9 rounded-md border border-transparent hover:border-input hover:bg-muted px-2 text-right tabular-nums ${widthClass}`}
            aria-label={`Isi BBM aktual ${r.tanggal}, saat ini ${display}`}
          >
            {display} <span className="text-xs text-muted-foreground">✏️</span>
          </button>
        )}
        {r.bbmEdited && (
          <button
            onClick={onReset}
            title="Kembali ke hasil rumus"
            className="text-muted-foreground hover:text-foreground text-base leading-none px-0.5"
            aria-label={`Reset BBM ${r.tanggal}`}
          >
            ↺
          </button>
        )}
      </div>
      {r.bbmEdited && <div className="text-[11px] text-muted-foreground">aktual SPBU</div>}
    </div>
  )
}

function ModeBadges({ row }: { row: TimelineRow }) {
  const parts: string[] = []
  if (row.rincian.motor > 0) parts.push(`🏍 ${row.rincian.motor}`)
  if (row.rincian.mobil > 0) parts.push(`🚗 ${row.rincian.mobil}`)
  if (row.rincian.jalan > 0) parts.push(`🚶 ${row.rincian.jalan}`)
  if (row.rincian.lain > 0) parts.push(`➕ ${row.rincian.lain}`)
  if (parts.length === 0) return <div className="text-[11px] text-muted-foreground">tanpa pergerakan</div>
  return <div className="text-[11px] text-muted-foreground tabular-nums">{parts.join(' • ')}</div>
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
}) {
  return (
    <Card className={`py-3 gap-2 ${highlight ? 'border-amber-500/50' : ''}`}>
      <CardContent className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <DateCell tanggal={r.tanggal} />
          <span className="text-[11px] text-muted-foreground">{r.keterangan}</span>
        </div>
        <details className="text-[11px]">
          <summary className="cursor-pointer text-muted-foreground">Rincian moda</summary>
          <ModeBadges row={r} />
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
                <button
                  onClick={onResetKm}
                  title={`Kembalikan ke ${r.kmParsed} km`}
                  className="text-muted-foreground hover:text-foreground text-lg leading-none px-1"
                  aria-label={`Reset KM ${r.tanggal}`}
                >
                  ↺
                </button>
              )}
            </div>
            {kmValue.trim() !== '' && (
              <div className="text-[11px] text-muted-foreground">asli {r.kmParsed} km</div>
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
                {formatRp(withIncome ? r.bersih : r.biayaBbm)}
              </div>
            )}
          </div>
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
