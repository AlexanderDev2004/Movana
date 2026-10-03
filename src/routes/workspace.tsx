import { createFileRoute, useNavigate } from '@tanstack/react-router'
import * as React from 'react'
import { Onboarding } from '~/components/Onboarding'
import { WorkspaceHistory } from '~/components/WorkspaceHistory'
import { useWorkspaces } from '~/lib/workspace'

export const Route = createFileRoute('/workspace')({
  component: WorkspacePage,
})

function WorkspacePage() {
  const { workspaces, ready, create, setActiveId, refresh } = useWorkspaces()
  const [creating, setCreating] = React.useState(false)
  const navigate = useNavigate()

  React.useEffect(() => {
    refresh()
  }, [refresh])

  if (!ready) return <div className="max-w-2xl mx-auto p-4 text-sm opacity-60">Memuat...</div>

  if (creating) {
    return (
      <Onboarding
        title="Buat workspace baru"
        onDone={(r) => {
          const ws = create({ name: r.name, role: r.role, platforms: r.platforms, jobType: r.jobType })
          setCreating(false)
          setActiveId(ws.id)
          navigate({ to: '/' })
        }}
        onCancel={() => setCreating(false)}
      />
    )
  }

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">🗂️ Workspace</h1>
          <p className="text-sm opacity-70">Riwayat mode yang pernah dibuat. Bisa dibuka, diedit, dan dihapus.</p>
        </div>
        <button
          onClick={() => setCreating(true)}
          className="bg-black text-white dark:bg-white dark:text-black rounded px-4 py-2 text-sm"
        >
          + Create
        </button>
      </div>

      {workspaces.length === 0 && (
        <p className="text-sm opacity-60">Belum ada workspace. Tekan Create untuk mulai.</p>
      )}

      <WorkspaceHistory
        onOpen={(id) => {
          setActiveId(id)
          try {
            localStorage.setItem('movana:open-workspace', id)
          } catch { /* abaikan */ }
          navigate({ to: '/' })
        }}
      />

      <p className="text-xs opacity-60">
        Data tersimpan di HP ({workspaces.length} workspace). Nanti pindah ke D1 + login tanpa ubah alur.
      </p>
    </div>
  )
}
