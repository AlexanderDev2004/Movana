import * as React from 'react'
import { useWorkspaces, workspaceIcon } from '~/lib/workspace'

export function WorkspaceNav() {
  const { workspaces, active, ready, setActiveId } = useWorkspaces()
  const [mounted, setMounted] = React.useState(false)
  React.useEffect(() => setMounted(true), [])
  if (!mounted || !ready || workspaces.length === 0) return null
  return (
    <select
      className="border rounded px-1.5 py-1 text-xs bg-transparent max-w-[140px]"
      value={active?.id ?? ''}
      onChange={(e) => setActiveId(e.target.value)}
      title="Workspace aktif"
    >
      {workspaces.map((w) => (
        <option key={w.id} value={w.id}>
          {workspaceIcon(w)} {w.name}
        </option>
      ))}
    </select>
  )
}
