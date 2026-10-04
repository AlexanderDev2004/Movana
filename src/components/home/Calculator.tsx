import * as React from 'react'
import { Link } from '@tanstack/react-router'
import { LuArrowLeft, LuFuel, LuGauge, LuKeyboard, LuMapPinned, LuPlus, LuWallet } from 'react-icons/lu'
import { formatRp, hitungHarian } from '~/lib/calc'
import type { Platform } from '~/lib/calc'
import type { Workspace } from '~/lib/workspace'
import {
  PLATFORM_LABEL,
  isMultiPlatform,
  tracksIncome,
  workspaceSubtitle,
} from '~/lib/workspace'
import { saveManualLog } from '~/lib/daily-log'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import { CalcField } from './CalcField'
import { CalcResults } from './CalcResults'
import { TimelineImport } from './TimelineImport'

export function Calculator({
  ws,
  workspaces,
  onSwitch,
  onCreate,
  onBack,
}: {
  ws: Workspace
  workspaces: Workspace[]
  onSwitch: (id: string) => void
  onCreate: () => void
  onBack: () => void
}) {
  const multi = isMultiPlatform(ws)
  const withIncome = tracksIncome(ws)

  const [odoAwal, setOdoAwal] = React.useState('')
  const [odoAkhir, setOdoAkhir] = React.useState('')
  const [kmPerLiter, setKmPerLiter] = React.useState('')
  const [hargaBbm, setHargaBbm] = React.useState('10000')
  const [kotor, setKotor] = React.useState('250000')
  const [perPlatform, setPerPlatform] = React.useState<Record<string, string>>({})
  const [biayaLain, setBiayaLain] = React.useState('15000')
  const [saved, setSaved] = React.useState(false)
  const [saveError, setSaveError] = React.useState<string | null>(null)
  const [mode, setMode] = React.useState<'odo' | 'timeline'>('odo')

  const totalKotorMulti = multi
    ? ws.platforms.reduce((a, p) => a + (Number(perPlatform[p] ?? 0) || 0), 0)
    : 0
  const kotorEfektif = !withIncome ? 0 : multi ? totalKotorMulti : Number(kotor) || 0

  const { hasil, error } = React.useMemo(() => {
    try {
      const r = hitungHarian({
        odoAwal: Number(odoAwal),
        odoAkhir: Number(odoAkhir),
        kmPerLiter: Number(kmPerLiter),
        hargaBbmPerLiter: Number(hargaBbm),
        pendapatanKotor: kotorEfektif,
        biayaLain: Number(biayaLain),
      })
      return { hasil: r, error: null as string | null }
    } catch (e) {
      return { hasil: null, error: e instanceof Error ? e.message : 'Input tidak valid' }
    }
  }, [odoAwal, odoAkhir, kmPerLiter, hargaBbm, kotorEfektif, biayaLain])

  const shownError = error ?? saveError
  const kmPreview =
    odoAwal !== '' && odoAkhir !== '' && Number(odoAkhir) >= Number(odoAwal)
      ? Number(odoAkhir) - Number(odoAwal)
      : null

  const simpanKeLog = () => {
    if (!hasil) {
      setSaveError('Lengkapi odometer & konsumsi dulu sebelum menyimpan')
      return
    }
    const ok = saveManualLog(ws.id, {
      odoAwal: Number(odoAwal),
      odoAkhir: Number(odoAkhir),
      kotor: kotorEfektif,
      biayaBensin: hasil.biayaBensin,
      biayaLain: Math.round(Number(biayaLain) || 0),
      rincian:
        multi && withIncome
          ? ws.platforms.map((p) => ({ platform: p, jumlah: Number(perPlatform[p] ?? 0) || 0 }))
          : undefined,
    })
    if (ok) {
      setSaved(true)
      setSaveError(null)
    } else {
      setSaveError('Gagal menyimpan ke log harian')
    }
  }

  const incomeLabel =
    ws.role === 'ojol'
      ? multi
        ? 'Pendapatan per platform'
        : `Kotor ${PLATFORM_LABEL[ws.platforms[0] ?? 'lainnya']}`
      : 'Pendapatan manual'

  const perPlatformSummary =
    withIncome && multi
      ? ws.platforms
          .map((p) => `${PLATFORM_LABEL[p]}: ${formatRp(Number(perPlatform[p] ?? 0) || 0)}`)
          .join(' • ')
      : null

  return (
    <div className="max-w-xl mx-auto p-4 pb-28 space-y-4">
      <header className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={onBack}>
          <LuArrowLeft aria-hidden /> Semua
        </Button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold truncate">{ws.name}</h1>
            <RoleBadge ws={ws} />
          </div>
          <p className="text-xs text-muted-foreground truncate">{workspaceSubtitle(ws)}</p>
        </div>
        {workspaces.length > 1 && (
          <select
            className="border-input rounded-md border bg-transparent px-2 py-2 text-sm max-w-[130px]"
            value={ws.id}
            onChange={(e) => onSwitch(e.target.value)}
            title="Ganti workspace"
          >
            {workspaces.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
        )}
        <Button variant="outline" size="sm" onClick={onCreate} title="Buat workspace baru">
          <LuPlus aria-hidden /> Baru
        </Button>
      </header>

      <div className="grid grid-cols-2 gap-1 rounded-xl bg-muted p-1" role="tablist" aria-label="Mode hitung">
        <Button variant={mode === 'odo' ? 'default' : 'ghost'} onClick={() => setMode('odo')} role="tab" aria-selected={mode === 'odo'}>
          <LuKeyboard aria-hidden /> Odo manual
        </Button>
        <Button variant={mode === 'timeline' ? 'default' : 'ghost'} onClick={() => setMode('timeline')} role="tab" aria-selected={mode === 'timeline'}>
          <LuMapPinned aria-hidden /> Import Timeline
        </Button>
      </div>

      {mode === 'timeline' ? (
        <TimelineImport ws={ws} />
      ) : (
        <>

      <Card>
        <CardHeader>
          <SectionTitle
            step="1"
            icon={<LuGauge className="size-4" aria-hidden />}
            title="Odometer hari ini"
            right={kmPreview !== null ? <Badge variant="secondary">{kmPreview} km</Badge> : null}
          />
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <CalcField label="Pagi" value={odoAwal} onChange={setOdoAwal} suffix="km" placeholder="0" />
            <CalcField label="Malam" value={odoAkhir} onChange={setOdoAkhir} suffix="km" placeholder="0" />
          </div>
          <CalcField
            label="Konsumsi motor"
            value={kmPerLiter}
            onChange={setKmPerLiter}
            inputMode="decimal"
            suffix="km/L"
            placeholder="cth 45"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <SectionTitle step="2" icon={<LuFuel className="size-4" aria-hidden />} title="Bensin & biaya" />
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3">
            <CalcField label="Harga BBM" value={hargaBbm} onChange={setHargaBbm} suffix="Rp" />
            <CalcField label="Biaya lain" value={biayaLain} onChange={setBiayaLain} suffix="Rp" hint="Parkir/makan" />
          </div>
        </CardContent>
      </Card>

      {withIncome ? (
        <Card>
          <CardHeader>
            <SectionTitle
              step="3"
              icon={<LuWallet className="size-4" aria-hidden />}
              title={incomeLabel}
              right={multi ? <Badge variant="secondary">{formatRp(totalKotorMulti)}</Badge> : null}
            />
          </CardHeader>
          <CardContent>
            {!multi && (
              <CalcField label="Kotor hari ini" value={kotor} onChange={setKotor} suffix="Rp" />
            )}
            {multi && (
              <div className="space-y-2">
                {ws.platforms.map((p: Platform) => (
                  <div key={p} className="flex items-center gap-2">
                    <Label className="w-28 shrink-0">{PLATFORM_LABEL[p]}</Label>
                    <div className="relative flex-1">
                      <Input
                        inputMode="numeric"
                        autoComplete="off"
                        placeholder="0"
                        value={perPlatform[p] ?? ''}
                        onChange={(e) => setPerPlatform((prev) => ({ ...prev, [p]: e.target.value }))}
                        className="h-12 text-lg tabular-nums pr-12"
                      />
                      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                        Rp
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card className="py-3">
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Mode {ws.jobType === 'komuter' ? 'komuter' : 'motor pribadi'} tanpa pendapatan — hasil di
              bawah adalah pengeluaran harian.
            </p>
          </CardContent>
        </Card>
      )}

      {shownError && (
        <p className="rounded-xl bg-destructive/10 border border-destructive/30 text-destructive text-sm p-3">
          {shownError}
        </p>
      )}

      {hasil && (
        <CalcResults hasil={hasil} withIncome={withIncome} perPlatformSummary={perPlatformSummary} />
      )}

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
        <summary className="cursor-pointer">Rumus hitungan</summary>
        <p className="mt-1">
          KM = malam − pagi; Liter = KM / konsumsi; Bensin = liter × harga;{' '}
          {withIncome ? 'Bersih = kotor − (bensin + lain).' : 'Keluar = bensin + lain.'}
        </p>
      </details>

      <div className="fixed bottom-0 inset-x-0 border-t bg-background/95 backdrop-blur p-3">
        <div className="max-w-xl mx-auto">
          <Button
            size="lg"
            className="w-full text-base font-bold"
            onClick={simpanKeLog}
          >
            {saved ? 'Tersimpan' : `Simpan${hasil ? ` • ${formatRp(withIncome ? hasil.bersih : hasil.totalBiaya)}` : ''}`}
          </Button>
        </div>
      </div>
        </>
      )}
    </div>
  )
}

function SectionTitle({
  step,
  icon,
  title,
  right,
}: {
  step: string
  icon?: React.ReactNode
  title: string
  right?: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-2">
        <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center">
          {step}
        </span>
        <CardTitle className="flex items-center gap-1.5">
          {icon}
          {title}
        </CardTitle>
      </div>
      {right}
    </div>
  )
}

function RoleBadge({ ws }: { ws: Workspace }) {
  const label =
    ws.role === 'ojol'
      ? ws.platforms.length > 1
        ? 'Multi'
        : (PLATFORM_LABEL[ws.platforms[0] ?? 'lainnya'] ?? 'Ojol')
      : (ws.jobType ?? 'Pribadi')
  return <Badge variant="secondary">{label}</Badge>
}
