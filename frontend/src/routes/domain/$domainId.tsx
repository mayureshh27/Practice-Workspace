import { createFileRoute } from '@tanstack/react-router'
import { DomainScreen } from '../../components/ExplorerScreens'
import { useWorkspaceStore } from '../../stores/workspaceStore'
import { useUIStore } from '../../stores/uiStore'

export const Route = createFileRoute('/domain/$domainId')({
  component: DomainRoute,
})

function DomainRoute() {
  const { domainId } = Route.useParams()

  const domains = useWorkspaceStore(s => s.domains)
  const domain = domains.find(d => d.id === domainId)
  const setCreationModal = useUIStore(s => s.setCreationModal)

  const renameSubject = useWorkspaceStore(s => s.renameSubject)
  const deleteSubject = useWorkspaceStore(s => s.deleteSubject)

  if (!domain) {
    return <div style={{padding: 40, textAlign: 'center', color: "var(--ws-muted)"}}>Domain not found.</div>
  }

  return (
    <DomainScreen
      domain={domain}
      onNavigate={() => {}}
      onOpenCreateModal={(type, dId) => setCreationModal({ open: true, type, domainId: dId ?? domain.id })}
      onRenameSubject={renameSubject}
      onDeleteSubject={deleteSubject}
    />
  )
}
