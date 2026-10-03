# 🛵 Movana — Catatan Cuan Driver Ojek Harian

Website untuk driver sampingan (Grab / Gojek / ShopeeFood / Maxim / dll):
**Odometer Awal−Akhir → Total KM → Liter Bensin → Biaya → Pendapatan Bersih/hari.**

Stack sesuai keputusan: **TanStack Start + Cloudflare D1 (Drizzle) + Alchemy** untuk infra.
Elysia sengaja tidak dipakai di MVP (Start server functions sudah cukup; bisa ditambah nanti untuk API publik).

## Rumus inti (`src/lib/calc.ts`)

```
totalKm    = odoAkhir - odoAwal
liter      = totalKm / kmPerLiter
biayaBensin= liter × hargaBbmPerLiter
totalBiaya = biayaBensin + biayaLain
bersih     = kotor - totalBiaya
```

## Struktur

```
alchemy.run.ts          # Infra: Worker movana-web + D1 movana-db + R2 + KV
drizzle.config.ts       # Drizzle SQLite / D1
src/db/schema.ts        # users, vehicles, fuel_prices, daily_logs, incomes, expenses
src/lib/calc.ts         # hitungHarian() + formatRp() (sudah dites via build)
src/routes/
  index.tsx             # Dashboard + kalkulator odometer
  log-harian.tsx        # Input harian (sementara localStorage → nanti D1)
  kendaraan.tsx         # Multi motor/mobil + jenis BBM
  laporan.tsx           # Rekap + export CSV
```

## Jalankan lokal

```bash
cd Movana
npm install
npm run dev      # http://localhost:3000
```

## Deploy via Alchemy (butuh Cloudflare token)

```bash
npx alchemy plan
npx alchemy deploy
```

Catatan D1: uang = INTEGER rupiah, hindari float. `drizzle-kit generate` setelah schema final,
lalu aktifkan `migrations` di `alchemy.run.ts`.
