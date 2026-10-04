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
  /** Total pengeluaran tambahan per tanggal (Rp, integer). Default 0. */
  extraPerTanggal?: Record<string, number>
  /** Jumlah item extra per tanggal (untuk badge/keterangan). Default 0. */
  extraCountPerTanggal?: Record<string, number>
  /**
   * Rentang jam aktif (menit sejak 00:00). null/undefined = semua waktu.
   * Bila ada, KM motor dihitung hanya dari bucket jam dalam rentang.
   * Koreksi KM manual (kmEdit) selalu menang — tidak difilter jam.
   */
  jamRange?: JamRange | null
}

export interface TimelineRow {
  tanggal: string
  /** KM motor hasil parse penuh (sebelum filter jam & koreksi) */
  kmParsed: number
  /** KM final tampil (setelah filter jam, atau koreksi manual) */
  km: number
  edited: boolean
  /** true bila KM sedang difilter jam (km < kmParsed karena di luar jam) */
  jamFiltered: boolean
  liter: number
  biayaBbm: number
  /** true bila biaya BBM diisi manual (bukan dari rumus KM) */
  bbmEdited: boolean
  pendapatan: number
  /** Total pengeluaran tambahan hari itu (Rp) */
  extra: number
  /** Jumlah item pengeluaran tambahan (untuk badge) */
  extraCount: number
  /** pendapatan - biayaBbm - extra (negatif = minus; untuk mode tanpa pendapatan abaikan) */
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
  totalExtra: number
  totalBersih: number
  /** Total keluar untuk mode tanpa pendapatan = BBM + extra */
  totalKeluar: number
}

/** Preset rentang tanggal. */
export type DatePreset = 'today' | '7d' | '30d' | 'month' | 'all' | 'custom'

export type JamMode = 'all' | 'kerja' | 'custom'

export interface TimelineFilter {
  /** Tampilkan hanya hari dengan KM final >= nilai ini (0 = semua) */
  minKm: number
  /** Hanya Senin–Jumat */
  weekdaysOnly: boolean
  /** Hanya hari yang pendapatannya sudah diisi */
  filledOnly: boolean
  preset: DatePreset
  /** YYYY-MM-DD, dipakai bila preset = custom */
  dari: string
  /** YYYY-MM-DD, dipakai bila preset = custom */
  sampai: string
  jamMode: JamMode
  /** "HH:MM", dipakai bila jamMode = kerja/custom */
  jamMulai: string
  /** "HH:MM", dipakai bila jamMode = kerja/custom */
  jamSelesai: string
}

export const DEFAULT_JAM_KERJA_MULAI = '07:00'
export const DEFAULT_JAM_KERJA_SELESAI = '17:00'

export const DEFAULT_FILTER: TimelineFilter = {
  minKm: 15,
  weekdaysOnly: false,
  filledOnly: false,
  preset: 'all',
  dari: '',
  sampai: '',
  jamMode: 'all',
  jamMulai: DEFAULT_JAM_KERJA_MULAI,
  jamSelesai: DEFAULT_JAM_KERJA_SELESAI,
}

export const NO_FILTER: TimelineFilter = {
  minKm: 0,
  weekdaysOnly: false,
  filledOnly: false,
  preset: 'all',
  dari: '',
  sampai: '',
  jamMode: 'all',
  jamMulai: DEFAULT_JAM_KERJA_MULAI,
  jamSelesai: DEFAULT_JAM_KERJA_SELESAI,
}

export const DATE_PRESETS: { id: DatePreset; label: string }[] = [
  { id: 'today', label: 'Hari ini' },
  { id: '7d', label: '7 hari' },
  { id: '30d', label: '30 hari' },
  { id: 'month', label: 'Bulan ini' },
  { id: 'all', label: 'Semua' },
  { id: 'custom', label: 'Custom' },
]

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

/** YYYY-MM-DD lokal (bukan UTC) agar batas tanggal sesuai kalender HP. */
export function todayLocal(now: Date = new Date()): string {
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function addDaysIso(iso: string, delta: number): string {
  const d = new Date(`${iso}T00:00:00`)
  if (!Number.isFinite(d.getTime())) return iso
  d.setDate(d.getDate() + delta)
  return todayLocal(d)
}

/** Batas {dari, sampai} inklusif untuk preset. null = tanpa batas (semua). */
export function dateBounds(
  filter: Pick<TimelineFilter, 'preset' | 'dari' | 'sampai'>,
  today: string = todayLocal(),
): { dari: string; sampai: string } | null {
  switch (filter.preset) {
    case 'all':
      return null
    case 'today':
      return { dari: today, sampai: today }
    case '7d':
      return { dari: addDaysIso(today, -6), sampai: today }
    case '30d':
      return { dari: addDaysIso(today, -29), sampai: today }
    case 'month':
      return { dari: today.slice(0, 8) + '01', sampai: today }
    case 'custom': {
      const a = (filter.dari ?? '').trim()
      const b = (filter.sampai ?? '').trim()
      if (!a && !b) return null
      if (a && b && a > b) return { dari: b, sampai: a }
      return { dari: a || '0000-00-00', sampai: b || '9999-99-99' }
    }
    default:
      return null
  }
}

export interface JamRange {
  mulaiMin: number
  selesaiMin: number
}

/** "07:30" -> 450. NaN bila format salah. */
export function parseJam(s: string): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec((s ?? '').trim())
  if (!m) return NaN
  const h = Number(m[1])
  const min = Number(m[2])
  if (!Number.isFinite(h) || !Number.isFinite(min) || h < 0 || h > 23 || min < 0 || min > 59) return NaN
  return h * 60 + min
}

export function formatJam(totalMin: number): string {
  const h = Math.floor(totalMin / 60) % 24
  const m = ((totalMin % 60) + 60) % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/**
 * Rentang jam aktif dari filter. null = semua waktu (tanpa filter).
 * Mendukung rentang lewat tengah malam (mis. 22:00–04:00).
 */
export function resolveJamRange(filter: Pick<TimelineFilter, 'jamMode' | 'jamMulai' | 'jamSelesai'>): JamRange | null {
  if (filter.jamMode === 'all') return null
  const a = parseJam(filter.jamMulai)
  const b = parseJam(filter.jamSelesai)
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null
  if (a === b) return null // 24 jam penuh = semua waktu
  return { mulaiMin: a, selesaiMin: b }
}

/** true bila menit ke-`min` (0–1439) masuk rentang (mendukung lewat tengah malam). */
export function minuteInRange(min: number, range: JamRange): boolean {
  if (range.mulaiMin <= range.selesaiMin) return min >= range.mulaiMin && min < range.selesaiMin
  return min >= range.mulaiMin || min < range.selesaiMin
}

/**
 * Jumlahkan KM motor per-jam yang masuk rentang.
 * `perJam` = 24 bucket KM (index = jam). Bucket kosong/invalid = fallback ke total.
 * Mengembalikan null bila tidak ada data per-jam (pemanggil pakai KM penuh).
 */
export function kmMotorInRange(perJam: number[] | undefined, totalMotor: number, range: JamRange): number | null {
  if (!Array.isArray(perJam) || perJam.length !== 24) return null
  const sumBuckets = perJam.reduce((a, v) => a + (Number(v) || 0), 0)
  if (sumBuckets <= 0) {
    // Hari tanpa distribusi jam (mis. jam tak terparse): tidak bisa difilter.
    return totalMotor > 0 ? null : 0
  }
  let sum = 0
  for (let h = 0; h < 24; h++) {
    // Bucket jam h mencakup menit [h*60, h*60+60). Masuk bila awal bucket masuk rentang.
    if (minuteInRange(h * 60, range)) sum += Number(perJam[h]) || 0
  }
  return Math.round(sum * 100) / 100
}

/** Filter tampilan (tidak mengubah data / hasil simpan).
 * minKm dibandingkan ke KM hasil parse (stabil) supaya baris tidak
 * "menghilang" saat user sedang mengetik koreksi KM. */
export function filterTimelineRows(
  rows: TimelineRow[],
  filter: TimelineFilter,
  isFilled: (tanggal: string) => boolean,
  today: string = todayLocal(),
): TimelineRow[] {
  const bounds = dateBounds(filter, today)
  return rows.filter((r) => {
    if (bounds && (r.tanggal < bounds.dari || r.tanggal > bounds.sampai)) return false
    // Stabil saat mengetik: pakai kmParsed bila user sedang koreksi manual.
    const baseKm = r.edited && Number.isFinite(r.kmParsed) ? r.kmParsed : r.km
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
  row: Pick<TimelineRow, 'edited' | 'bbmEdited' | 'jamFiltered' | 'extraCount' | 'km' | 'bersih'>,
  withIncome: boolean,
): string {
  const notes: string[] = []
  if (row.edited) notes.push('koreksi')
  if (row.bbmEdited) notes.push('aktual')
  if (row.jamFiltered) notes.push('jam')
  if (row.extraCount > 0) notes.push(`${row.extraCount} extra`)
  if (row.km === 0) notes.push('tanpa motor')
  if (withIncome && row.bersih < 0) notes.push('minus')
  return notes.length > 0 ? notes.join(' • ') : '—'
}

/**
 * Hitung tabel import Timeline: KM (motor, bisa dikoreksi) -> liter -> biaya -> bersih.
 * Uang dalam Rupiah (integer, dibulatkan seperti `hitungHarian`).
 * Rumus baru: Bersih = pendapatan − BBM − extra.
 */
export function computeTimelineRows(
  days: DailyKm[],
  input: TimelineRowInput,
): { rows: TimelineRow[]; totals: TimelineTotals } {
  const validKpl = Number.isFinite(input.kmPerLiter) && input.kmPerLiter > 0
  const harga = Number.isFinite(input.hargaBbm) && input.hargaBbm >= 0 ? input.hargaBbm : 0
  const jamRange = input.jamRange ?? null

  const rows: TimelineRow[] = days.map((d) => {
    const kmParsedFull = d.rincian.motor
    // Terapkan filter jam ke KM parse (kecuali user koreksi manual).
    let kmDasar = kmParsedFull
    let jamFiltered = false
    if (jamRange) {
      const inRange = kmMotorInRange(d.perJamMotor, kmParsedFull, jamRange)
      if (inRange !== null) {
        kmDasar = inRange
        jamFiltered = inRange < kmParsedFull - 0.005
      }
    }
    const rawEdit = (input.kmEdit[d.tanggal] ?? '').trim()
    const edited = rawEdit !== ''
    const km = edited ? Math.max(0, Number(rawEdit) || 0) : kmDasar
    const literExact = validKpl && km > 0 ? km / input.kmPerLiter : 0
    const rawBbm = (input.bbmEdit?.[d.tanggal] ?? '').trim()
    const bbmEdited = rawBbm !== ''
    // BBM aktual (misal struk SPBU) mengalahkan rumus; liter diturunkan balik dari harga.
    const biayaBbm = bbmEdited
      ? Math.max(0, Math.round(Number(rawBbm.replace(/[^\d]/g, '')) || 0))
      : Math.round(literExact * harga)
    const liter = bbmEdited && harga > 0 ? round2(biayaBbm / harga) : round2(literExact)
    const pendapatan = input.withIncome ? Math.round(Number(input.kotorPerTanggal[d.tanggal]) || 0) : 0
    const extra = Math.max(0, Math.round(Number(input.extraPerTanggal?.[d.tanggal]) || 0))
    const extraCount = Math.max(0, Math.round(Number(input.extraCountPerTanggal?.[d.tanggal]) || 0))
    const bersih = pendapatan - biayaBbm - extra
    const row: TimelineRow = {
      tanggal: d.tanggal,
      kmParsed: kmParsedFull,
      km: round2(km),
      edited,
      jamFiltered: !edited && jamFiltered,
      liter,
      biayaBbm,
      bbmEdited,
      pendapatan,
      extra,
      extraCount,
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
    totalExtra: rows.reduce((a, r) => a + r.extra, 0),
    totalBersih: rows.reduce((a, r) => a + r.bersih, 0),
    totalKeluar: 0,
  }
  totals.totalKeluar = totals.totalBiaya + totals.totalExtra

  return { rows, totals }
}

// --- Persistensi preferensi filter (localStorage, per workspace) ---

function filterKey(workspaceId: string | null | undefined): string {
  return workspaceId ? `movana:timeline-filter:${workspaceId}` : 'movana:timeline-filter'
}

function sanitizeFilter(raw: unknown): TimelineFilter {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const num = (v: unknown, fb: number): number => {
    const n = Number(v)
    return Number.isFinite(n) && n >= 0 ? n : fb
  }
  const str = (v: unknown): string => (typeof v === 'string' ? v : '')
  const preset = str(o.preset)
  const validPreset: DatePreset[] = ['today', '7d', '30d', 'month', 'all', 'custom']
  const jamMode = str(o.jamMode)
  return {
    minKm: num(o.minKm, DEFAULT_FILTER.minKm),
    weekdaysOnly: o.weekdaysOnly === true,
    filledOnly: o.filledOnly === true,
    preset: (validPreset.includes(preset as DatePreset) ? preset : 'all') as DatePreset,
    dari: /^\d{4}-\d{2}-\d{2}$/.test(str(o.dari)) ? str(o.dari) : '',
    sampai: /^\d{4}-\d{2}-\d{2}$/.test(str(o.sampai)) ? str(o.sampai) : '',
    jamMode: (['all', 'kerja', 'custom'].includes(jamMode) ? jamMode : 'all') as JamMode,
    jamMulai: /^\d{1,2}:\d{2}$/.test(str(o.jamMulai)) ? str(o.jamMulai) : DEFAULT_JAM_KERJA_MULAI,
    jamSelesai: /^\d{1,2}:\d{2}$/.test(str(o.jamSelesai)) ? str(o.jamSelesai) : DEFAULT_JAM_KERJA_SELESAI,
  }
}

/** Muat preferensi filter terakhir. null bila belum pernah disimpan. */
export function loadTimelineFilter(workspaceId: string | null | undefined): TimelineFilter | null {
  if (typeof localStorage === 'undefined') return null
  try {
    const raw = localStorage.getItem(filterKey(workspaceId))
    if (!raw) return null
    return sanitizeFilter(JSON.parse(raw))
  } catch {
    return null
  }
}

export function saveTimelineFilter(workspaceId: string | null | undefined, filter: TimelineFilter): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(filterKey(workspaceId), JSON.stringify(filter))
  } catch {
    /* abaikan — filter hanya preferensi */
  }
}

/** true bila filter menyempit dari default tampil (untuk tombol "Tampilkan semua"). */
export function isFilterNarrow(filter: TimelineFilter): boolean {
  return (
    filter.minKm !== 0 ||
    filter.weekdaysOnly ||
    filter.filledOnly ||
    filter.preset !== 'all' ||
    filter.jamMode !== 'all'
  )
}
