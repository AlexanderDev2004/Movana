import * as React from 'react'

type Device = 'android' | 'ios' | 'pc' | 'mac'

const DEVICES: { id: Device; label: string }[] = [
  { id: 'android', label: '🤖 Android' },
  { id: 'ios', label: '🍎 iPhone / iPad' },
  { id: 'pc', label: '🖥️ PC / Laptop' },
  { id: 'mac', label: '🍏 Mac' },
]

const GUIDES: Record<Device, { steps: string[]; notes: string[] }> = {
  android: {
    steps: [
      'Buka Pengaturan HP → Lokasi → Layanan lokasi → Linimasa (Timeline).',
      'Pilih akun Google yang dipakai ngojol.',
      'Ketuk Export data linimasa / Ekspor, lalu simpan file location-history.json.',
      'Kembali ke halaman ini → upload file tersebut.',
    ],
    notes: [
      'Menu tidak ada? Update dulu aplikasi Google Maps + Google Play Services.',
      'Jalan lain: Google Maps → foto profil → Setelan → Konten pribadi → Export Timeline data.',
    ],
  },
  ios: {
    steps: [
      'Buka Google Maps → ketuk foto profil → Setelan → Konten pribadi.',
      'Ketuk Export Timeline data, lalu simpan ke app Files.',
      'Kembali ke halaman ini → upload file JSON tersebut.',
    ],
    notes: [
      'Pastikan Backup Linimasa aktif di pengaturan Timeline supaya datanya lengkap.',
      'Alternatif: buka takeout.google.com di Safari → Location History (Timeline) → export.',
    ],
  },
  pc: {
    steps: [
      'Export dulu dari HP (pilih 🤖 Android / 🍎 iPhone di atas) — data Linimasa kini tersimpan di HP, bukan di cloud.',
      'Pindahkan file JSON ke komputer: kabel USB, Google Drive, atau kirim ke diri sendiri.',
      'Upload file tersebut di halaman ini.',
    ],
    notes: [
      'Alternatif: takeout.google.com → Location History (Timeline) → export. Catatan: hasilnya kadang hanya berisi Settings.json (kosong).',
    ],
  },
  mac: {
    steps: [
      'Export dulu dari HP (pilih 🤖 Android / 🍎 iPhone di atas) — data Linimasa kini tersimpan di HP, bukan di cloud.',
      'Kirim file JSON ke Mac via AirDrop (iPhone) atau kabel USB / Google Drive (Android).',
      'Upload file tersebut di halaman ini.',
    ],
    notes: [
      'Alternatif: takeout.google.com di browser → Location History (Timeline) → export. Catatan: hasilnya kadang hanya berisi Settings.json (kosong).',
    ],
  },
}

export function TakeoutGuide() {
  const [device, setDevice] = React.useState<Device>('android')
  const guide = GUIDES[device]

  return (
    <details className="text-xs text-muted-foreground">
      <summary className="cursor-pointer">Cara dapat file JSON-nya</summary>
      <div className="mt-2 space-y-2">
        <label className="flex items-center gap-2">
          <span className="shrink-0">Perangkat:</span>
          <select
            className="border-input rounded-md border bg-transparent px-2 py-1.5 text-xs w-full"
            value={device}
            onChange={(e) => setDevice(e.target.value as Device)}
            aria-label="Pilih perangkat"
          >
            {DEVICES.map((d) => (
              <option key={d.id} value={d.id}>
                {d.label}
              </option>
            ))}
          </select>
        </label>
        <ol className="list-decimal pl-4 space-y-0.5">
          {guide.steps.map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ol>
        {guide.notes.map((n, i) => (
          <p key={i} className="rounded-lg bg-muted px-2 py-1">
            💡 {n}
          </p>
        ))}
        <p>File dibaca di perangkat ini saja, tidak dikirim ke mana pun.</p>
      </div>
    </details>
  )
}
