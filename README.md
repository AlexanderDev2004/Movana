# 🛵 Movana — Catatan Cuan Driver Ojek Harian

Website untuk driver sampingan (Grab / Gojek / ShopeeFood / Maxim / dll):
**Odometer Awal−Akhir → Total KM → Liter Bensin → Biaya → Pendapatan Bersih/hari.**

* **Setup lengkap:** lihat [`docs/SETUP.md`](docs/SETUP.md) (install, build, D1, deploy Cloudflare)
* **Konsep & rumus:** lihat [`README-MOVANA.md`](README-MOVANA.md)

## Mulai cepat

Butuh Node.js v20+ dan pnpm v10+ (`corepack enable` kalau belum ada).

```sh
pnpm install
pnpm dev      # http://localhost:3000
```

## Fitur

* **Odo manual** — isi odometer pagi & malam, konsumsi motor, harga BBM, biaya lain, dan pendapatan (single/multi-platform). Hasil bersih langsung tampil, satu klik simpan ke log.
* **Import Timeline** — upload export Linimasa Google (JSON), KM motor per hari terisi otomatis. Bisa koreksi KM, isi BBM aktual SPBU, isi pendapatan massal, lalu simpan sekaligus.
* **Riwayat** (`/riwayat`) — ringkasan Total Bersih / Total KM / Total BBM / Jumlah Hari, filter Minggu ini / Bulan ini / Semua / Custom + toggle pendapatan, tabel log per tanggal dengan badge sumber (Timeline/Manual) dan aksi Edit/Hapus.
* **Workspace** — multi-mode (Ojol single/multi-platform, Komuter, Kurir, Travel, Pribadi). Data tersimpan di `localStorage` per workspace, siap migrasi ke D1 + login.

## Script

| Script | Fungsi |
|---|---|
| `pnpm dev` | Dev server (port 3000) |
| `pnpm build` | Build produksi (`vite build && tsc --noEmit`) → `dist/` |
| `pnpm preview` | Pratinjau hasil build |
| `pnpm test:e2e` | Test Playwright |

## Stack

TanStack Start (React 19) + Tailwind CSS v4 + Drizzle ORM (Cloudflare D1) + Alchemy (Worker/D1/R2/KV).

## Lisensi

MIT — lihat `LICENSE`.
