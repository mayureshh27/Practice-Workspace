import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { RootScreen } from '../components/ExplorerScreens'
import { useWorkspaceStore } from '../stores/workspaceStore'

export const Route = createFileRoute('/')({
  component: IndexScreen,
})

function IndexScreen() {
  const domains = useWorkspaceStore(s => s.domains)
  const renameDomain = useWorkspaceStore(s => s.renameDomain);
  const deleteDomain = useWorkspaceStore(s => s.deleteDomain);
  const togglePinDomain = useWorkspaceStore(s => s.togglePinDomain);
  const toggleArchiveDomain = useWorkspaceStore(s => s.toggleArchiveDomain);
  const navigate = useNavigate();

  return (
    <RootScreen
      domains={domains}
      onNavigate={(loc: any) => {
        if (loc.level === 'domain') {
          navigate({ to: `/domain/${loc.domainId}` });
        }
      }}
      onOpenCreateModal={() => {}}
      onRenameDomain={renameDomain}
      onDeleteDomain={deleteDomain}
      onTogglePinDomain={togglePinDomain}
      onToggleArchiveDomain={toggleArchiveDomain}
    />
  );
}
