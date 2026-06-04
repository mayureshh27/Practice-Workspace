import { Plus, Globe, Check, Columns } from 'lucide-react';

type Source = {
  id: string;
  name: string;
  chunks: number;
  selected: boolean;
};

type Props = {
  sources: Source[];
  totalChunks: number;
  allChecked: boolean;
  collapsed: boolean;
  onToggle: (id: string) => void;
  onSelectAll: () => void;
  onAddSources: () => void;
  onToggleCollapse: () => void;
};

export function SourcesColumn({
  sources,
  totalChunks,
  allChecked,
  collapsed,
  onToggle,
  onSelectAll,
  onAddSources,
  onToggleCollapse,
}: Props) {
  return (
    <div
      className={`border border-ws-edge-soft rounded-[12px] bg-ws-bench flex flex-col transition-[width] duration-200 ease-emil-out overflow-hidden h-full shrink-0 ${
        collapsed ? 'w-[50px]' : 'w-[280px]'
      }`}
    >
      <div className="px-3.5 py-4 border-b border-ws-edge-soft flex items-center justify-between shrink-0">
        {!collapsed && (
          <div className="flex flex-col gap-0.5">
            <span className="text-[13px] font-bold text-ws-ink">Sources</span>
            <span className="text-[10px] text-ws-muted">{sources.length} total sources loaded</span>
          </div>
        )}
        <button
          type="button"
          onClick={onToggleCollapse}
          className="press bg-transparent border-none text-ws-muted cursor-pointer p-1.5 rounded hover:bg-ws-surface-2 transition-colors"
          title={collapsed ? 'Expand Sources' : 'Collapse Sources'}
        >
          <Columns size={14} />
        </button>
      </div>

      {!collapsed && (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Add sources + search web */}
          <div className="p-3 flex flex-col gap-2 border-b border-ws-edge-soft shrink-0">
            <button
              type="button"
              onClick={onAddSources}
              className="press w-full px-3 py-2 bg-ws-bg border border-dashed border-ws-edge rounded-ws-md text-ws-accent font-bold text-[11px] flex items-center gap-1.5 justify-center cursor-pointer transition-colors duration-150 h-bd-accent h-accent-tint"
            >
              <Plus size={12} /> Add sources
            </button>
            <div className="flex gap-1 items-center pl-1">
              <Globe size={11} className="text-ws-muted" />
              <span className="text-[10px] text-ws-muted">Search the web for new sources</span>
            </div>
          </div>

          {/* Selector list header */}
          <div className="px-3 py-2 flex justify-between items-center border-b border-ws-edge-soft shrink-0">
            <span className="text-[11px] text-ws-muted">{totalChunks} chunks active</span>
            <button
              type="button"
              onClick={onSelectAll}
              className="press bg-transparent border-none text-ws-accent text-[10px] font-bold cursor-pointer flex items-center gap-1 hover:opacity-80 transition-opacity"
            >
              <Check size={11} /> {allChecked ? 'Deselect all' : 'Select all'}
            </button>
          </div>

          {/* Scrollable source list */}
          <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-1 scrollbar">
            {sources.map((s) => (
              <div
                key={s.id}
                onClick={() => onToggle(s.id)}
                className={`press flex items-start gap-2 p-2 rounded-ws-md cursor-pointer border transition-colors duration-150 ${
                  s.selected
                    ? 'bg-ws-surface-2 border-ws-line'
                    : 'bg-transparent border-transparent hover:bg-ws-surface-2'
                }`}
              >
                <input
                  type="checkbox"
                  checked={s.selected}
                  onChange={() => {}}
                  className="accent-ws-glow mt-0.5 cursor-pointer w-[13px] h-[13px]"
                />
                <div className="min-w-0 flex-1">
                  <div
                    className={`text-[11px] truncate ${
                      s.selected ? 'font-semibold text-ws-ink' : 'font-normal text-ws-soft'
                    }`}
                  >
                    {s.name}
                  </div>
                  <div className="text-[9px] text-ws-muted mt-0.5">{s.chunks} chunks loaded</div>
                </div>
              </div>
            ))}
            {sources.length === 0 && (
              <div className="p-6 text-center text-ws-muted text-[11px] italic">
                No reference files linked to subject.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
