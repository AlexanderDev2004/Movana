import type { DailyKm, DayMaps } from './timeline'

export interface TimelineRowInput {
  /** Koreksi KM per tanggal (string input; kosong = pakai KM motor hasil parse) */
  kmEdit: Record<string, string>
  kmPerLiter: number
  hargaBbm: number
  /** Biaya BBM aktual per tanggal, digit murni (kosong = dihitung dari KM) */
  bbmEdit?: Record<string, string>
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
  /** true bila biaya BBM diisi manual (bukan dari rumus KM) */
  bbmEdited: boolean
  pendapatan: number
  /** pendapatan - biayaBbm (negatif = minus; untuk mode tanpa pendapatan abaikan) */
  bersih: number
  keterangan: string
  rincian: DailyKm['rincian']
  /** Info rute harian untuk "Lihat di Maps" (diteruskan dari parse; tanpa koordinat di UI). */
  maps?: DayMaps
}

export interface TimelineTotals {
  days: number
  totalKm: number
  totalLiter: number
  totalBiaya: number
  totalPendapatan: number
  totalBersih: number
}

export interface TimelineFilter {
  /** Tampilkan hanya hari dengan KM final >= nilai ini (0 = semua) */
  minKm: number
  /** Hanya Senin–Jumat */
  weekdaysOnly: boolean
  /** Hanya hari yang pendapatannya sudah diisi */
  filledOnly: boolean
}

export const NO_FILTER: TimelineFilter = { minKm: 0, weekdaysOnly: false, filledOnly: false }

/** 0 = Minggu … 6 = Sabtu. -1 bila tanggal tidak valid */
export function weekdayOf(tanggal: string): number {
  const d = new Date(`${tanggal}T00:00:00`)
  const w = d.getDay()
  return Number.isFinite(w) ? w : -1
}

export function isWeekendDay(tanggal: string): boolean {
  const w = weekdayOf(tanggal)
  return w === 0 || w === 6
}

const DAY_SHORT_ID = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab']

export function dayShortId(tanggal: string): string {
  const w = weekdayOf(tanggal)
  return w >= 0 ? DAY_SHORT_ID[w] : ''
}

/** Filter tampilan (tidak mengubah data / hasil simpan).
 * minKm dibandingkan ke KM hasil parse (stabil) supaya baris tidak
 * "menghilang" saat user sedang mengetik koreksi KM. */
export function filterTimelineRows(
  rows: TimelineRow[],
  filter: TimelineFilter,
  isFilled: (tanggal: string) => boolean,
): TimelineRow[] {
  return rows.filter((r) => {
    const baseKm = Number.isFinite(r.kmParsed) ? r.kmParsed : r.km
    if (baseKm < filter.minKm) return false
    if (filter.weekdaysOnly && isWeekendDay(r.tanggal)) return false
    if (filter.filledOnly && !isFilled(r.tanggal)) return false
    return true
  })
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function buildKeterangan(
  row: Pick<TimelineRow, 'edited' | 'bbmEdited' | 'km' | 'bersih'>,
  withIncome: boolean,
): string {
  const notes: string[] = []
  if (row.edited) notes.push('✏️ koreksi')
  if (row.bbmEdited) notes.push('⛽ aktual')
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
    const rawBbm = (input.bbmEdit?.[d.tanggal] ?? '').trim()
    const bbmEdited = rawBbm !== ''
    // BBM aktual (misal struk SPBU) mengalahkan rumus; liter diturunkan balik dari harga.
    const biayaBbm = bbmEdited
      ? Math.max(0, Math.round(Number(rawBbm.replace(/[^\d]/g, '')) || 0))
      : Math.round(literExact * harga)
    const liter = bbmEdited && harga > 0 ? round2(biayaBbm / harga) : round2(literExact)
    const pendapatan = input.withIncome ? Math.round(Number(input.kotorPerTanggal[d.tanggal]) || 0) : 0
    const bersih = pendapatan - biayaBbm
    const row: TimelineRow = {
      tanggal: d.tanggal,
      kmParsed,
      km: round2(km),
      edited,
      liter,
      biayaBbm,
      bbmEdited,
      pendapatan,
      bersih,
      keterangan: '',
      rincian: d.rincian,
      ...(d.maps ? { maps: d.maps } : {}),
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
