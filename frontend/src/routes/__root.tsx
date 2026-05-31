import { Outlet, createRootRoute } from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'
import { HotkeysProvider } from '@tanstack/react-hotkeys'
import { useEffect } from 'react'

import { useUIStore } from '../stores/uiStore'
import { useWorkspaceStore } from '../stores/workspaceStore'

import WorkspaceTopBar from '../components/WorkspaceTopBar'
import LeftNav from '../components/LeftNav'
import BottomDock from '../components/BottomDock'
import RightDockPanel from '../components/RightDockPanel'
import RightDockRail from '../components/RightDockRail'
import { SearchPalette } from '../components/SearchPalette'
import { CreationModal } from '../components/CreationModal'

import '../styles.css'

export const Route = createRootRoute({
  component: RootComponent,
})

function RootComponent() {
  const setSearchModalOpen = useUIStore(s => s.setSearchModalOpen);
  const fetchGoProblems = useWorkspaceStore(s => s.fetchGoProblems);
  const syncDomainsFromBackend = useWorkspaceStore(s => s.syncDomainsFromBackend);
  const fetchMastery = useWorkspaceStore(s => s.fetchMastery);
  const fetchBlindSpots = useWorkspaceStore(s => s.fetchBlindSpots);

  useEffect(() => {
    fetchGoProblems();
    syncDomainsFromBackend();
    fetchMastery();
    fetchBlindSpots();
  }, [fetchGoProblems, syncDomainsFromBackend, fetchMastery, fetchBlindSpots]);

  // Global keyboard shortcuts via native listeners (avoids TanStack hotkey type constraints)
  if (typeof window !== 'undefined') {
    // eslint-disable-next-line react-hooks/rules-of-hooks
  }

  return (
    <HotkeysProvider>
      <div
        className="h-dvh max-h-dvh flex overflow-hidden bg-ws-bg text-ws-ink font-sans text-[13px] leading-relaxed antialiased"
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
            e.preventDefault();
            setSearchModalOpen(true);
          }
        }}
        tabIndex={-1}
      >
        <LeftNav />

        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <WorkspaceTopBar />

          <div className="flex-1 overflow-auto bg-ws-bg">
            <Outlet />
          </div>

          <BottomDock />
        </div>

        <RightDockPanel />
        <RightDockRail />
      </div>
      <TanStackRouterDevtools position="bottom-right" />
      <SearchPalette />
      <CreationModal />
    </HotkeysProvider>
  )
}
