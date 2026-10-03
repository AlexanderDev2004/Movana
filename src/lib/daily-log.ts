import { logKey } from './workspace'
import type { TimelineKind } from './timeline'

interface ManualEntryInput {
  odoAwal: number
  odoAkhir: number
  kotor: number
  /** Biaya BBM hasil rumus (disimpan agar Riwayat bisa hitung bersih). */
  biayaBensin?: number
  /** Biaya lain (parkir/makan/dll). */
  biayaLain?: number
  rincian?: { platform: string; jumlah: number }[]
}

export function saveManualLog(workspaceId: string, input: ManualEntryInput): boolean {
  try {
    const key = logKey(workspaceId)
    const raw = localStorage.getItem(key) ?? '[]'
    const parsed: unknown = JSON.parse(raw)
    const list = Array.isArray(parsed) ? parsed : []
    const tanggal = new Date().toISOString().slice(0, 10)
    const entry = {
      tanggal,
      odoAwal: Math.round(Number(input.odoAwal) || 0),
      odoAkhir: Math.round(Number(input.odoAkhir) || 0),
      kotor: Math.round(Number(input.kotor) || 0),
      biayaBensin: Math.round(Number(input.biayaBensin) || 0),
      biayaLain: Math.round(Number(input.biayaLain) || 0),
      sumber: 'manual' as const,
      rincian: input.rincian,
    }
    // Gabung per tanggal (simpan ulang hari yang sama menimpa, bukan duplikat).
    const rest = list.filter(
      (e) => !(e && typeof e === 'object' && (e as { tanggal?: unknown }).tanggal === tanggal),
    )
    const merged = [entry, ...rest].sort((a, b) => {
      const ta = (a as { tanggal: string }).tanggal
      const tb = (b as { tanggal: string }).tanggal
      return ta < tb ? 1 : ta > tb ? -1 : 0
    })
    localStorage.setItem(key, JSON.stringify(merged.slice(0, 180)))
    return true
  } catch {
    return false
  }
}

export interface TimelineImportEntry {
  tanggal: string // YYYY-MM-DD
  km: number
  kotor: number
  /** Biaya BBM final (hasil rumus atau isi aktual). Opsional untuk kompatibilitas. */
  biayaBensin?: number
  rincianKm?: Record<TimelineKind, number>
  rincian?: { platform: string; jumlah: number }[]
}

/**
 * Simpan hasil import Timeline ke log workspace.
 * Digabung per tanggal (import menang bila tanggal sama), terbaru dulu, max 180 entri.
 * @returns jumlah hari tersimpan (0 bila gagal)
 */
export function saveTimelineImport(workspaceId: string, entries: TimelineImportEntry[]): number {
  try {
    if (entries.length === 0) return 0
    const key = logKey(workspaceId)
    const raw = localStorage.getItem(key) ?? '[]'
    const parsed: unknown = JSON.parse(raw)
    const list = Array.isArray(parsed) ? parsed : []
    const byDate = new Map<string, unknown>()
    for (const e of list) {
      if (e && typeof e === 'object' && typeof (e as { tanggal?: unknown }).tanggal === 'string') {
        byDate.set((e as { tanggal: string }).tanggal, e)
      }
    }
    for (const e of entries) {
      byDate.set(e.tanggal, {
        tanggal: e.tanggal,
        odoAwal: 0,
        odoAkhir: 0,
        kotor: Math.round(e.kotor),
        totalKm: e.km,
        biayaBensin: Math.round(e.biayaBensin ?? 0),
        sumber: 'linimasa' as const,
        rincianKm: e.rincianKm,
        rincian: e.rincian,
      })
    }
    const merged = [...byDate.values()].sort((a, b) => {
      const ta = (a as { tanggal: string }).tanggal
      const tb = (b as { tanggal: string }).tanggal
      return ta < tb ? 1 : -1
    })
    localStorage.setItem(key, JSON.stringify(merged.slice(0, 180)))
    return entries.length
  } catch {
    return 0
  }
}
