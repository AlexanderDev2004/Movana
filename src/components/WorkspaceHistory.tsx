import * as React from 'react'
import { Pencil, Trash2 } from 'lucide-react'
import type { Platform } from '~/lib/calc'
import type { NonOjolJob, Workspace } from '~/lib/workspace'
import {
  JOB_LABEL,
  PLATFORM_LABEL,
  PLATFORM_LIST,
  useWorkspaces,
  workspaceSubtitle,
} from '~/lib/workspace'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import { Card, CardContent } from '~/components/ui/card'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'

export function WorkspaceHistory({
  onOpen,
}: {
  onOpen?: (id: string) => void
  compact?: boolean
}) {
  const { workspaces, active, ready, setActiveId, update, remove } = useWorkspaces()
  const [editingId, setEditingId] = React.useState<string | null>(null)
  const [confirmId, setConfirmId] = React.useState<string | null>(null)

  if (!ready) return <p className="text-sm text-muted-foreground">Memuat riwayat...</p>
  if (workspaces.length === 0) {
    return (
      <Card className="border-dashed py-4">
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Belum ada workspace. Pilih mode di atas untuk buat yang pertama.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <ul className="space-y-2">
      {workspaces.map((w) => {
        const isActive = w.id === active?.id
        const isEditing = editingId === w.id
        return (
          <li key={w.id}>
            <Card className="py-3 gap-2">
              <CardContent className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <button
                    className="min-w-0 flex-1 text-left"
                    onClick={() => {
                      if (!onOpen || isEditing) return
                      setActiveId(w.id)
                      onOpen(w.id)
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm truncate">{w.name}</span>
                      {isActive && <Badge>Aktif</Badge>}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {workspaceSubtitle(w)} • {formatDate(w.createdAt)}
                    </div>
                  </button>
                  {!isEditing && (
                    <div className="flex gap-1.5 shrink-0">
                      {onOpen && (
                        <Button
                          size="sm"
                          onClick={() => {
                            setActiveId(w.id)
                            onOpen(w.id)
                          }}
                        >
                          Buka
                        </Button>
                      )}
                      <Button variant="outline" size="sm" onClick={() => setEditingId(w.id)}>
                        <Pencil aria-hidden /> Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-destructive border-destructive/40 hover:text-destructive hover:bg-destructive/10"
                        onClick={() => setConfirmId(w.id)}
                      >
                        <Trash2 aria-hidden /> Hapus
                      </Button>
                    </div>
                  )}
                </div>

                {isEditing && (
                  <EditForm
                    ws={w}
                    onCancel={() => setEditingId(null)}
                    onSave={(patch) => {
                      update(w.id, patch)
                      setEditingId(null)
                    }}
                  />
                )}

                {!isEditing && confirmId === w.id && (
                  <div className="flex items-center gap-2 rounded-xl bg-destructive/10 border border-destructive/30 p-2">
                    <span className="flex-1 text-xs">
                      Hapus <b>{w.name}</b>? Log-nya ikut tidak bisa dibuka.
                    </span>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => {
                        remove(w.id)
                        setConfirmId(null)
                        if (editingId === w.id) setEditingId(null)
                      }}
                    >
                      Ya, hapus
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setConfirmId(null)}>
                      Batal
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </li>
        )
      })}
    </ul>
  )
}

function EditForm({
  ws,
  onSave,
  onCancel,
}: {
  ws: Workspace
  onSave: (patch: { name?: string; platforms?: Platform[]; jobType?: NonOjolJob }) => void
  onCancel: () => void
}) {
  const [name, setName] = React.useState(ws.name)
  const [platforms, setPlatforms] = React.useState<Platform[]>(ws.platforms)
  const [job, setJob] = React.useState<NonOjolJob>(ws.jobType ?? 'pribadi')

  const toggle = (p: Platform) =>
    setPlatforms((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]))

  const save = () => {
    if (ws.role === 'ojol' && platforms.length === 0) {
      alert('Pilih minimal 1 platform')
      return
    }
    onSave(ws.role === 'ojol' ? { name, platforms } : { name, jobType: job })
  }

  return (
    <div className="rounded-xl bg-muted p-2.5 space-y-2">
      <div className="space-y-1.5">
        <Label htmlFor={`ws-name-${ws.id}`}>Nama workspace</Label>
        <Input id={`ws-name-${ws.id}`} value={name} onChange={(e) => setName(e.target.value)} />
      </div>

      {ws.role === 'ojol' ? (
        <div className="flex flex-wrap gap-1.5">
          {PLATFORM_LIST.map((p) => {
            const on = platforms.includes(p)
            return (
              <Button
                key={p}
                type="button"
                size="sm"
                variant={on ? 'default' : 'outline'}
                onClick={() => toggle(p)}
                aria-pressed={on}
              >
                {PLATFORM_LABEL[p]}
              </Button>
            )
          })}
        </div>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(JOB_LABEL) as NonOjolJob[]).map((j) => (
            <Button
              key={j}
              type="button"
              size="sm"
              variant={job === j ? 'default' : 'outline'}
              onClick={() => setJob(j)}
              aria-pressed={job === j}
            >
              {JOB_LABEL[j]}
            </Button>
          ))}
        </div>
      )}

      <div className="flex gap-1.5">
        <Button size="sm" onClick={save}>
          Simpan
        </Button>
        <Button size="sm" variant="outline" onClick={onCancel}>
          Batal
        </Button>
      </div>
    </div>
  )
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
  } catch {
    return ''
  }
}
