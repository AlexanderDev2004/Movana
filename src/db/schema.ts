import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core'

/**
 * Skema D1 (SQLite) untuk Movana.
 * Uang disimpan sebagai INTEGER rupiah. Jarak sebagai INTEGER km.
 */

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  nama: text('nama').notNull(),
  passwordHash: text('password_hash').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
})

export const vehicles = sqliteTable('vehicles', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id),
  nama: text('nama').notNull(), //cth: Vario 160, Sigra
  tipe: text('tipe').notNull().default('motor'), // motor | mobil
  kmPerLiter: real('km_per_liter').notNull(), // konsumsi, cth: 45
  jenisBbm: text('jenis_bbm').notNull().default('Pertalite'),
})

export const fuelPrices = sqliteTable('fuel_prices', {
  id: text('id').primaryKey(),
  jenisBbm: text('jenis_bbm').notNull(),
  harga: integer('harga').notNull(), // Rp/liter
  berlakuDari: text('berlaku_dari').notNull(), // YYYY-MM-DD
})

export const dailyLogs = sqliteTable('daily_logs', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id),
  vehicleId: text('vehicle_id').references(() => vehicles.id),
  tanggal: text('tanggal').notNull(), // YYYY-MM-DD
  odoAwal: integer('odo_awal').notNull(),
  odoAkhir: integer('odo_akhir').notNull(),
  totalKm: integer('total_km').notNull(),
  liter: real('liter').notNull(),
  biayaBensin: integer('biaya_bensin').notNull(),
  biayaLain: integer('biaya_lain').notNull().default(0),
  pendapatanKotor: integer('pendapatan_kotor').notNull().default(0),
  pendapatanBersih: integer('pendapatan_bersih').notNull().default(0),
})

/** Rincian opsional per platform (Level 2). Kosong = user pakai mode simple. */
export const incomes = sqliteTable('incomes', {
  id: text('id').primaryKey(),
  logId: text('log_id')
    .notNull()
    .references(() => dailyLogs.id),
  platform: text('platform').notNull(), // grab | gojek | shopeefood | maxim | lainnya
  jumlah: integer('jumlah').notNull(),
  jumlahOrder: integer('jumlah_order').notNull().default(0),
})

/** Biaya lain dengan kategori bebas per user (Level 3). */
export const expenses = sqliteTable('expenses', {
  id: text('id').primaryKey(),
  logId: text('log_id')
    .notNull()
    .references(() => dailyLogs.id),
  kategori: text('kategori').notNull(), // Parkir | Makan | Pulsa | Servis | ...
  jumlah: integer('jumlah').notNull(),
  keterangan: text('keterangan'),
})
