import { Badge } from '~/components/ui/badge'
import { Card, CardContent } from '~/components/ui/card'
import { formatRp } from '~/lib/calc'
import type { DailyCalcResult } from '~/lib/calc'

export function CalcResults({
  hasil,
  withIncome,
  perPlatformSummary,
}: {
  hasil: DailyCalcResult
  withIncome: boolean
  perPlatformSummary?: string | null
}) {
  const perKm = withIncome
    ? hasil.bersihPerKm
    : Math.round(hasil.totalBiaya / (hasil.totalKm || 1))
  const positif = hasil.bersih >= 0

  return (
    <div className="space-y-3">
      <Card className="bg-primary text-primary-foreground border-0 py-4">
        <CardContent className="space-y-1">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm opacity-70">{withIncome ? 'Bersih hari ini' : 'Keluar hari ini'}</p>
            <Badge variant={positif ? 'secondary' : 'destructive'}>{positif ? 'Plus' : 'Minus'}</Badge>
          </div>
          <p className="text-4xl font-bold tabular-nums tracking-tight">
            {formatRp(withIncome ? hasil.bersih : hasil.totalBiaya)}
          </p>
          <p className="text-sm opacity-70 tabular-nums">
            {hasil.totalKm} km • {formatRp(perKm)}/km {withIncome ? 'bersih' : 'biaya'}
          </p>
          {perPlatformSummary && <p className="text-xs opacity-60">{perPlatformSummary}</p>}
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-2">
        <Stat label="Jarak" value={`${hasil.totalKm} km`} />
        <Stat label="Bensin" value={`${hasil.liter} L`} sub={formatRp(hasil.biayaBensin)} />
        <Stat label="Total biaya" value={formatRp(hasil.totalBiaya)} />
        <Stat
          label={withIncome ? 'Bersih / km' : 'Biaya / km'}
          value={formatRp(perKm)}
          accent={withIncome && hasil.bersihPerKm >= 1000}
        />
      </div>
    </div>
  )
}

function Stat({
  label,
  value,
  sub,
  accent,
}: {
  label: string
  value: string
  sub?: string
  accent?: boolean
}) {
  return (
    <Card className={`py-3 gap-1 ${accent ? 'border-green-500' : ''}`}>
      <CardContent className="space-y-0.5">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="font-bold tabular-nums">{value}</div>
        {sub && <div className="text-xs text-muted-foreground tabular-nums">{sub}</div>}
      </CardContent>
    </Card>
  )
}
