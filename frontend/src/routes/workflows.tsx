import { createFileRoute, useNavigate } from '@tanstack/react-router'
import WorkflowManagerScreen from '../components/WorkflowManagerScreen'
import { useWorkspaceStore } from '../stores/workspaceStore'

export const Route = createFileRoute('/workflows')({
  component: WorkflowsRoute,
})

function WorkflowsRoute() {
  const workflows = useWorkspaceStore(s => s.workflows)
  const deleteWorkflow = useWorkspaceStore(s => s.deleteWorkflow)
  const duplicateWorkflow = useWorkspaceStore(s => s.duplicateWorkflow)
  const navigate = useNavigate()

  return (
    <WorkflowManagerScreen
      workflows={workflows}
      onNavigate={(loc) => {
        if (loc.level === 'workflow-editor') {
          navigate({
            to: '/workflow-editor',
            search: { id: loc.workflowId }
          })
        }
      }}
      onDelete={deleteWorkflow}
      onDuplicate={duplicateWorkflow}
    />
  )
}
