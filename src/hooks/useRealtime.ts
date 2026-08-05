import { useEffect } from 'react'
import { useData } from '@/store/data'

/**
 * Subscribes to workspace changes for as long as a workspace is loaded.
 *
 * No-op in local mode — `LocalBackend.subscribe` returns an empty unsubscribe —
 * so this hook can mount unconditionally.
 */
export function useRealtime() {
  const backend = useData((s) => s.backend)
  const workspaceId = useData((s) => s.workspace?.id)
  const applyRemote = useData((s) => s.applyRemote)

  useEffect(() => {
    if (!backend || !workspaceId) return
    return backend.subscribe(workspaceId, applyRemote)
  }, [backend, workspaceId, applyRemote])
}
