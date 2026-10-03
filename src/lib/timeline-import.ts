import type { DailyKm } from './timeline'

export interface TimelineRowInput {
  /** Koreksi KM per tanggal (string input; kosong = pakai KM motor hasil parse) */
  kmEdit: Record<string, string>
  kmPerLiter: number
  hargaBbm: number
  /** Pendapatan per tanggal (untuk multi-platform: sudah dijumlah per hari) */
  kotorPerTanggal: Record<string, number>
  withIncome: boolean
}

export interface TimelineRow {
  tanggal: string
  /** KM motor hasil parse (sebelum koreksi) */
  kmParsed: number
  /** KM final (hasil koreksi atau parse) */
  km: number
  edited: boolean
  liter: number
  biayaBbm: number
  pendapatan: number
  /** pendapatan - biayaBbm (negatif = minus; untuk mode tanpa pendapatan abaikan) */
  bersih: number
  keterangan: string
  rincian: DailyKm['rincian']
}

export interface TimelineTotals {
  days: number
  totalKm: number
  totalLiter: number
  totalBiaya: number
  totalPendapatan: number
  totalBersih: number
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function buildKeterangan(row: Pick<TimelineRow, 'edited' | 'km' | 'bersih'>, withIncome: boolean): string {
  const notes: string[] = []
  if (row.edited) notes.push('✏️ koreksi')
  if (row.km === 0) notes.push('tanpa motor')
  if (withIncome && row.bersih < 0) notes.push('⚠️ minus')
  return notes.length > 0 ? notes.join(' • ') : '—'
}

/**
 * Hitung tabel import Timeline: KM (motor, bisa dikoreksi) -> liter -> biaya -> bersih.
 * Uang dalam Rupiah (integer, dibulatkan seperti `hitungHarian`).
 */
export function computeTimelineRows(
  days: DailyKm[],
  input: TimelineRowInput,
): { rows: TimelineRow[]; totals: TimelineTotals } {
  const validKpl = Number.isFinite(input.kmPerLiter) && input.kmPerLiter > 0
  const harga = Number.isFinite(input.hargaBbm) && input.hargaBbm >= 0 ? input.hargaBbm : 0

  const rows: TimelineRow[] = days.map((d) => {
    const kmParsed = d.rincian.motor
    const rawEdit = (input.kmEdit[d.tanggal] ?? '').trim()
    const edited = rawEdit !== ''
    const km = edited ? Math.max(0, Number(rawEdit) || 0) : kmParsed
    const literExact = validKpl && km > 0 ? km / input.kmPerLiter : 0
    const liter = round2(literExact)
    const biayaBbm = Math.round(literExact * harga)
    const pendapatan = input.withIncome ? Math.round(Number(input.kotorPerTanggal[d.tanggal]) || 0) : 0
    const bersih = pendapatan - biayaBbm
    const row: TimelineRow = {
      tanggal: d.tanggal,
      kmParsed,
      km: round2(km),
      edited,
      liter,
      biayaBbm,
      pendapatan,
      bersih,
      keterangan: '',
      rincian: d.rincian,
    }
    row.keterangan = buildKeterangan(row, input.withIncome)
    return row
  })

  const totals: TimelineTotals = {
    days: rows.length,
    totalKm: round2(rows.reduce((a, r) => a + r.km, 0)),
    totalLiter: round2(rows.reduce((a, r) => a + r.liter, 0)),
    totalBiaya: rows.reduce((a, r) => a + r.biayaBbm, 0),
    totalPendapatan: rows.reduce((a, r) => a + r.pendapatan, 0),
    totalBersih: rows.reduce((a, r) => a + r.bersih, 0),
  }

  return { rows, totals }
}
