import { z } from 'zod'

/** Klasifikasi jenis aktivitas Google Timeline ke kelompok Movana */
export const TIMELINE_KINDS = ['motor', 'mobil', 'jalan', 'lain'] as const
export type TimelineKind = (typeof TIMELINE_KINDS)[number]

export const TIMELINE_KIND_LABEL: Record<TimelineKind, string> = {
  motor: 'Motor',
  mobil: 'Mobil',
  jalan: 'Jalan kaki',
  lain: 'Lainnya',
}

export interface DailyKm {
  tanggal: string // YYYY-MM-DD
  totalKm: number
  rincian: Record<TimelineKind, number>
}

export interface TimelineParseResult {
  days: DailyKm[]
  totalKm: number
  /** segmen activity yang rusak dan dilewati */
  skipped: number
  dateFrom: string | null
  dateTo: string | null
}

// Segmen Timeline bisa berupa visit / activity / timelinePath.
// Hanya activity yang punya jarak — sisanya dilewati tanpa error.
const timelineSegmentSchema = z
  .object({
    startTime: z.string(),
    activity: z
      .object({
        distanceMeters: z.number().nonnegative().optional(),
        topCandidate: z.object({ type: z.string().optional() }).optional(),
      })
      .optional(),
  })
  .passthrough()

const timelineFileSchema = z.object({
  semanticSegments: z.array(timelineSegmentSchema),
})

function classifyKind(rawType: string): TimelineKind {
  const t = (rawType ?? '').toUpperCase()
  if (t.includes('MOTOR')) return 'motor' // MOTORCYCLING
  if (t === 'IN_PASSENGER_VEHICLE' || t.includes('VEHICLE') || t.includes('CAR')) return 'mobil'
  if (t.includes('WALK') || t.includes('RUN') || t.includes('CYCL')) return 'jalan'
  return 'lain'
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/**
 * Parse export Google Timeline (Takeout/Linimasa JSON) menjadi KM harian.
 * - Menjumlahkan `distanceMeters` tiap activity per tanggal (tanggal lokal dari startTime).
 * - Segmen visit / timelinePath (tanpa activity) diabaikan.
 * - Segmen activity rusak dilewati dan dihitung di `skipped`, tidak menggagalkan parse.
 * - Throw Error bila struktur file bukan export Timeline.
 */
export function parseTimelineJson(input: unknown): TimelineParseResult {
  const parsed = timelineFileSchema.safeParse(input)
  if (!parsed.success) {
    throw new Error('File bukan export Linimasa Google (semanticSegments tidak ditemukan)')
  }

  const perDay = new Map<string, Record<TimelineKind, number>>()
  let skipped = 0

  for (const seg of parsed.data.semanticSegments) {
    const act = seg.activity
    if (!act) continue // visit / timelinePath murni
    const tanggal = seg.startTime.slice(0, 10)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(tanggal)) {
      skipped += 1
      continue
    }
    const meters = typeof act.distanceMeters === 'number' && Number.isFinite(act.distanceMeters) ? act.distanceMeters : 0
    const kind = classifyKind(act.topCandidate?.type ?? '')
    let agg = perDay.get(tanggal)
    if (!agg) {
      agg = { motor: 0, mobil: 0, jalan: 0, lain: 0 }
      perDay.set(tanggal, agg)
    }
    agg[kind] += meters
  }

  const days: DailyKm[] = [...perDay.entries()]
    .map(([tanggal, meters]) => {
      const rincian: Record<TimelineKind, number> = {
        motor: round2(meters.motor / 1000),
        mobil: round2(meters.mobil / 1000),
        jalan: round2(meters.jalan / 1000),
        lain: round2(meters.lain / 1000),
      }
      const totalKm = round2(rincian.motor + rincian.mobil + rincian.jalan + rincian.lain)
      return { tanggal, totalKm, rincian }
    })
    .sort((a, b) => (a.tanggal < b.tanggal ? -1 : 1))

  const totalKm = round2(days.reduce((a, d) => a + d.totalKm, 0))

  return {
    days,
    totalKm,
    skipped,
    dateFrom: days.length > 0 ? days[0].tanggal : null,
    dateTo: days.length > 0 ? days[days.length - 1].tanggal : null,
  }
}

/** Hash sederhana (djb2) untuk menandai file yang sudah pernah diimport */
export function hashText(text: string): string {
  let h = 5381
  for (let i = 0; i < text.length; i++) {
    h = ((h << 5) + h + text.charCodeAt(i)) | 0
  }
  return `h${(h >>> 0).toString(16)}-${text.length}`
}
