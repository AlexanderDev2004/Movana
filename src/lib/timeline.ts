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

export interface LatLng {
  lat: number
  lng: number
}

/** Info lokasi harian untuk fitur "Lihat di Maps" (koordinat hanya untuk URL, jangan dirender). */
export interface DayMaps {
  /** Titik awal hari (activity.start paling awal / titik timelinePath pertama). */
  origin?: LatLng
  /** Titik akhir hari (activity.end paling akhir / titik timelinePath terakhir). */
  destination?: LatLng
  /** Fallback: lokasi visit dengan durasi terpanjang hari itu. */
  fallback?: LatLng
  /** Label tempat ramah-baca, mis. "Rumah" atau "Rumah → Area kerja". Tanpa koordinat. */
  placeLabel?: string
}

export interface DailyKm {
  tanggal: string // YYYY-MM-DD
  totalKm: number
  rincian: Record<TimelineKind, number>
  /**
   * KM motor per jam lokal 0–23 (index = jam mulai, mis. [7] = 07:00–08:00).
   * Dipakai filter jam (mis. jam kerja 07:00–17:00). Opsional agar
   * data lama / sumber lain tetap bisa dipakai (fallback = KM penuh).
   */
  perJamMotor?: number[]
  /** Info rute harian (opsional; tidak ada bila titik lokasi tak ditemukan). */
  maps?: DayMaps
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
// Hanya activity yang punya jarak — sisanya dilewati tanpa error untuk KM,
// tetapi visit / timelinePath tetap dipakai untuk info rute harian (DayMaps).
// Schema dibuat longgar: distanceMeters bisa number|string, koordinat bisa
// string "lat°, lng°" / "geo:lat,lng" / objek {latLng|point} / E7.
const timelineFileSchema = z
  .object({
    semanticSegments: z.array(z.unknown()),
  })
  .passthrough()

const timelineArraySchema = z.array(z.unknown())

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

/** distanceMeters bisa number atau string numerik ("1234"). Invalid → 0. */
function parseMeters(raw: unknown): number {
  if (typeof raw === 'number' && Number.isFinite(raw) && raw >= 0) return raw
  if (typeof raw === 'string' && raw.trim() !== '') {
    const n = Number(raw.replace(/[^\d.\-]/g, ''))
    if (Number.isFinite(n) && n >= 0) return n
  }
  return 0
}

/**
 * Parse koordinat dari berbagai varian format export Timeline:
 * - "50.0506312°, 14.3439906°" / "geo:lat,lng" / "lat,lng"
 * - { latLng: "..." } / { point: "..." }
 * - { latitudeE7, longitudeE7 } / { latE7, lngE7 }
 * - { lat, lng } / { latitude, longitude }
 * Return null bila tidak valid / di luar rentang.
 */
export function parseLatLng(raw: unknown): LatLng | null {
  if (typeof raw === 'string') {
    let s = raw.trim().replace(/^geo:/i, '').replace(/°/g, '').trim()
    if (s === '') return null
    const parts = s.split(',').map((p) => p.trim()).filter(Boolean)
    if (parts.length !== 2) return null
    const lat = Number(parts[0])
    const lng = Number(parts[1])
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null
    if (lat === 0 && lng === 0) return null
    return { lat, lng }
  }
  if (typeof raw === 'object' && raw !== null) {
    const o = raw as Record<string, unknown>
    if (typeof o.latLng === 'string') return parseLatLng(o.latLng)
    if (typeof o.point === 'string') return parseLatLng(o.point)
    const latE7 = o.latitudeE7 ?? o.latE7
    const lngE7 = o.longitudeE7 ?? o.lngE7
    if (
      (typeof latE7 === 'number' || typeof latE7 === 'string') &&
      (typeof lngE7 === 'number' || typeof lngE7 === 'string')
    ) {
      const lat = Number(latE7) / 1e7
      const lng = Number(lngE7) / 1e7
      if (Number.isFinite(lat) && Number.isFinite(lng) && !(lat === 0 && lng === 0)) {
        if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) return { lat, lng }
      }
    }
    const latNum = o.lat ?? o.latitude
    const lngNum = o.lng ?? o.lon ?? o.longitude
    if (typeof latNum === 'number' && typeof lngNum === 'number') {
      if (
        Number.isFinite(latNum) &&
        Number.isFinite(lngNum) &&
        !(latNum === 0 && lngNum === 0) &&
        latNum >= -90 &&
        latNum <= 90 &&
        lngNum >= -180 &&
        lngNum <= 180
      ) {
        return { lat: latNum, lng: lngNum }
      }
    }
  }
  return null
}

const PLACE_LABEL_ID: Record<string, string> = {
  HOME: 'Rumah',
  WORK: 'Area kerja',
  OFFICE: 'Kantor',
  SCHOOL: 'Sekolah',
  SHOPPING: 'Belanja',
  SHOPPING_MALL: 'Mal',
  STORE: 'Toko',
  GROCERY: 'Belanja',
  MARKET: 'Pasar',
  RESTAURANT: 'Restoran',
  CAFE: 'Kafe',
  BAR: 'Kafe',
  GYM: 'Gym',
  FITNESS: 'Gym',
  PARK: 'Taman',
  HOSPITAL: 'RS',
  PHARMACY: 'Apotek',
  DOCTOR: 'Klinik',
  BANK: 'Bank',
  ATM: 'ATM',
  GAS_STATION: 'SPBU',
  PARKING: 'Parkir',
  HOTEL: 'Hotel',
  LODGING: 'Penginapan',
  AIRPORT: 'Bandara',
  TRAIN_STATION: 'Stasiun',
  TRANSIT_STATION: 'Stasiun',
  BUS_STATION: 'Terminal',
  PLACE_OF_WORSHIP: 'Ibadah',
  CHURCH: 'Ibadah',
  MOSQUE: 'Ibadah',
  TEMPLE: 'Ibadah',
}

/**
 * Ubah semanticType mentah ("TYPE_HOME", "HOME", "WORK", ...) menjadi label
 * ramah-baca Indonesia. Return null untuk tipe tak dikenal/kosong (jangan tampilkan).
 */
export function friendlyPlaceLabel(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const key = raw.trim().toUpperCase().replace(/^TYPE_/, '')
  if (key === '' || key === 'UNKNOWN' || key === 'OTHER' || key === 'UNKNOWN_PLACE') return null
  const mapped = PLACE_LABEL_ID[key]
  if (mapped) return mapped
  const words = key
    .toLowerCase()
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
  return words.length > 0 ? words.join(' ') : null
}

interface VisitAcc {
  ll: LatLng
  labelRaw: string | null
  friendly: string | null
  durationMs: number
  startTime: string
}

interface DayMapsAcc {
  firstStart: { time: string; ll: LatLng } | null
  lastEnd: { time: string; ll: LatLng } | null
  firstPath: { time: string; ll: LatLng } | null
  lastPath: { time: string; ll: LatLng } | null
  visits: VisitAcc[]
}

function getOrCreateMapsAcc(m: Map<string, DayMapsAcc>, tanggal: string): DayMapsAcc {
  let acc = m.get(tanggal)
  if (!acc) {
    acc = { firstStart: null, lastEnd: null, firstPath: null, lastPath: null, visits: [] }
    m.set(tanggal, acc)
  }
  return acc
}

function extractActivityType(act: unknown): string {
  if (typeof act !== 'object' || act === null) return ''
  const top = (act as Record<string, unknown>).topCandidate
  if (typeof top === 'object' && top !== null) {
    const t = (top as Record<string, unknown>).type
    if (typeof t === 'string') return t
  }
  return ''
}

/** Jam lokal 0–23 dari startTime ISO. -1 bila tidak bisa diparse. */
function hourOf(startTime: string): number {
  const d = new Date(startTime)
  if (Number.isFinite(d.getTime())) {
    const h = d.getHours()
    if (h >= 0 && h <= 23) return h
  }
  // Fallback: ambil HH langsung dari string ISO ("...T07:30...").
  const m = /T(\d{2}):/.exec(startTime)
  if (m) {
    const h = Number(m[1])
    if (Number.isFinite(h) && h >= 0 && h <= 23) return h
  }
  return -1
}

function buildDayMaps(acc: DayMapsAcc): DayMaps | undefined {
  const origin = acc.firstStart?.ll ?? acc.firstPath?.ll
  const destination = acc.lastEnd?.ll ?? acc.lastPath?.ll
  let fallback: LatLng | undefined
  let longest: VisitAcc | null = null
  for (const v of acc.visits) {
    if (!longest || v.durationMs > longest.durationMs) longest = v
  }
  if (longest) fallback = longest.ll

  let placeLabel: string | undefined
  const labeled = acc.visits.filter((v) => v.friendly)
  if (labeled.length > 0) {
    const sorted = [...labeled].sort((a, b) => (a.startTime < b.startTime ? -1 : 1))
    const first = sorted[0].friendly as string
    const last = sorted[sorted.length - 1].friendly as string
    placeLabel = first !== last ? `${first} → ${last}` : first
  }

  if (!origin && !destination && !fallback) return undefined
  const maps: DayMaps = {}
  if (origin) maps.origin = origin
  if (destination) maps.destination = destination
  if (fallback) maps.fallback = fallback
  if (placeLabel) maps.placeLabel = placeLabel
  return maps
}

/**
 * Parse export Google Timeline (Takeout/Linimasa JSON) menjadi KM harian.
 * - Menjumlahkan `distanceMeters` tiap activity per tanggal (tanggal lokal dari startTime).
 * - Mendukung `distanceMeters` number|string dan format file objek `{semanticSegments}`
 *   maupun array segmen langsung (varian export HP).
 * - Segmen visit / timelinePath (tanpa activity) diabaikan untuk KM, tetapi dipakai
 *   untuk info rute harian: titik awal/akhir + fallback visit terlama + label tempat.
 * - Segmen activity rusak dilewati dan dihitung di `skipped`, tidak menggagalkan parse.
 * - Throw Error bila struktur file bukan export Timeline.
 */
export function parseTimelineJson(input: unknown): TimelineParseResult {
  let rawSegments: unknown[]
  if (Array.isArray(input)) {
    const arr = timelineArraySchema.safeParse(input)
    if (!arr.success || arr.data.length === 0) {
      throw new Error('File bukan export Linimasa Google (semanticSegments tidak ditemukan)')
    }
    rawSegments = arr.data
  } else {
    const parsed = timelineFileSchema.safeParse(input)
    if (!parsed.success) {
      throw new Error('File bukan export Linimasa Google (semanticSegments tidak ditemukan)')
    }
    rawSegments = parsed.data.semanticSegments
  }

  const perDay = new Map<string, Record<TimelineKind, number>>()
  const perDayHour = new Map<string, number[]>()
  const mapsAcc = new Map<string, DayMapsAcc>()
  let skipped = 0

  for (const segRaw of rawSegments) {
    if (typeof segRaw !== 'object' || segRaw === null) continue
    const seg = segRaw as Record<string, unknown>
    const startTime = typeof seg.startTime === 'string' ? seg.startTime : null
    const endTime = typeof seg.endTime === 'string' ? seg.endTime : null
    if (!startTime) continue
    const tanggal = startTime.slice(0, 10)
    const tanggalValid = /^\d{4}-\d{2}-\d{2}$/.test(tanggal)
    const act = seg.activity

    // --- KM dari activity ---
    if (act && typeof act === 'object') {
      const actRec = act as Record<string, unknown>
      if (!tanggalValid) {
        skipped += 1
        continue
      }
      const meters = parseMeters(actRec.distanceMeters)
      const kind = classifyKind(extractActivityType(actRec))
      let agg = perDay.get(tanggal)
      if (!agg) {
        agg = { motor: 0, mobil: 0, jalan: 0, lain: 0 }
        perDay.set(tanggal, agg)
      }
      agg[kind] += meters
      // Bucket per jam (hanya motor) untuk filter jam kerja.
      if (kind === 'motor' && meters > 0) {
        let buckets = perDayHour.get(tanggal)
        if (!buckets) {
          buckets = new Array(24).fill(0)
          perDayHour.set(tanggal, buckets)
        }
        const h = hourOf(startTime)
        if (h >= 0) buckets[h] += meters
        else {
          // Jam tak diketahui: sebar rata agar total tetap benar
          // (filter jam akan menganggapnya di luar jam kerja bila ketat).
          // Simpan di bucket 12 sebagai netral? Tidak — abaikan distribusi,
          // total harian tetap dari `agg`. Bucket hanya untuk filter.
        }
      }

      // --- Titik awal/akhir hari dari activity.start / activity.end ---
      const startLL = parseLatLng(actRec.start)
      if (startLL) {
        const acc = getOrCreateMapsAcc(mapsAcc, tanggal)
        if (!acc.firstStart || startTime < acc.firstStart.time) {
          acc.firstStart = { time: startTime, ll: startLL }
        }
      }
      const endLL = parseLatLng(actRec.end)
      if (endLL) {
        const acc = getOrCreateMapsAcc(mapsAcc, tanggal)
        const endT = endTime ?? startTime
        if (!acc.lastEnd || endT >= acc.lastEnd.time) {
          acc.lastEnd = { time: endT, ll: endLL }
        }
      }
    }

    if (!tanggalValid) continue

    // --- Titik fallback dari timelinePath (bila activity.start/end kosong) ---
    const tp = seg.timelinePath
    if (Array.isArray(tp) && tp.length > 0) {
      let firstPt: LatLng | null = null
      let lastPt: LatLng | null = null
      for (const p of tp) {
        const ll = parseLatLng((p as Record<string, unknown>)?.point ?? p)
        if (!ll) continue
        if (!firstPt) firstPt = ll
        lastPt = ll
      }
      if (firstPt || lastPt) {
        const acc = getOrCreateMapsAcc(mapsAcc, tanggal)
        if (firstPt && (!acc.firstPath || startTime < acc.firstPath.time)) {
          acc.firstPath = { time: startTime, ll: firstPt }
        }
        if (lastPt) {
          const endT = endTime ?? startTime
          if (!acc.lastPath || endT >= acc.lastPath.time) {
            acc.lastPath = { time: endT, ll: lastPt }
          }
        }
      }
    }

    // --- Visit: fallback lokasi terlama + label tempat ---
    const visit = seg.visit
    if (visit && typeof visit === 'object') {
      const vRec = visit as Record<string, unknown>
      const top = vRec.topCandidate
      let placeLL: LatLng | null = null
      let semanticRaw: string | null = null
      if (typeof top === 'object' && top !== null) {
        const topRec = top as Record<string, unknown>
        if (typeof topRec.semanticType === 'string') semanticRaw = topRec.semanticType
        placeLL = parseLatLng(topRec.placeLocation)
      }
      // visit juga bisa menyimpan latLng langsung (varian lama)
      if (!placeLL) placeLL = parseLatLng(vRec.placeLocation ?? vRec.latLng)
      if (placeLL) {
        let durationMs = 0
        if (endTime) {
          const a = Date.parse(startTime)
          const b = Date.parse(endTime)
          if (Number.isFinite(a) && Number.isFinite(b) && b > a) durationMs = b - a
        }
        const acc = getOrCreateMapsAcc(mapsAcc, tanggal)
        acc.visits.push({
          ll: placeLL,
          labelRaw: semanticRaw,
          friendly: friendlyPlaceLabel(semanticRaw),
          durationMs,
          startTime,
        })
      }
    }
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
      const acc = mapsAcc.get(tanggal)
      const maps = acc ? buildDayMaps(acc) : undefined
      const hourMeters = perDayHour.get(tanggal)
      const perJamMotor = hourMeters ? hourMeters.map((m) => round2(m / 1000)) : undefined
      return {
        tanggal,
        totalKm,
        rincian,
        ...(perJamMotor ? { perJamMotor } : {}),
        ...(maps ? { maps } : {}),
      }
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
