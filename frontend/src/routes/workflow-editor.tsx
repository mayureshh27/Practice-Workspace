import { createFileRoute, useNavigate } from '@tanstack/react-router'
import WorkflowEditorScreen from '../components/WorkflowEditorScreen'
import { useWorkspaceStore } from '../stores/workspaceStore'
import { z } from 'zod'

const searchSchema = z.object({
  id: z.string().optional(),
  // The subject/chapter/topic the user was viewing when they opened
  // the editor. Drives the fork banner — when the workflow is global
  // and the user is in a subject view, we offer to fork it into a
  // subject-scoped copy.
  fromSubjectId: z.string().optional(),
  fromChapterId: z.string().optional(),
  fromTopicId: z.string().optional(),
  fork: z.boolean().optional(),
})

export const Route = createFileRoute('/workflow-editor')({
  validateSearch: (search) => searchSchema.parse(search),
  component: WorkflowEditorRoute,
})

function WorkflowEditorRoute() {
  const { id, fromSubjectId, fromChapterId, fromTopicId, fork } = Route.useSearch()
  const navigate = useNavigate()
  const workflows = useWorkspaceStore(s => s.workflows)
  const saveWorkflow = useWorkspaceStore(s => s.saveWorkflow)
  const customizeWorkflow = useWorkspaceStore(s => s.customizeWorkflow)
  const subjects = useWorkspaceStore(s =>
    s.domains.flatMap(d => d.subjects.map(sub => ({ ...sub, domainId: d.id })))
  )
  const subject = fromSubjectId ? subjects.find(s => s.id === fromSubjectId) : undefined

  return (
    <WorkflowEditorScreen
      workflows={workflows}
      workflowId={id}
      forkContext={
        fromSubjectId
          ? {
              subjectId: fromSubjectId,
              subjectName: subject?.name ?? 'this subject',
              chapterId: fromChapterId,
              chapterName: subject?.chapters.find(c => c.id === fromChapterId)?.name,
              topicId: fromTopicId,
              topicName: subject?.chapters
                .find(c => c.id === fromChapterId)
                ?.topics.find(t => t.id === fromTopicId)?.name,
              requested: fork ?? false,
            }
          : null
      }
      onCustomize={async (workflowId, target) => {
        return customizeWorkflow(workflowId, target)
      }}
      onNavigate={(loc) => {
        if (loc.level === 'workflows') {
          navigate({ to: '/workflows' })
        }
      }}
      onSaveWorkflow={saveWorkflow}
    />
  )
}
