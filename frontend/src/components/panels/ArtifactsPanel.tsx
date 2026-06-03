import { LayoutGrid, Trash2, Filter } from 'lucide-react';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { artifactsQueries } from '../../api/queries';

const STATUSES = ['all', 'approved', 'reviewed', 'draft'] as const;

function ArtifactsPanel() {
  const { data: artifacts = [], isLoading } = useQuery(artifactsQueries.list());
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());

  const visible = artifacts.filter((a) => !deletedIds.has(a.id));
  const filtered =
    statusFilter === 'all' ? visible : visible.filter((a) => a.status === statusFilter);

  const handleDelete = (id: string) => {
    setDeletedIds((prev) => new Set(prev).add(id));
    if (selectedId === id) setSelectedId(null);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col h-full p-4 gap-4">
        <p className="text-ws-muted text-sm">Loading artifacts...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full p-4 gap-4">
      <div className="flex items-center gap-2">
        <Filter size={12} className="text-ws-muted shrink-0" />
        <div className="flex gap-1 flex-1">
          {STATUSES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatusFilter(s)}
              className={`px-2 py-[3px] text-xs font-semibold border rounded cursor-pointer capitalize ${
                statusFilter === s
                  ? 'bg-ws-accent/10 border-ws-accent text-ws-accent'
                  : 'bg-transparent border-ws-line text-ws-muted'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <p className="text-ws-muted text-sm m-0">
        {filtered.length} artifact{filtered.length !== 1 ? 's' : ''}
      </p>

      <div className="flex flex-col gap-3 overflow-y-auto flex-1">
        {filtered.map((artifact) => (
          <div
            key={artifact.id}
            className={`bg-ws-surface border rounded-md p-3 flex flex-col gap-2 cursor-pointer ${
              selectedId === artifact.id ? 'border-ws-accent bg-ws-accent/10' : 'border-ws-line'
            }`}
            onClick={() => setSelectedId(selectedId === artifact.id ? null : artifact.id)}
          >
            <div className="flex items-center gap-2">
              <LayoutGrid size={14} className="text-ws-muted" />
              <span className="text-[11px] font-semibold text-ws-ink truncate">
                {artifact.name}
              </span>
              <button
                type="button"
                className="bg-transparent border-none text-ws-muted cursor-pointer p-1 rounded hover:text-ws-soft ml-auto"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete(artifact.id);
                }}
                title="Delete artifact"
              >
                <Trash2 size={12} className="text-ws-danger" />
              </button>
            </div>
            <div className="flex items-center justify-between text-ws-muted text-sm">
              <span
                className={`px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider ${artifact.status === 'approved' ? 'bg-ws-success/10 text-ws-success' : artifact.status === 'reviewed' ? 'bg-ws-accent/10 text-ws-accent' : ''}`}
              >
                {artifact.status}
              </span>
              <span>{artifact.type}</span>
              <span>{artifact.time}</span>
            </div>
            {selectedId === artifact.id && (
              <div className="mt-1 p-2 bg-ws-bg rounded border border-ws-edge-soft text-[11px] text-ws-soft">
                <div className="flex justify-between mb-1">
                  <span>Type: {artifact.type}</span>
                  <span>Status: {artifact.status}</span>
                </div>
                <div className="text-ws-muted text-xs">
                  Generated {artifact.time} · Click "Artifacts" in left nav to view full content
                </div>
              </div>
            )}
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="text-ws-muted text-[11px] text-center py-[var(--ws-sp-6)]">
            No artifacts match this filter
          </div>
        )}
      </div>
    </div>
  );
}

export default ArtifactsPanel;
