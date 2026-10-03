import { logKey } from './workspace'

interface ManualEntryInput {
  odoAwal: number
  odoAkhir: number
  kotor: number
  rincian?: { platform: string; jumlah: number }[]
}

export function saveManualLog(workspaceId: string, input: ManualEntryInput): boolean {
  try {
    const key = logKey(workspaceId)
    const raw = localStorage.getItem(key) ?? '[]'
    const list = JSON.parse(raw)
    const entry = {
      tanggal: new Date().toISOString().slice(0, 10),
      odoAwal: input.odoAwal,
      odoAkhir: input.odoAkhir,
      kotor: input.kotor,
      sumber: 'manual' as const,
      rincian: input.rincian,
    }
    localStorage.setItem(key, JSON.stringify([entry, ...list].slice(0, 60)))
    return true
  } catch {
    return false
  }
}
