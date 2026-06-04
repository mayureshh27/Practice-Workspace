import { Outlet, createRootRouteWithContext } from '@tanstack/react-router';
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools';
import { HotkeysProvider, useHotkey } from '@tanstack/react-hotkeys';
import type { QueryClient } from '@tanstack/react-query';

declare module '@tanstack/react-hotkeys' {
  interface RegisterableHotkeys {
    'mod+k': true;
    'mod+j': true;
  }
}

import { domainQueries, masteryQueries, workflowQueries, artifactsQueries } from '../api/queries';
import { useWorkspaceStore } from '../stores/workspaceStore';
import { useUIStore } from '../stores/uiStore';

import WorkspaceTopBar from '../components/WorkspaceTopBar';
import LeftNav from '../components/LeftNav';
import BottomDock from '../components/BottomDock';
import RightDockPanel from '../components/RightDockPanel';
import RightDockRail from '../components/RightDockRail';
import { SearchPalette } from '../components/SearchPalette';
import { CreationModal } from '../components/CreationModal';
import { SettingsPanel } from '../components/settings/SettingsPanel';

import '../index.css';

interface RouterContext {
  queryClient: QueryClient;
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
    scripts: [{ children: settingsBootstrapScript }],
  }),
  loader: async ({ context: { queryClient } }) => {
    await queryClient.ensureQueryData(domainQueries.list());
    await queryClient.ensureQueryData(masteryQueries.scores());
    await queryClient.ensureQueryData(masteryQueries.blindSpots());
    const wfResp = await queryClient.ensureQueryData(workflowQueries.list());
    useWorkspaceStore.getState().setModelConfigured(wfResp.modelConfigured);
    await queryClient.ensureQueryData(artifactsQueries.list());
  },
  component: RootComponent,
});

function RootComponent() {
  const setSearchModalOpen = useUIStore((s) => s.setSearchModalOpen);
  const toggleSettings = useUIStore((s) => s.toggleSettings);

  // @ts-expect-error tanstack hotkeys missing types
  useHotkey('mod+k', (e: KeyboardEvent) => {
    e.preventDefault();
    setSearchModalOpen(true);
  });

  // @ts-expect-error tanstack hotkeys missing types
  useHotkey('mod+j', (e: KeyboardEvent) => {
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
  );
}
