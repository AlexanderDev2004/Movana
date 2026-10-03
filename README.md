# 🛵 Movana — Catatan Cuan Driver Ojek Harian

Website untuk driver sampingan (Grab / Gojek / ShopeeFood / Maxim / dll):
**Odometer Awal−Akhir → Total KM → Liter Bensin → Biaya → Pendapatan Bersih/hari.**

* **Demo lokal:** `npm run dev` → http://localhost:3000
* **Setup lengkap:** lihat [`docs/SETUP.md`](docs/SETUP.md) (install, build, D1, deploy Cloudflare)
* **Konsep & rumus:** lihat [`README-MOVANA.md`](README-MOVANA.md)

## Mulai cepat

```sh
npm install --legacy-peer-deps
npm run dev
```

## Stack

TanStack Start (React 19) + Tailwind CSS v4 + Drizzle ORM (Cloudflare D1) + Alchemy (Worker/D1/R2/KV).

## Lisensi

MIT — lihat `LICENSE`.
