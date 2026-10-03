import type { DayMaps, LatLng } from './timeline'

function valid(p: LatLng | undefined): p is LatLng {
  return (
    !!p && Number.isFinite(p.lat) && Number.isFinite(p.lng) && !(p.lat === 0 && p.lng === 0)
  )
}

/**
 * URL rute Google Maps dari titik awal ke titik akhir hari itu.
 * Sengaja hanya origin + destination (tidak mengirim puluhan titik path)
 * agar URL tetap pendek.
 */
export function buildMapsDirUrl(origin: LatLng, destination: LatLng): string {
  return `https://www.google.com/maps/dir/?api=1&origin=${origin.lat},${origin.lng}&destination=${destination.lat},${destination.lng}`
}

/** URL tampil-satu-titik (fallback visit terlama / hanya satu ujung tersedia). */
export function buildMapsSearchUrl(point: LatLng): string {
  return `https://www.google.com/maps/search/?api=1&query=${point.lat},${point.lng}`
}

export type DayMapsTarget = { url: string; kind: 'route' | 'place' }

/**
 * Prioritas URL harian:
 * 1. origin + destination lengkap → rute dir/?api=1
 * 2. hanya satu titik (origin/destination/fallback) → search/?api=1
 * 3. tidak ada titik → null (tombol disembunyikan)
 */
export function getDayMapsTarget(maps?: DayMaps | null): DayMapsTarget | null {
  if (!maps) return null
  const origin = valid(maps.origin) ? maps.origin : undefined
  const destination = valid(maps.destination) ? maps.destination : undefined
  if (origin && destination) {
    return { url: buildMapsDirUrl(origin, destination), kind: 'route' }
  }
  const single = origin ?? destination ?? (valid(maps.fallback) ? maps.fallback : undefined)
  if (single) return { url: buildMapsSearchUrl(single), kind: 'place' }
  return null
}
