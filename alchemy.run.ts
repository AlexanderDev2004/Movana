// @ts-nocheck
/**
 * Movana infra via Alchemy (https://alchemy.run).
 * Stack: Cloudflare Worker (TanStack Start) + D1 (SQLite) + R2 (foto struk/odo) + KV (sesi).
 *
 * Cara pakai:
 *   pnpm exec alchemy plan     # lihat diff
 *   pnpm exec alchemy deploy   # apply ke Cloudflare (butuh CLOUDFLARE_API_TOKEN)
 *   pnpm exec alchemy destroy  # hapus stack
 */
import * as alchemy from 'alchemy'
import { Cloudflare } from 'alchemy/cloudflare'

const app = await alchemy.run(async () => {
  const db = Cloudflare.D1.Database('movana-db', {
    name: 'movana-db',
    // migrations: './drizzle', // aktifkan setelah `drizzle-kit generate`
  })

  const receipts = Cloudflare.R2.Bucket('movana-receipts', {
    name: 'movana-receipts',
  })

  const sessions = Cloudflare.KV.Namespace('movana-sessions', {
    title: 'movana-sessions',
  })

  const worker = Cloudflare.Worker('movana-web', {
    name: 'movana-web',
    main: './dist/server/server.js',
    compatibility: 'nodejs_compat',
    env: { DB: db, RECEIPTS: receipts, SESSIONS: sessions },
  })

  return { url: worker.url, db: db.id }
})

export default app
