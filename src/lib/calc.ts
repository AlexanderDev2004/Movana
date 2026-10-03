import { z } from 'zod'

/** Platform ojek yang didukung Movana */
export const PLATFORMS = ['grab', 'gojek', 'shopeefood', 'maxim', 'lainnya'] as const
export type Platform = (typeof PLATFORMS)[number]

export const dailyCalcInput = z.object({
  odoAwal: z.number().nonnegative('Odo awal tidak boleh negatif'),
  odoAkhir: z.number().nonnegative('Odo akhir tidak boleh negatif'),
  kmPerLiter: z.number().positive('Konsumsi BBM harus > 0'),
  hargaBbmPerLiter: z.number().nonnegative(),
  pendapatanKotor: z.number().nonnegative(),
  biayaLain: z.number().nonnegative().default(0),
})

export type DailyCalcInput = z.infer<typeof dailyCalcInput>

export interface DailyCalcResult {
  totalKm: number
  liter: number
  biayaBensin: number
  totalBiaya: number
  bersih: number
  bersihPerKm: number
}

/** Inti hitungan Movana: odometer -> bersih. Uang dalam Rupiah (integer). */
export function hitungHarian(input: DailyCalcInput): DailyCalcResult {
  const parsed = dailyCalcInput.parse(input)
  if (parsed.odoAkhir < parsed.odoAwal) {
    throw new Error('Odo akhir harus >= odo awal')
  }
  const totalKm = parsed.odoAkhir - parsed.odoAwal
  const liter = totalKm === 0 ? 0 : totalKm / parsed.kmPerLiter
  const biayaBensin = Math.round(liter * parsed.hargaBbmPerLiter)
  const totalBiaya = biayaBensin + Math.round(parsed.biayaLain)
  const bersih = Math.round(parsed.pendapatanKotor) - totalBiaya
  const bersihPerKm = totalKm === 0 ? 0 : Math.round(bersih / totalKm)
  return { totalKm, liter: Math.round(liter * 100) / 100, biayaBensin, totalBiaya, bersih, bersihPerKm }
}

export function formatRp(n: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(n)
}
