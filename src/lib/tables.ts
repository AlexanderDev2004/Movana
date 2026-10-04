import {
  createExpandedRowModel,
  createSortedRowModel,
  rowExpandingFeature,
  rowSortingFeature,
  sortFn_alphanumeric,
  tableFeatures,
} from '@tanstack/react-table'
import type { SortingState } from '@tanstack/react-table'

/**
 * Satu-satunya definisi fitur tabel Movana — module scope agar referensinya
 * stabil di semua render dan semua tabel.
 *
 * Hanya plugin yang dipakai produk:
 * - sorting client-side (riwayat bisa diurutkan per kolom)
 * - expanding client-side (rincian extra / form edit per baris)
 *
 * Filtering + pagination TIDAK didaftarkan: filter dikerjakan di luar tabel
 * (data sudah difilter sebelum masuk) dan jumlah baris (≤180) tidak butuh
 * pagination. Mendaftarkan lebih sedikit = bundle kecil + tipe state akurat.
 */
export const movanaTableFeatures = tableFeatures({
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  // Satu-satunya fungsi sort yang dipakai produk: angka + string tanggal.
  // Default tiap kolom (`sortFn: 'auto'`) me-resolve ke sini.
  sortFns: {
    alphanumeric: sortFn_alphanumeric,
  },
  rowExpandingFeature,
  expandedRowModel: createExpandedRowModel(),
})

export type MovanaTableFeatures = typeof movanaTableFeatures

/** Kolom riwayat yang boleh di-sort lewat URL — cegah junk di `?sort=`. */
const SORTABLE_IDS = ['tanggal', 'km', 'bbm', 'extra', 'kotor', 'bersih'] as const

function isSortableId(id: string): boolean {
  return (SORTABLE_IDS as readonly string[]).includes(id)
}

/**
 * `?sort=bersih.desc,tanggal.asc` -> SortingState.
 * Bagian tak dikenal dibuang; maksimal 3 kunci agar URL tetap pendek.
 */
export function parseSortParam(raw: unknown): SortingState {
  if (typeof raw !== 'string' || raw.trim() === '') return []
  const out: SortingState = []
  for (const part of raw.split(',')) {
    const [id, dir] = part.split('.')
    if (!id || !isSortableId(id)) continue
    if (dir !== 'asc' && dir !== 'desc') continue
    if (out.some((s) => s.id === id)) continue
    out.push({ id, desc: dir === 'desc' })
    if (out.length >= 3) break
  }
  return out
}

/** SortingState -> `?sort=...`. Kosong = undefined (param dihapus dari URL). */
export function serializeSorting(sorting: SortingState): string | undefined {
  const parts = sorting
    .filter((s) => isSortableId(s.id))
    .map((s) => `${s.id}.${s.desc ? 'desc' : 'asc'}`)
  return parts.length > 0 ? parts.join(',') : undefined
}
