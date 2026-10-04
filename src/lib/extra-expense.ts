/**
 * Pengeluaran tambahan harian (di luar BBM).
 * Disimpan per tanggal sebagai list; totalnya mengurangi Bersih:
 *   Bersih = Pendapatan - Biaya BBM - Total Extra
 *
 * Format uang selalu integer Rupiah. Kategori memakai id stabil agar
 * label bisa diganti tanpa merusak data lama; kategori custom
 * (buatan user) disimpan apa adanya sebagai string.
 */

export interface ExtraExpense {
  id: string
  /** id kategori saran atau string custom (lowercase, mis. "ban", "cuci motor") */
  kategori: string
  /** Rupiah, integer >= 0 */
  jumlah: number
}

export interface ExpenseCategory {
  id: string
  label: string
}

/** Kategori saran — cukup 6 agar chip tetap muat di layar kecil. */
export const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  { id: 'ban', label: 'Ban bocor' },
  { id: 'makan', label: 'Makan/Minum' },
  { id: 'tol', label: 'Tol' },
  { id: 'parkir', label: 'Parkir' },
  { id: 'service', label: 'Service' },
  { id: 'lainnya', label: 'Lainnya' },
]

const CATEGORY_LABEL: Record<string, string> = {
  ban: 'Ban bocor',
  makan: 'Makan/Minum',
  tol: 'Tol',
  parkir: 'Parkir',
  service: 'Service',
  lainnya: 'Lainnya',
  // alias data lama / varian penulisan
  tambal: 'Ban bocor',
  'makan & minum': 'Makan/Minum',
  'service / perbaikan': 'Service',
  perbaikan: 'Service',
}

/** Label ramah-baca untuk id kategori (custom user ditampilkan Title Case). */
export function expenseLabel(kategori: string): string {
  const key = (kategori ?? '').trim().toLowerCase()
  if (!key) return 'Lainnya'
  const known = CATEGORY_LABEL[key]
  if (known) return known
  return key
    .split(/[\s_]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

function uid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `ex-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`
}

export function createExpense(kategori: string, jumlah: number = 0): ExtraExpense {
  return {
    id: uid(),
    kategori: (kategori ?? '').trim().toLowerCase() || 'lainnya',
    jumlah: Math.max(0, Math.round(Number(jumlah) || 0)),
  }
}

/** Total Rupiah satu hari. */
export function totalExtra(list: Pick<ExtraExpense, 'jumlah'>[] | undefined | null): number {
  if (!Array.isArray(list) || list.length === 0) return 0
  return list.reduce((a, e) => a + (Math.max(0, Math.round(Number(e?.jumlah) || 0))), 0)
}

function isValidExpense(e: unknown): e is ExtraExpense {
  if (!e || typeof e !== 'object') return false
  const o = e as Record<string, unknown>
  return typeof o.id === 'string' && typeof o.kategori === 'string' && Number.isFinite(Number(o.jumlah))
}

/** Bersihkan data dari localStorage / input user. Invalid dibuang, jumlah dibulatkan. */
export function normalizeExpenses(raw: unknown): ExtraExpense[] {
  if (!Array.isArray(raw)) return []
  const out: ExtraExpense[] = []
  for (const e of raw) {
    if (!isValidExpense(e)) continue
    const jumlah = Math.max(0, Math.round(Number(e.jumlah) || 0))
    const kategori = e.kategori.trim().toLowerCase() || 'lainnya'
    out.push({ id: e.id, kategori, jumlah })
    if (out.length >= 20) break // batas wajar per hari
  }
  return out
}
