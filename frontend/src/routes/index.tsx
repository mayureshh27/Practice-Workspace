import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { RootScreen } from '../components/ExplorerScreens';
import { useUIStore } from '../stores/uiStore';
import { domainQueries } from '../api/queries';
import {
  useRenameDomainMutation,
  useDeleteDomainMutation,
  useTogglePinDomainMutation,
  useToggleArchiveDomainMutation,
} from '../api/mutations';

export const Route = createFileRoute('/')({
  component: IndexScreen,
});

function IndexScreen() {
  const { data: domains = [] } = useQuery(domainQueries.list());
  const { mutate: renameDomain } = useRenameDomainMutation();
  const { mutate: deleteDomain } = useDeleteDomainMutation();
  const { mutate: togglePinDomain } = useTogglePinDomainMutation();
  const { mutate: toggleArchiveDomain } = useToggleArchiveDomainMutation();

  const setCreationModal = useUIStore((s) => s.setCreationModal);
  const navigate = useNavigate();

  return (
    <RootScreen
      domains={domains}
      onNavigate={(loc: any) => {
        if (loc.level === 'domain') {
          navigate({ to: `/domain/${loc.domainId}` });
        }
      }}
      onOpenCreateModal={(type) =>
        setCreationModal({ open: true, type, domainId: undefined, subjectId: undefined })
      }
      onRenameDomain={(id, name) => renameDomain({ id, name })}
      onDeleteDomain={(id) => deleteDomain(id)}
      onTogglePinDomain={(id) => {
        const d = domains.find((x) => x.id === id);
        if (d) togglePinDomain({ id, pinned: !d.pinned });
      }}
      onToggleArchiveDomain={(id) => {
        const d = domains.find((x) => x.id === id);
        if (d) toggleArchiveDomain({ id, archived: !d.archived });
      }}
    />
  );
}
