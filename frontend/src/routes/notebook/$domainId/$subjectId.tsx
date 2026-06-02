import { createFileRoute } from '@tanstack/react-router'
import { useNavigate } from '@tanstack/react-router'
import SourceNotebookScreen from '../../../components/SourceNotebookScreen'
import { useWorkspaceStore } from '../../../stores/workspaceStore'

export const Route = createFileRoute('/notebook/$domainId/$subjectId')({
  component: NotebookRoute,
})

function NotebookRoute() {
  const { domainId, subjectId } = Route.useParams()
  const domains = useWorkspaceStore(s => s.domains)
  const addResource = useWorkspaceStore(s => s.addResource)
  const navigate = useNavigate()

  const domain = domains.find(d => d.id === domainId)
  const subject = domain?.subjects.find(s => s.id === subjectId)

  if (!domain || !subject) {
    return <div style={{padding: 40, textAlign: 'center', color: 'var(--ws-muted)'}}>Notebook target not found.</div>
  }

  return (
    <SourceNotebookScreen
      domain={domain}
      subject={subject}
      onNavigate={(loc) => {
        if (loc.level === 'subject' && 'domainId' in loc) {
          navigate({ to: `/subject/$domainId/$subjectId`, params: { domainId: loc.domainId, subjectId: loc.subjectId } })
        }
      }}
      onAddResource={addResource}
    />
  )
}
