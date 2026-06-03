import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import WorkflowEditorScreen from '../components/WorkflowEditorScreen';
import { workflowQueries, domainQueries } from '../api/queries';
import { useSaveWorkflowMutation, useCustomizeWorkflowMutation } from '../api/mutations';
import { z } from 'zod';

const searchSchema = z.object({
  id: z.string().optional(),
  fromSubjectId: z.string().optional(),
  fromChapterId: z.string().optional(),
  fromTopicId: z.string().optional(),
  fork: z.boolean().optional(),
});

export const Route = createFileRoute('/workflow-editor')({
  validateSearch: (search) => searchSchema.parse(search),
  component: WorkflowEditorRoute,
});

function WorkflowEditorRoute() {
  const { id, fromSubjectId, fromChapterId, fromTopicId, fork } = Route.useSearch();
  const navigate = useNavigate();

  const { data: workflowsResp } = useQuery(workflowQueries.list());
  const workflows = workflowsResp?.items || [];
  const { data: domains = [] } = useQuery(domainQueries.list());

  const { mutateAsync: saveWorkflow } = useSaveWorkflowMutation();
  const { mutateAsync: customizeWorkflow } = useCustomizeWorkflowMutation();

  const subjects = domains.flatMap((d) => d.subjects.map((sub) => ({ ...sub, domainId: d.id })));
  const subject = fromSubjectId ? subjects.find((s) => s.id === fromSubjectId) : undefined;

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
              chapterName: subject?.chapters.find((c) => c.id === fromChapterId)?.name,
              topicId: fromTopicId,
              topicName: subject?.chapters
                .find((c) => c.id === fromChapterId)
                ?.topics.find((t) => t.id === fromTopicId)?.name,
              requested: fork ?? false,
            }
          : null
      }
      onCustomize={async (workflowId, target) => {
        return customizeWorkflow({ id: workflowId, target });
      }}
      onNavigate={(loc) => {
        if (loc.level === 'workflows') {
          navigate({ to: '/workflows' });
        }
      }}
      onSaveWorkflow={saveWorkflow}
    />
  );
}
