import { bbmOf, bersihOf, biayaLainOf, kmOf, logKey } from './workspace'
import type { LogEntry } from './workspace'

export type Rentang = 'minggu' | 'bulan' | 'semua' | 'custom'

export interface HistoryFilter {
  rentang: Rentang
  /** YYYY-MM-DD, dipakai bila rentang = custom */
  dari?: string
  /** YYYY-MM-DD, dipakai bila rentang = custom */
  sampai?: string
  /** true = hanya entri dengan kotor > 0 */
  hanyaPendapatan?: boolean
}

export interface HistorySummary {
  totalBersih: number
  totalKm: number
  totalBbm: number
  totalKotor: number
  jumlahHari: number
}

function isValidEntry(e: unknown): e is LogEntry {
  if (!e || typeof e !== 'object') return false
  const o = e as Record<string, unknown>
  return (
    typeof o.tanggal === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(o.tanggal) &&
    Number.isFinite(Number(o.odoAwal)) &&
    Number.isFinite(Number(o.odoAkhir)) &&
    Number.isFinite(Number(o.kotor))
  )
}

function normalize(e: LogEntry): LogEntry {
  return {
    tanggal: e.tanggal,
    odoAwal: Math.round(Number(e.odoAwal) || 0),
    odoAkhir: Math.round(Number(e.odoAkhir) || 0),
    kotor: Math.round(Number(e.kotor) || 0),
    totalKm: typeof e.totalKm === 'number' && Number.isFinite(e.totalKm) ? e.totalKm : undefined,
    biayaBensin: bbmOf(e),
    biayaLain: biayaLainOf(e),
    sumber: e.sumber === 'linimasa' ? 'linimasa' : 'manual',
    rincianKm: e.rincianKm,
    rincian: Array.isArray(e.rincian) ? e.rincian : undefined,
  }
}

/** Muat semua log satu workspace, terbaru dulu. Aman untuk SSR (kosong bila tanpa localStorage). */
export function loadLogs(workspaceId: string | null): LogEntry[] {
  if (typeof localStorage === 'undefined' || !workspaceId) return []
  try {
    const raw = localStorage.getItem(logKey(workspaceId)) ?? '[]'
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter(isValidEntry)
      .map(normalize)
      .sort((a, b) => (a.tanggal < b.tanggal ? 1 : a.tanggal > b.tanggal ? -1 : 0))
  } catch {
    return []
  }
}

function persist(workspaceId: string, logs: LogEntry[]): void {
  localStorage.setItem(logKey(workspaceId), JSON.stringify(logs.slice(0, 180)))
}

/** Hapus satu hari. @returns true bila ada yang terhapus. */
export function deleteLog(workspaceId: string, tanggal: string): boolean {
  try {
    const logs = loadLogs(workspaceId)
    const next = logs.filter((e) => e.tanggal !== tanggal)
    if (next.length === logs.length) return false
    persist(workspaceId, next)
    return true
  } catch {
    return false
  }
}

export interface LogPatch {
  kotor?: number
  biayaBensin?: number
  biayaLain?: number
  /** KM final. Untuk entri manual (odo) menimpa via totalKm agar selisih odo tidak hilang. */
  km?: number
}

/** Ubah satu hari (dicari per tanggal). @returns false bila tanggal tidak ketemu. */
export function updateLog(workspaceId: string, tanggal: string, patch: LogPatch): boolean {
  try {
    const logs = loadLogs(workspaceId)
    const idx = logs.findIndex((e) => e.tanggal === tanggal)
    if (idx === -1) return false
    const cur = logs[idx]
    const next: LogEntry = { ...cur }
    if (patch.kotor !== undefined) next.kotor = Math.max(0, Math.round(Number(patch.kotor) || 0))
    if (patch.biayaBensin !== undefined)
      next.biayaBensin = Math.max(0, Math.round(Number(patch.biayaBensin) || 0))
    if (patch.biayaLain !== undefined)
      next.biayaLain = Math.max(0, Math.round(Number(patch.biayaLain) || 0))
    if (patch.km !== undefined) {
      const km = Math.max(0, Number(patch.km) || 0)
      if (cur.sumber === 'linimasa' || cur.totalKm !== undefined || cur.odoAwal === 0) {
        next.totalKm = Math.round(km * 100) / 100
      } else {
        // Entri odo manual: geser odoAkhir agar selisih = km baru.
        next.odoAkhir = next.odoAwal + Math.round(km)
      }
    }
    logs[idx] = normalize(next)
    persist(workspaceId, logs)
    return true
  } catch {
    return false
  }
}

/** YYYY-MM-DD lokal (bukan UTC) agar batas minggu/bulan sesuai kalender HP. */
export function toLocalDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Senin minggu berjalan (lokal). */
export function mondayOfWeek(now: Date): string {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const offset = (d.getDay() + 6) % 7 // Senin = 0
  d.setDate(d.getDate() - offset)
  return toLocalDate(d)
}

export function firstOfMonth(now: Date): string {
  return toLocalDate(new Date(now.getFullYear(), now.getMonth(), 1))
}

/** Batas {dari, sampai} inklusif untuk rentang cepat. null = tanpa batas (semua). */
export function rangeBounds(
  rentang: Rentang,
  now: Date,
  dari?: string,
  sampai?: string,
): { dari: string; sampai: string } | null {
  if (rentang === 'semua') return null
  if (rentang === 'minggu') return { dari: mondayOfWeek(now), sampai: toLocalDate(now) }
  if (rentang === 'bulan') return { dari: firstOfMonth(now), sampai: toLocalDate(now) }
  const a = (dari ?? '').trim()
  const b = (sampai ?? '').trim()
  if (!a && !b) return null
  // Bila satu sisi kosong, sisi itu dianggap tanpa batas.
  return { dari: a || '0000-00-00', sampai: b || '9999-99-99' }
}

/** Filter tampilan (tidak mengubah data tersimpan). */
export function filterLogs(logs: LogEntry[], filter: HistoryFilter, now: Date = new Date()): LogEntry[] {
  const bounds = rangeBounds(filter.rentang, now, filter.dari, filter.sampai)
  return logs.filter((e) => {
    if (bounds) {
      if (e.tanggal < bounds.dari || e.tanggal > bounds.sampai) return false
    }
    if (filter.hanyaPendapatan && !(e.kotor > 0)) return false
    return true
  })
}

/** Ringkasan kartu atas (dihitung dari log yang sudah difilter). */
export function summarize(logs: LogEntry[]): HistorySummary {
  const totalKmRaw = logs.reduce((a, e) => a + kmOf(e), 0)
  return {
    totalBersih: logs.reduce((a, e) => a + bersihOf(e), 0),
    totalKm: Math.round(totalKmRaw * 100) / 100,
    totalBbm: logs.reduce((a, e) => a + bbmOf(e), 0),
    totalKotor: logs.reduce((a, e) => a + (Math.round(e.kotor) || 0), 0),
    jumlahHari: logs.length,
  }
}

/** Label sumber untuk kolom tabel: Timeline vs Manual. */
export function sumberLabel(e: Pick<LogEntry, 'sumber'>): string {
  return e.sumber === 'linimasa' ? 'Timeline' : 'Manual'
}

export function formatTanggalPendek(iso: string): string {
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
