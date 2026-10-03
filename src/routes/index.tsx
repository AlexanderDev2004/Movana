import { createFileRoute } from '@tanstack/react-router'
import * as React from 'react'
import { Onboarding } from '~/components/Onboarding'
import { WorkspaceHistory } from '~/components/WorkspaceHistory'
import { Calculator } from '~/components/home/Calculator'
import { RolePicker } from '~/components/home/RolePicker'
import { Badge } from '~/components/ui/badge'
import { Card, CardContent } from '~/components/ui/card'
import type { Role } from '~/lib/workspace'
import { useWorkspaces } from '~/lib/workspace'

export const Route = createFileRoute('/')({
  component: Dashboard,
})

export default function Dashboard() {
  const { workspaces, ready, create, setActiveId } = useWorkspaces()
  const [pendingRole, setPendingRole] = React.useState<Role | null>(null)
  const [openId, setOpenId] = React.useState<string | null>(null)

  const openWs = openId ? (workspaces.find((w) => w.id === openId) ?? null) : null

  React.useEffect(() => {
    if (!ready) return
    try {
      const id = localStorage.getItem('movana:open-workspace')
      if (id) {
        localStorage.removeItem('movana:open-workspace')
        setOpenId(id)
        setActiveId(id)
      }
    } catch {
      /* abaikan */
    }
  }, [ready, setActiveId])

  React.useEffect(() => {
    if (ready && openId && !openWs && workspaces.length > 0) setOpenId(null)
  }, [ready, openId, openWs, workspaces.length])

  if (!ready) {
    return <div className="max-w-xl mx-auto p-4 text-sm text-muted-foreground">Memuat...</div>
  }

  if (openWs) {
    return (
      <Calculator
        key={openWs.id}
        ws={openWs}
        workspaces={workspaces}
        onSwitch={(id) => {
          setActiveId(id)
          setOpenId(id)
        }}
        onCreate={() => {
          setOpenId(null)
          setPendingRole(null)
        }}
        onBack={() => setOpenId(null)}
      />
    )
  }

  return (
    <div className="max-w-xl mx-auto p-4 space-y-5">
      <header className="space-y-1">
        <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
          Movana • Catatan ojol harian
        </p>
        <h1 className="text-2xl font-bold tracking-tight">Hitung bersih harian dalam 30 detik.</h1>
        <p className="text-sm text-muted-foreground">
          Isi odometer pagi & malam. Langsung tahu bensin, biaya, dan sisa bersih.
        </p>
      </header>

      {pendingRole ? (
        <Card>
          <CardContent>
            <Onboarding
              key={pendingRole}
              initialRole={pendingRole}
              title={pendingRole === 'ojol' ? 'Ojol aplikasi apa?' : 'Bukan ojol — buat apa?'}
              onDone={(r) => {
                const ws = create({ name: r.name, role: r.role, platforms: r.platforms, jobType: r.jobType })
                setPendingRole(null)
                setOpenId(ws.id)
              }}
              onCancel={() => setPendingRole(null)}
            />
          </CardContent>
        </Card>
      ) : (
        <RolePicker onPick={setPendingRole} />
      )}

      {workspaces.length === 0 && !pendingRole && (
        <ol className="grid grid-cols-3 gap-2 text-center">
          <Step n="1" label="Pilih mode" />
          <Step n="2" label="Isi odo" />
          <Step n="3" label="Simpan" />
        </ol>
      )}

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="font-bold">Workspace</h2>
          <Badge variant="secondary">{workspaces.length} tersimpan</Badge>
        </div>
        <WorkspaceHistory onOpen={(id) => setOpenId(id)} />
      </div>

      <p className="text-xs text-muted-foreground">
        Data tersimpan di HP ini (localStorage). Bisa dibuka per workspace.
      </p>
    </div>
  )
}

function Step({ n, label }: { n: string; label: string }) {
  return (
    <li>
      <Card className="py-2 gap-0">
        <CardContent className="text-center">
          <div className="text-xs font-bold text-muted-foreground">{n}</div>
          <div className="text-sm font-medium">{label}</div>
        </CardContent>
      </Card>
    </li>
  )
}
