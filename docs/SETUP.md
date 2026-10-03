# Setup Movana (Lokal → Deploy)

Panduan menjalankan Movana di komputer sendiri sampai deploy ke Cloudflare.
Sudah diverifikasi di Node v24 + npm 11.

## 1. Prasyarat

| Kebutuhan | Keterangan |
|---|---|
| Node.js | v20+ (teruji di v24.21.0) |
| npm | v10+ (teruji v11.19.0) |
| Akun Cloudflare | Hanya untuk deploy, tidak perlu untuk jalan lokal |
| `CLOUDFLARE_API_TOKEN` | Hanya untuk deploy via Alchemy |

Cek versi:

```sh
node --version
npm --version
```

## 2. Install

```sh
git clone https://github.com/AlexanderDev2004/Movana.git
cd Movana
npm install --legacy-peer-deps
```

> **Kenapa `--legacy-peer-deps`?**
> `alchemy@2.0.0-beta.79` meminta `drizzle-kit@1.0.0-rc.5-ab785fc` sebagai peer
> optional, sedangkan project memakai `drizzle-kit@^0.31.10`.
> Tanpa flag ini `npm install` gagal dengan `ERESOLVE`.
> Flag ini tidak mengubah `package.json`, hanya cara resolve npm.

### Kalau `npm run build` error `Cannot find native binding`

Ini bug optional-dependencies npm ([npm/cli#4828](https://github.com/npm/cli/issues/4828))
yang dialami `rolldown` (bundler bawaan Vite 8). Perbaikannya:

```sh
npm install --legacy-peer-deps --no-audit --no-fund
npm run build
```

## 3. Jalan lokal

```sh
npm run dev
```

Buka **http://localhost:3000**. Tidak perlu `.env`, database, atau login —
data tersimpan di `localStorage` browser (`movana:workspaces`, `movana:log-harian:*`).

| Script | Fungsi |
|---|---|
| `npm run dev` | Dev server (port 3000) |
| `npm run build` | Build produksi (`vite build && tsc --noEmit`) → `dist/` |
| `npm run preview` | Pratinjau hasil build |
| `npm run test:e2e` | Test Playwright (butuh `npx playwright install chromium` sekali) |

## 4. Struktur project

```
alchemy.run.ts      # Infra: Worker movana-web + D1 movana-db + R2 + KV
drizzle.config.ts   # Konfig Drizzle (SQLite / D1)
src/
  db/schema.ts      # Skema D1: users, vehicles, fuel_prices, daily_logs, incomes, expenses
  lib/calc.ts       # Rumus inti hitungHarian() + formatRp()
  lib/workspace.ts  # Workspace + localStorage (multi-mode ojol / non-ojol)
  lib/daily-log.ts  # Simpan log harian (localStorage, max 60 entri/workspace)
  lib/timeline.ts   # Parser export Google Timeline JSON → KM harian
  routes/index.tsx  # Dashboard + kalkulator odometer
  routes/workspace.tsx  # Halaman kelola workspace
  components/       # Onboarding, Calculator, WorkspaceHistory, ui/*
```

Rumus inti (`src/lib/calc.ts`):

```
totalKm     = odoAkhir - odoAwal
liter       = totalKm / kmPerLiter
biayaBensin = liter × hargaBbmPerLiter
totalBiaya  = biayaBensin + biayaLain
bersih      = kotor - totalBiaya
```

Uang selalu INTEGER rupiah, hindari float.

## 5. Database D1 (opsional, untuk deploy)

Skema sudah jadi (`src/db/schema.ts`) tapi migrasi belum digenerate.
Setelah skema final:

```sh
npx drizzle-kit generate   # hasilkan file migrasi ke ./drizzle/
```

Lalu aktifkan migrasi di `alchemy.run.ts` (buka komentar baris `migrations`):

```ts
const db = Cloudflare.D1.Database('movana-db', {
  name: 'movana-db',
  migrations: './drizzle', // <-- aktifkan
})
```

## 6. Deploy ke Cloudflare (via Alchemy)

Butuh `CLOUDFLARE_API_TOKEN` (buat di dash.cloudflare.com → My Profile → API Tokens,
template **Workers + D1 + R2 + KV** atau token dengan izin tersebut).

```sh
export CLOUDFLARE_API_TOKEN="<token>"
npx alchemy plan     # lihat diff infra dulu
npx alchemy deploy   # apply: Worker movana-web + D1 + R2 + KV
```

Hapus stack bila perlu:

```sh
npx alchemy destroy
```

## 7. Troubleshooting

| Gejala | Solusi |
|---|---|
| `ERESOLVE ... alchemy ... drizzle-kit` saat install | Pakai `npm install --legacy-peer-deps` |
| `Cannot find native binding` / `@rolldown/binding-*` saat build | Reinstall: `npm install --legacy-peer-deps`, lalu build ulang |
| Port 3000 dipakai | Matikan proses lama atau `npm run dev -- --port 3001` |
| Data hilang setelah clear browser | Wajar — MVP masih localStorage; migrasi D1 menyusul (bagian 5) |

## Lisensi

MIT — lihat `LICENSE`.
