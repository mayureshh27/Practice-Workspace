import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import WorkflowManagerScreen from '../components/WorkflowManagerScreen';
import { workflowQueries } from '../api/queries';
import { useDeleteWorkflowMutation, useDuplicateWorkflowMutation } from '../api/mutations';

export const Route = createFileRoute('/workflows')({
  component: WorkflowsRoute,
});

function WorkflowsRoute() {
  const { data: workflowsResp } = useQuery(workflowQueries.list());
  const workflows = workflowsResp?.items || [];
  const { mutate: deleteWorkflow } = useDeleteWorkflowMutation();
  const { mutate: duplicateWorkflow } = useDuplicateWorkflowMutation();
  const navigate = useNavigate();

  return (
    <WorkflowManagerScreen
      workflows={workflows}
      onNavigate={(loc) => {
        if (loc.level === 'workflow-editor') {
          navigate({
            to: '/workflow-editor',
            search: { id: loc.workflowId },
          });
        }
      }}
      onDelete={deleteWorkflow}
      onDuplicate={duplicateWorkflow}
    />
  );
}
