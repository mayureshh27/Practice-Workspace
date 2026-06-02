import {X} from 'lucide-react';
import type {RightDockPanel as RightDockPanelType} from '../workspaceTypes';
import TutorPanel from './panels/TutorPanel';
import SourcesPanel from './panels/SourcesPanel';
import ArtifactsPanel from './panels/ArtifactsPanel';
import MemoryPanel from './panels/MemoryPanel';
import GraphPanel from './panels/GraphPanel';
import ContextPanel from './panels/ContextPanel';
import InspectorPanel from './panels/InspectorPanel';
import { Button } from '@/components/ui/button';
import { useUIStore } from '../stores/uiStore';
import { cn } from '@/lib/utils';

const PANEL_TITLES: Record<Exclude<RightDockPanelType, null>, string> = {
  sources:   'Source Chunks',
  tutor:     'Tutor Chat',
  artifacts: 'Generated Artifacts',
  memory:    'Learning Memory',
  graph:     'Related Concepts',
  context:   'Context Slots',
  inspector: 'Debug Inspector',
};

function renderPanelContent(activePanel: Exclude<RightDockPanelType, null>) {
  switch (activePanel) {
    case 'sources':   return <SourcesPanel />;
    case 'tutor':     return <TutorPanel />;
    case 'artifacts': return <ArtifactsPanel />;
    case 'memory':    return <MemoryPanel />;
    case 'graph':     return <GraphPanel />;
    case 'context':   return <ContextPanel />;
    case 'inspector': return <InspectorPanel />;
    default: return null;
  }
}

/** Slide-in panel that overlays from the right side of ws-main. Rendered inside ws-main so
 *  positioning is correct and the 42px RightDockRail stays accessible. Uses shadcn Button
 *  for the close button; the slide animation is a CSS width transition (preserved from
 *  the original hand-rolled version because Radix Sheet is full-viewport). */
function RightDockPanel() {
  const activePanel = useUIStore(s => s.rightPanel);
  const onClose = () => useUIStore.getState().setRightPanel(null);

  return (
    <div
      className={cn(
        "absolute right-[42px] top-0 bottom-0 z-20 bg-background overflow-hidden",
        "transition-[width,border] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)]",
        activePanel ? 'w-[360px] border-l border-border' : 'w-0 border-l-0 border-transparent'
      )}
    >
      {activePanel && (
        <div className="flex flex-col w-[360px] h-full">
          <div className="flex items-center justify-between px-4 h-11 shrink-0 border-b border-border bg-background">
            <span className="font-bold text-[13px] text-foreground">{PANEL_TITLES[activePanel]}</span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={onClose}
              aria-label="Close panel"
              className="size-7 text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <X size={14} />
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto">
            {renderPanelContent(activePanel)}
          </div>
        </div>
      )}
    </div>
  );
}

export default RightDockPanel;
