import * as React from 'react'
import type { Platform } from './calc'

export type Role = 'ojol' | 'non-ojol'
export type NonOjolJob = 'komuter' | 'kurir' | 'travel' | 'pribadi'

export interface Workspace {
  id: string
  name: string
  role: Role
  /** ojol: platform yang dipakai. 1 = single, >1 = multi */
  platforms: Platform[]
  /** non-ojol: jenis kerja */
  jobType?: NonOjolJob
  createdAt: string // ISO
}

export const PLATFORM_LABEL: Record<Platform, string> = {
  grab: 'Grab',
  gojek: 'Gojek',
  shopeefood: 'ShopeeFood',
  maxim: 'Maxim',
  lainnya: 'Lainnya',
}

export const PLATFORM_LIST: Platform[] = ['grab', 'gojek', 'shopeefood', 'maxim', 'lainnya']

export const JOB_LABEL: Record<NonOjolJob, string> = {
  komuter: 'Komuter / Karyawan',
  kurir: 'Kurir / Antar pribadi',
  travel: 'Travel / Ojek pangkalan',
  pribadi: 'Motor pribadi',
}

export const JOB_DESC: Record<NonOjolJob, string> = {
  komuter: 'PP kerja — catat bensin + parkir, tanpa pendapatan.',
  kurir: 'Order manual non-aplikasi — catat pendapatan sendiri.',
  travel: 'Tarif manual per trip — catat pendapatan sendiri.',
  pribadi: 'Pakai harian — pantau pengeluaran motor saja.',
}

const KEY_LIST = 'movana:workspaces'
const KEY_ACTIVE = 'movana:active-workspace'

function uid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `ws-${Date.now()}-${Math.floor(Math.random() * 1e6)}`
}

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback
  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function isValidWorkspace(w: unknown): w is Workspace {
  if (!w || typeof w !== 'object') return false
  const o = w as Record<string, unknown>
  return (
    typeof o.id === 'string' &&
    typeof o.name === 'string' &&
    (o.role === 'ojol' || o.role === 'non-ojol') &&
    Array.isArray(o.platforms)
  )
}

function sanitizeWorkspace(w: Workspace): Workspace {
  return {
    id: w.id,
    name: w.name || 'Workspace',
    role: w.role,
    platforms: Array.isArray(w.platforms) ? w.platforms.filter((p) => p in PLATFORM_LABEL) : [],
    jobType: w.jobType && w.jobType in JOB_LABEL ? w.jobType : w.role === 'non-ojol' ? 'pribadi' : undefined,
    createdAt: typeof w.createdAt === 'string' ? w.createdAt : new Date().toISOString(),
  }
}

export function loadWorkspaces(): Workspace[] {
  if (typeof localStorage === 'undefined') return []
  const raw = safeParse<unknown>(localStorage.getItem(KEY_LIST), [])
  if (!Array.isArray(raw)) return []
  return raw.filter(isValidWorkspace).map(sanitizeWorkspace)
}

export function loadActiveId(): string | null {
  if (typeof localStorage === 'undefined') return null
  return localStorage.getItem(KEY_ACTIVE)
}

export function defaultWorkspaceName(role: Role, platforms: Platform[], job?: NonOjolJob): string {
  if (role === 'ojol') {
    if (platforms.length === 1) return `Ojol ${PLATFORM_LABEL[platforms[0]]}`
    if (platforms.length > 1) return `Ojol Multi (${platforms.length} aplikasi)`
    return 'Ojol'
  }
  return job ? JOB_LABEL[job] : 'Non-ojol'
}

export function createWorkspace(input: {
  name?: string
  role: Role
  platforms?: Platform[]
  jobType?: NonOjolJob
}): Workspace {
  const ws: Workspace = {
    id: uid(),
    name: input.name?.trim() || defaultWorkspaceName(input.role, input.platforms ?? [], input.jobType),
    role: input.role,
    platforms: input.role === 'ojol' ? (input.platforms?.length ? input.platforms : ['lainnya']) : [],
    jobType: input.role === 'non-ojol' ? (input.jobType ?? 'pribadi') : undefined,
    createdAt: new Date().toISOString(),
  }
  const list = loadWorkspaces()
  localStorage.setItem(KEY_LIST, JSON.stringify([...list, ws]))
  localStorage.setItem(KEY_ACTIVE, ws.id)
  return ws
}

/** Apakah workspace ini mencatat pendapatan? komuter & pribadi = pengeluaran saja. */
export function tracksIncome(ws: Workspace | null | undefined): boolean {
  if (!ws) return true
  if (ws.role === 'ojol') return true
  return ws.jobType === 'kurir' || ws.jobType === 'travel'
}

export function isMultiPlatform(ws: Workspace | null | undefined): boolean {
  if (!ws) return false
  return ws.role === 'ojol' && Array.isArray(ws.platforms) && ws.platforms.length > 1
}

export function workspaceSubtitle(ws: Workspace | null | undefined): string {
  if (!ws) return ''
  if (ws.role === 'ojol') {
    const names = (ws.platforms ?? []).map((p) => PLATFORM_LABEL[p] ?? p).join(' + ')
    return ws.platforms.length > 1 ? `Ojol multi-platform: ${names}` : `Ojol ${names}`
  }
  return JOB_LABEL[ws.jobType ?? 'pribadi']
}

export function workspaceIcon(ws: Workspace | null | undefined): string {
  if (!ws) return '🛵'
  if (ws.role === 'ojol') return '🛵'
  switch (ws.jobType) {
    case 'komuter':
      return '🏢'
    case 'kurir':
      return '📦'
    case 'travel':
      return '🧭'
    default:
      return '🏍️'
  }
}

export function logKey(workspaceId: string | null): string {
  return workspaceId ? `movana:log-harian:${workspaceId}` : 'movana:log-harian'
}

/** Sumber KM sebuah entri log harian */
export type EntrySumber = 'manual' | 'linimasa'

export interface LogEntry {
  tanggal: string // YYYY-MM-DD
  odoAwal: number
  odoAkhir: number
  kotor: number
  /** Bila diisi (hasil import Linimasa), KM diambil dari sini, bukan odoAkhir-odoAwal */
  totalKm?: number
  /** Biaya BBM (Rp). Entri lama bisa kosong → dianggap 0. */
  biayaBensin?: number
  /** Biaya lain (Rp, parkir/makan/dll). Opsional. */
  biayaLain?: number
  sumber?: EntrySumber
  rincianKm?: { motor: number; mobil: number; jalan: number; lain: number }
  /** Rincian pendapatan per platform (mode multi). Opsional. */
  rincian?: { platform: string; jumlah: number }[]
}

/** KM sebuah entri: prioritas totalKm (estimasi Linimasa), fallback selisih odometer */
export function kmOf(e: Pick<LogEntry, 'totalKm' | 'odoAwal' | 'odoAkhir'>): number {
  if (typeof e.totalKm === 'number' && Number.isFinite(e.totalKm)) return e.totalKm
  return (e.odoAkhir ?? 0) - (e.odoAwal ?? 0)
}

/** Biaya BBM sebuah entri (default 0 untuk entri lama). */
export function bbmOf(e: Pick<LogEntry, 'biayaBensin'>): number {
  return typeof e.biayaBensin === 'number' && Number.isFinite(e.biayaBensin)
    ? Math.max(0, Math.round(e.biayaBensin))
    : 0
}

/** Biaya lain sebuah entri (default 0). */
export function biayaLainOf(e: Pick<LogEntry, 'biayaLain'>): number {
  return typeof e.biayaLain === 'number' && Number.isFinite(e.biayaLain)
    ? Math.max(0, Math.round(e.biayaLain))
    : 0
}

/** Bersih = kotor − (BBM + lain). Untuk mode tanpa pendapatan (kotor 0) hasilnya minus = pengeluaran. */
export function bersihOf(e: Pick<LogEntry, 'kotor' | 'biayaBensin' | 'biayaLain'>): number {
  return (Math.round(e.kotor) || 0) - bbmOf(e) - biayaLainOf(e)
}

function importHashKey(workspaceId: string | null): string {
  return workspaceId ? `movana:import-hash:${workspaceId}` : 'movana:import-hash'
}

export function loadImportHashes(workspaceId: string | null): string[] {
  if (typeof localStorage === 'undefined') return []
  try {
    const raw = localStorage.getItem(importHashKey(workspaceId))
    const arr = raw ? JSON.parse(raw) : []
    return Array.isArray(arr) ? arr.filter((x) => typeof x === 'string') : []
  } catch {
    return []
  }
}

export function saveImportHash(workspaceId: string | null, hash: string): void {
  if (typeof localStorage === 'undefined') return
  const next = [...loadImportHashes(workspaceId), hash].slice(-20)
  localStorage.setItem(importHashKey(workspaceId), JSON.stringify(next))
}

/** Hook klien: daftar workspace + workspace aktif. Aman untuk SSR (isi setelah mount). */
export function useWorkspaces() {
  const [workspaces, setWorkspaces] = React.useState<Workspace[]>([])
  const [activeId, setActiveIdState] = React.useState<string | null>(null)
  const [ready, setReady] = React.useState(false)

  const refresh = React.useCallback(() => {
    setWorkspaces(loadWorkspaces())
    setActiveIdState(loadActiveId())
    setReady(true)
  }, [])

  React.useEffect(() => {
    refresh()
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY_LIST || e.key === KEY_ACTIVE) refresh()
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [refresh])

  const active: Workspace | null =
    workspaces.find((w) => w && w.id === activeId) ?? workspaces[0] ?? null

  const setActiveId = (id: string) => {
    localStorage.setItem(KEY_ACTIVE, id)
    setActiveIdState(id)
  }

  const create = (input: { name?: string; role: Role; platforms?: Platform[]; jobType?: NonOjolJob }) => {
    const ws = createWorkspace(input)
    refresh()
    return ws
  }

  const update = (id: string, patch: { name?: string; platforms?: Platform[]; jobType?: NonOjolJob }) => {
    const ws = updateWorkspace(id, patch)
    refresh()
    return ws
  }

  const remove = (id: string) => {
    const next = loadWorkspaces().filter((w) => w.id !== id)
    localStorage.setItem(KEY_LIST, JSON.stringify(next))
    if (loadActiveId() === id) {
      if (next.length > 0) localStorage.setItem(KEY_ACTIVE, next[0].id)
      else localStorage.removeItem(KEY_ACTIVE)
    }
    refresh()
  }

  return { workspaces, active, activeId: active?.id ?? null, ready, refresh, setActiveId, create, update, remove }
}

export function updateWorkspace(
  id: string,
  patch: { name?: string; platforms?: Platform[]; jobType?: NonOjolJob },
): Workspace | null {
  if (typeof localStorage === 'undefined') return null
  const list = loadWorkspaces()
  const idx = list.findIndex((w) => w.id === id)
  if (idx === -1) return null
  const cur = list[idx]
  const next: Workspace = sanitizeWorkspace({
    ...cur,
    name: patch.name?.trim() ? patch.name.trim() : cur.name,
    platforms: cur.role === 'ojol' && patch.platforms ? patch.platforms : cur.platforms,
    jobType: cur.role === 'non-ojol' && patch.jobType ? patch.jobType : cur.jobType,
  })
  // jaga-jaga: ojol wajib minimal 1 platform
  if (next.role === 'ojol' && next.platforms.length === 0) next.platforms = ['lainnya']
  list[idx] = next
  localStorage.setItem(KEY_LIST, JSON.stringify(list))
  return next
}
