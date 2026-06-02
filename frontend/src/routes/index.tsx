import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { RootScreen } from '../components/ExplorerScreens'
import { useWorkspaceStore } from '../stores/workspaceStore'
import { useUIStore } from '../stores/uiStore'

export const Route = createFileRoute('/')({
  component: IndexScreen,
})

function IndexScreen() {
  const domains = useWorkspaceStore(s => s.domains)
  const renameDomain = useWorkspaceStore(s => s.renameDomain);
  const deleteDomain = useWorkspaceStore(s => s.deleteDomain);
  const togglePinDomain = useWorkspaceStore(s => s.togglePinDomain);
  const toggleArchiveDomain = useWorkspaceStore(s => s.toggleArchiveDomain);
  const setCreationModal = useUIStore(s => s.setCreationModal);
  const navigate = useNavigate();

  return (
    <RootScreen
      domains={domains}
      onNavigate={(loc: any) => {
        if (loc.level === 'domain') {
          navigate({ to: `/domain/${loc.domainId}` });
        }
      }}
      onOpenCreateModal={(type) => setCreationModal({ open: true, type })}
      onRenameDomain={renameDomain}
      onDeleteDomain={deleteDomain}
      onTogglePinDomain={togglePinDomain}
      onToggleArchiveDomain={toggleArchiveDomain}
    />
  );
}
