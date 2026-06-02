import { Outlet, createRootRouteWithContext } from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'
import { HotkeysProvider, useHotkey } from '@tanstack/react-hotkeys'
import type { QueryClient } from '@tanstack/react-query'

import { domainQueries, masteryQueries, workflowQueries, artifactsQueries } from '../api/queries'
import { useWorkspaceStore } from '../stores/workspaceStore'
import { useUIStore } from '../stores/uiStore'

import WorkspaceTopBar from '../components/WorkspaceTopBar'
import LeftNav from '../components/LeftNav'
import BottomDock from '../components/BottomDock'
import RightDockPanel from '../components/RightDockPanel'
import RightDockRail from '../components/RightDockRail'
import { SearchPalette } from '../components/SearchPalette'
import { CreationModal } from '../components/CreationModal'
import { SettingsPanel } from '../components/settings/SettingsPanel'

import '../index.css'

interface RouterContext {
  queryClient: QueryClient
}

// Apply persisted user settings to <html> BEFORE the first paint, so the
// workspace never flashes the default palette on reload. Runs inline in
// <head>; reads localStorage and writes both the .dark class (Claude/shadcn)
// and the legacy data-* attributes (parametric [data-base] / [data-radius] /
// [data-font-*] overrides in styles.css).
const settingsBootstrapScript = `
(function(){
  try {
    var theme = localStorage.getItem('theme') || 'dark';
    if (theme === 'dark') document.documentElement.classList.add('dark');
    var s = JSON.parse(localStorage.getItem('ws-settings') || '{}');
    var html = document.documentElement;
    if (s.base)        html.dataset.base        = s.base;
    if (s.radius)      html.dataset.radius      = s.radius;
    if (s.fontHeading) html.dataset.fontHeading = s.fontHeading;
    if (s.fontBody)    html.dataset.fontBody    = s.fontBody;
  } catch (e) {}
})();
`.trim();

export const Route = createRootRouteWithContext<RouterContext>()({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'Robotics Learning Platform' },
      { name: 'description', content: 'Practice, master, and ship robotics.' },
    ],
    links: [
      { rel: 'icon', href: '/favicon.ico' },
      { rel: 'icon', href: '/favicon.svg', type: 'image/svg+xml' },
    ],
    scripts: [
      { children: settingsBootstrapScript },
    ],
  }),
  loader: async ({ context: { queryClient } }) => {
    try {
      const domains = await queryClient.ensureQueryData(domainQueries.list())
      // Sync API domains into zustand store (replaces localStorage/mock data)
      useWorkspaceStore.getState().setDomains(domains as any)
    } catch (err) {
      console.warn('Failed to fetch domains from API, using local fallback:', err)
    }
    try {
      await queryClient.ensureQueryData(masteryQueries.scores())
    } catch (_) {}
    try {
      await queryClient.ensureQueryData(masteryQueries.blindSpots())
    } catch (_) {}
    try {
      const wfResp = await queryClient.ensureQueryData(workflowQueries.list())
      useWorkspaceStore.getState().setWorkflows(wfResp.items as any)
      useWorkspaceStore.getState().setModelConfigured(wfResp.modelConfigured)
    } catch (err) {
      console.warn('Failed to fetch workflows from API, using local fallback:', err)
    }
    try {
      const artifacts = await queryClient.ensureQueryData(artifactsQueries.list())
      useWorkspaceStore.setState({ artifacts: artifacts as any })
    } catch (err) {
      console.warn('Failed to fetch artifacts from API, using local fallback:', err)
    }
  },
  component: RootComponent,
})

function RootComponent() {
  const setSearchModalOpen = useUIStore(s => s.setSearchModalOpen);
  const toggleSettings = useUIStore(s => s.toggleSettings);

  useHotkey('mod+k', (e) => {
    e.preventDefault();
    setSearchModalOpen(true);
  });

  useHotkey('mod+j', (e) => {
    e.preventDefault();
    toggleSettings();
  });

  return (
    <HotkeysProvider>
      <div className="h-dvh max-h-dvh flex overflow-hidden bg-ws-bg text-ws-ink font-sans text-[13px] leading-relaxed antialiased">
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
      <SettingsPanel />
    </HotkeysProvider>
  )
}
