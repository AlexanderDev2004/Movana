# Setup Movana (Lokal → Deploy)

Panduan menjalankan Movana di komputer sendiri sampai deploy ke Cloudflare.
Sudah diverifikasi di Node v24 + pnpm 12.

## 1. Prasyarat

| Kebutuhan | Keterangan |
|---|---|
| Node.js | v20+ (teruji di v24.21.0) |
| pnpm | v10+ (teruji v12.4.1, dipin via `packageManager`) |
| Akun Cloudflare | Hanya untuk deploy, tidak perlu untuk jalan lokal |
| `CLOUDFLARE_API_TOKEN` | Hanya untuk deploy via Alchemy |

Cek versi:

```sh
node --version
pnpm --version
```

Kalau `pnpm` belum ada: `corepack enable` (bawaan Node 20+) lalu `corepack prepare pnpm@12.4.1 --activate`.

## 2. Install

```sh
git clone https://github.com/AlexanderDev2004/Movana.git
cd Movana
pnpm install
```

> Install pertama menanyakan persetujuan build script (`esbuild`, `workerd`) —
> jawab ya, atau non-interaktif: `pnpm approve-builds --all`.
> Persetujuan tersimpan di `pnpm-workspace.yaml` (`allowBuilds`), jadi cukup sekali.

### Kalau `pnpm build` error `Cannot find native binding`

Ini soal optional-dependencies `rolldown` (bundler bawaan Vite 8). Perbaikannya:

```sh
pnpm install
pnpm build
```

## 3. Jalan lokal

```sh
pnpm dev
```

Buka **http://localhost:3000**. Tidak perlu `.env`, database, atau login —
data tersimpan di `localStorage` browser (`movana:workspaces`, `movana:log-harian:*`).

| Script | Fungsi |
|---|---|
| `pnpm dev` | Dev server (port 3000) |
| `pnpm build` | Build produksi (`vite build && tsc --noEmit`) → `dist/` |
| `pnpm preview` | Pratinjau hasil build |
| `pnpm test:e2e` | Test Playwright (butuh `pnpm exec playwright install chromium` sekali) |

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
pnpm exec drizzle-kit generate   # hasilkan file migrasi ke ./drizzle/
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
pnpm exec alchemy plan     # lihat diff infra dulu
pnpm exec alchemy deploy   # apply: Worker movana-web + D1 + R2 + KV
```

Hapus stack bila perlu:

```sh
pnpm exec alchemy destroy
```

## 7. Troubleshooting

| Gejala | Solusi |
|---|---|
| `ERR_PNPM_IGNORED_BUILDS` saat install | Jalankan `pnpm approve-builds --all` (sekali saja, tersimpan di `pnpm-workspace.yaml`) |
| `Cannot find native binding` / `@rolldown/binding-*` saat build | Reinstall: `pnpm install`, lalu build ulang |
| Port 3000 dipakai | Matikan proses lama atau `pnpm dev -- --port 3001` |
| Data hilang setelah clear browser | Wajar — MVP masih localStorage; migrasi D1 menyusul (bagian 5) |

## Lisensi

MIT — lihat `LICENSE`.
