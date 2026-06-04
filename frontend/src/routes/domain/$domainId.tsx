import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { DomainScreen } from '../../components/ExplorerScreens';
import { useUIStore } from '../../stores/uiStore';
import { domainQueries } from '../../api/queries';
import { useRenameSubjectMutation, useDeleteSubjectMutation } from '../../api/mutations';

export const Route = createFileRoute('/domain/$domainId')({
  component: DomainRoute,
});

function DomainRoute() {
  const { domainId } = Route.useParams();

  const { data: domains = [] } = useQuery(domainQueries.list());
  const domain = domains.find((d) => d.id === domainId);
  const setCreationModal = useUIStore((s) => s.setCreationModal);

  const { mutate: renameSubject } = useRenameSubjectMutation();
  const { mutate: deleteSubject } = useDeleteSubjectMutation();

  if (!domain) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: 'var(--ws-muted)' }}>
        Domain not found.
      </div>
    );
  }

  return (
    <DomainScreen
      domain={domain}
      onNavigate={() => {}}
      onOpenCreateModal={(type, dId) =>
        setCreationModal({ open: true, type, domainId: dId ?? domain.id, subjectId: undefined })
      }
      onRenameSubject={(dId, sId, name) => renameSubject({ domainId: dId, subjectId: sId, name })}
      onDeleteSubject={(dId, sId) => deleteSubject({ domainId: dId, subjectId: sId })}
    />
  );
}
