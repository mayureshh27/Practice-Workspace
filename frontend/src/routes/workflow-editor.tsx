import { createFileRoute, useNavigate } from '@tanstack/react-router'
import WorkflowEditorScreen from '../components/WorkflowEditorScreen'
import { useWorkspaceStore } from '../stores/workspaceStore'
import { z } from 'zod'

const searchSchema = z.object({
  id: z.string().optional()
})

export const Route = createFileRoute('/workflow-editor')({
  validateSearch: (search) => searchSchema.parse(search),
  component: WorkflowEditorRoute,
})

function WorkflowEditorRoute() {
  const { id } = Route.useSearch()
  const navigate = useNavigate()
  const workflows = useWorkspaceStore(s => s.workflows)
  const saveWorkflow = useWorkspaceStore(s => s.saveWorkflow)

  return (
    <WorkflowEditorScreen
      workflows={workflows}
      workflowId={id}
      onNavigate={(loc) => {
        if (loc.level === 'workflows') {
          navigate({ to: '/workflows' })
        }
      }}
      onSaveWorkflow={saveWorkflow}
    />
  )
}
