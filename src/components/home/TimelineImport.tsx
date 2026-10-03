import * as React from 'react'
import { FileJson, Upload } from 'lucide-react'
import { formatRp } from '~/lib/calc'
import { saveTimelineImport } from '~/lib/daily-log'
import { computeTimelineRows } from '~/lib/timeline-import'
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

const MAX_FILE_BYTES = 300 * 1024 * 1024

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

  const [kmPerLiter, setKmPerLiter] = React.useState('')
  const [hargaBbm, setHargaBbm] = React.useState('10000')
  const [kmEdit, setKmEdit] = React.useState<Record<string, string>>({})
  const [kotorEdit, setKotorEdit] = React.useState<Record<string, string>>({})
  const [platEdit, setPlatEdit] = React.useState<Record<string, Record<string, string>>>({})

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
    setKotorEdit({})
    setPlatEdit({})
  }

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
        kotorPerTanggal,
        withIncome,
      }),
    [days, kmEdit, kmPerLiter, hargaBbm, kotorPerTanggal, withIncome],
  )

  const simpan = () => {
    const n = saveTimelineImport(
      ws.id,
      rows.map((r) => ({
        tanggal: r.tanggal,
        km: r.km,
        kotor: withIncome ? r.pendapatan : 0,
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
      setTimeout(() => setSaved(false), 2500)
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

        <details className="text-xs text-muted-foreground">
          <summary className="cursor-pointer">Cara dapat file JSON-nya</summary>
          <ol className="mt-1 list-decimal pl-4 space-y-0.5">
            <li>
              Buka <b>Google Takeout</b> → pilih <b>Location History (Timeline)</b> → export JSON.
            </li>
            <li>Download hasilnya, lalu upload file JSON-nya di sini.</li>
            <li>File dibaca di HP ini saja, tidak dikirim ke mana pun.</li>
          </ol>
        </details>
      </div>
    )
  }

  const hasilLabel = withIncome ? 'Bersih' : 'Keluar (BBM)'

  return (
    <div className="space-y-4">
      <Card className="py-3">
        <CardContent className="flex items-center gap-2 text-sm">
          <FileJson className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          <span className="min-w-0 flex-1 truncate font-medium">{fileName}</span>
          <Badge variant="secondary">
            {totals.days} hari
          </Badge>
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
          <CardTitle className="text-base">Efisiensi & harga (berlaku semua hari)</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3">
          <CalcField
            label="Konsumsi motor"
            value={kmPerLiter}
            onChange={setKmPerLiter}
            inputMode="decimal"
            suffix="km/L"
            placeholder="cth 45"
          />
          <CalcField label="Harga BBM" value={hargaBbm} onChange={setHargaBbm} suffix="Rp" />
        </CardContent>
      </Card>

      <Card className="py-3">
        <CardContent className="space-y-1">
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-sm text-muted-foreground">Total {hasilLabel.toLowerCase()}</p>
            <Badge variant={totals.totalBersih >= 0 || !withIncome ? 'secondary' : 'destructive'}>
              {totals.days} hari • {totals.totalKm} km
            </Badge>
          </div>
          <p className="text-3xl font-bold tabular-nums tracking-tight">
            {formatRp(withIncome ? totals.totalBersih : totals.totalBiaya)}
          </p>
          {withIncome && (
            <p className="text-xs text-muted-foreground tabular-nums">
              Masuk {formatRp(totals.totalPendapatan)} • BBM {formatRp(totals.totalBiaya)}
            </p>
          )}
        </CardContent>
      </Card>

      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full min-w-[640px] text-sm tabular-nums">
          <thead>
            <tr className="bg-muted text-left text-xs text-muted-foreground">
              <th className="px-2 py-2 font-medium">Tanggal</th>
              <th className="px-2 py-2 font-medium text-right">KM</th>
              <th className="px-2 py-2 font-medium text-right">Liter</th>
              <th className="px-2 py-2 font-medium text-right">Biaya BBM</th>
              {withIncome && <th className="px-2 py-2 font-medium text-right">Pendapatan</th>}
              <th className="px-2 py-2 font-medium text-right">{hasilLabel}</th>
              <th className="px-2 py-2 font-medium">Keterangan</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.tanggal} className="border-t align-top">
                <td className="px-2 py-1.5 whitespace-nowrap">
                  <div className="font-medium">{formatDate(r.tanggal)}</div>
                  <div className="text-[11px] text-muted-foreground">
                    mbl {r.rincian.mobil} • jln {r.rincian.jalan}
                    {r.rincian.lain > 0 ? ` • lain ${r.rincian.lain}` : ''}
                  </div>
                </td>
                <td className="px-2 py-1.5 text-right">
                  <Input
                    inputMode="decimal"
                    autoComplete="off"
                    placeholder={String(r.kmParsed)}
                    value={kmEdit[r.tanggal] ?? ''}
                    onChange={(e) => setKmEdit((p) => ({ ...p, [r.tanggal]: e.target.value }))}
                    className="h-9 w-20 text-right tabular-nums"
                    aria-label={`KM ${r.tanggal}`}
                  />
                  {r.edited && (
                    <div className="text-[11px] text-muted-foreground">asli {r.kmParsed}</div>
                  )}
                </td>
                <td className="px-2 py-1.5 text-right">{r.liter}</td>
                <td className="px-2 py-1.5 text-right">{formatRp(r.biayaBbm)}</td>
                {withIncome && (
                  <td className="px-2 py-1.5 text-right">
                    {!multi ? (
                      <Input
                        inputMode="numeric"
                        autoComplete="off"
                        placeholder="0"
                        value={kotorEdit[r.tanggal] ?? ''}
                        onChange={(e) => setKotorEdit((p) => ({ ...p, [r.tanggal]: e.target.value }))}
                        className="h-9 w-24 text-right tabular-nums"
                        aria-label={`Pendapatan ${r.tanggal}`}
                      />
                    ) : (
                      <div className="space-y-1">
                        {ws.platforms.map((p) => (
                          <div key={p} className="flex items-center justify-end gap-1">
                            <Label className="text-[11px] text-muted-foreground">
                              {PLATFORM_LABEL[p]}
                            </Label>
                            <Input
                              inputMode="numeric"
                              autoComplete="off"
                              placeholder="0"
                              value={platEdit[r.tanggal]?.[p] ?? ''}
                              onChange={(e) =>
                                setPlatEdit((prev) => ({
                                  ...prev,
                                  [r.tanggal]: { ...prev[r.tanggal], [p]: e.target.value },
                                }))
                              }
                              className="h-8 w-20 text-right tabular-nums"
                              aria-label={`${PLATFORM_LABEL[p]} ${r.tanggal}`}
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </td>
                )}
                <td className="px-2 py-1.5 text-right font-bold">
                  {formatRp(withIncome ? r.bersih : r.biayaBbm)}
                </td>
                <td className="px-2 py-1.5 text-xs text-muted-foreground whitespace-nowrap">
                  {r.keterangan}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t bg-muted/50 font-bold">
              <td className="px-2 py-2">Total</td>
              <td className="px-2 py-2 text-right">{totals.totalKm}</td>
              <td className="px-2 py-2 text-right">{totals.totalLiter}</td>
              <td className="px-2 py-2 text-right">{formatRp(totals.totalBiaya)}</td>
              {withIncome && <td className="px-2 py-2 text-right">{formatRp(totals.totalPendapatan)}</td>}
              <td className="px-2 py-2 text-right">
                {formatRp(withIncome ? totals.totalBersih : totals.totalBiaya)}
              </td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>

      <Button size="lg" className="w-full text-base font-bold" onClick={simpan}>
        {saved ? 'Tersimpan ✓' : `Simpan ${totals.days} hari ke log`}
      </Button>

      <details className="text-xs text-muted-foreground">
        <summary className="cursor-pointer">Rumus per baris</summary>
        <p className="mt-1">
          Liter = KM / konsumsi; BBM = liter × harga; Bersih = pendapatan − BBM.
          KM default = motor hasil parse, bisa diketik ulang bila aneh.
        </p>
      </details>
    </div>
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
