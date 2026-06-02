import {FileText,MessageCircle,LayoutGrid,Brain,GitBranch,Sliders,Bug} from 'lucide-react';
import type {RightDockPanel} from '../workspaceTypes';

import { useUIStore } from '../stores/uiStore';

const RAIL_ITEMS: {id: Exclude<RightDockPanel, null>; label: string; icon: typeof FileText; group: 'study' | 'debug'}[] = [
  {id: 'sources',   label: 'Sources',   icon: FileText,      group: 'study'},
  {id: 'tutor',     label: 'Tutor',     icon: MessageCircle, group: 'study'},
  {id: 'artifacts', label: 'Artifacts', icon: LayoutGrid,    group: 'study'},
  {id: 'memory',    label: 'Memory',    icon: Brain,         group: 'study'},
  {id: 'graph',     label: 'Graph',     icon: GitBranch,     group: 'study'},
  {id: 'context',   label: 'Context',   icon: Sliders,       group: 'debug'},
  {id: 'inspector', label: 'Inspector', icon: Bug,           group: 'debug'},
];

/** Just the vertical icon rail — the slide-in panel is rendered separately via RightDockPanel. */
function RightDockRail() {
  const activePanel = useUIStore(s => s.rightPanel);
  const onTogglePanel = useUIStore(s => s.setRightPanel);
  const studyItems = RAIL_ITEMS.filter(i => i.group === 'study');
  const debugItems = RAIL_ITEMS.filter(i => i.group === 'debug');

  return (
    <aside className="flex flex-col items-center gap-1 py-3 w-[42px] bg-ws-bg border-l border-ws-line shrink-0" aria-label="Right dock toggle rail">
      {studyItems.map(item => {
        const Icon = item.icon;
        return (
          <button
            key={item.id}
            type="button"
            className={`press flex items-center justify-center w-7 h-7 rounded transition-colors ${activePanel === item.id ? 'text-ws-accent bg-ws-surface-2' : 'text-ws-muted hover:text-ws-ink hover:bg-ws-surface-2'}`}
            onClick={() => onTogglePanel(activePanel === item.id ? null : item.id)}
            title={item.label}
            aria-label={item.label}
          >
            <Icon size={16} />
          </button>
        );
      })}

      <div className="w-5 h-px bg-ws-line my-1.5" />

      {debugItems.map(item => {
        const Icon = item.icon;
        return (
          <button
            key={item.id}
            type="button"
            className={`press flex items-center justify-center w-7 h-7 rounded transition-colors ${activePanel === item.id ? 'text-ws-accent bg-ws-surface-2' : 'text-ws-muted hover:text-ws-ink hover:bg-ws-surface-2'}`}
            onClick={() => onTogglePanel(activePanel === item.id ? null : item.id)}
            title={item.label}
            aria-label={item.label}
          >
            <Icon size={16} />
          </button>
        );
      })}
    </aside>
  );
}

export default RightDockRail;
