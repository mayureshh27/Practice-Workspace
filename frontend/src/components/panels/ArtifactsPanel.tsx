import {LayoutGrid, Trash2, Filter} from 'lucide-react';
import {useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {artifactsQueries} from '../../api/queries';

const STATUSES = ['all', 'approved', 'reviewed', 'draft'] as const;

function ArtifactsPanel() {
  const {data: artifacts = [], isLoading} = useQuery(artifactsQueries.list());
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());

  const visible = artifacts.filter(a => !deletedIds.has(a.id));
  const filtered = statusFilter === 'all' ? visible : visible.filter(a => a.status === statusFilter);

  const handleDelete = (id: string) => {
    setDeletedIds(prev => new Set(prev).add(id));
    if (selectedId === id) setSelectedId(null);
  };

  if (isLoading) {
    return <div className="flex flex-col h-full p-4 gap-4"><p className="text-ws-muted text-sm">Loading artifacts...</p></div>;
  }

  return (
    <div className="flex flex-col h-full p-4 gap-4">
      <div style={{display: 'flex', alignItems: 'center', gap: 8}}>
        <Filter size={12} style={{color: "var(--ws-muted)", flexShrink: 0}} />
        <div style={{display: 'flex', gap: 4, flex: 1}}>
          {STATUSES.map(s => (
            <button
              key={s}
              type="button"
              onClick={() => setStatusFilter(s)}
              style={{
                padding: '3px 8px',
                fontSize: 'var(--ws-type-xs)',
                fontWeight: 600,
                border: '1px solid',
                borderColor: statusFilter === s ? "var(--ws-accent)" : "var(--ws-line)",
                borderRadius: "4px",
                background: statusFilter === s ? "rgba(16,185,129,0.1)" : 'transparent',
                color: statusFilter === s ? "var(--ws-accent)" : "var(--ws-muted)",
                cursor: 'pointer',
                textTransform: 'capitalize',
              }}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <p className="text-ws-muted text-sm m-0">{filtered.length} artifact{filtered.length !== 1 ? 's' : ''}</p>
      
      <div className="flex flex-col gap-3 overflow-y-auto flex-1">
        {filtered.map(artifact => (
          <div
            key={artifact.id}
            className="bg-ws-surface border border-ws-line rounded-md p-3 flex flex-col gap-2"
            style={{
              cursor: 'pointer',
              borderColor: selectedId === artifact.id ? "var(--ws-accent)" : undefined,
              background: selectedId === artifact.id ? "rgba(16,185,129,0.1)" : undefined,
            }}
            onClick={() => setSelectedId(selectedId === artifact.id ? null : artifact.id)}
          >
            <div className="flex items-center gap-2">
              <LayoutGrid size={14} className="text-ws-muted" />
              <span className="text-ws-ink font-medium">{artifact.title}</span>
              <button
                type="button"
                className="bg-transparent border-none text-ws-muted cursor-pointer p-1 rounded hover:text-ws-soft ml-auto"
                onClick={(e) => { e.stopPropagation(); handleDelete(artifact.id); }}
                title="Delete artifact"
              >
                <Trash2 size={12} style={{color: "#ef4444"}} />
              </button>
            </div>
            <div className="flex items-center justify-between text-ws-muted text-sm">
              <span className={`px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider ${artifact.status === 'approved' ? 'bg-ws-success/10 text-ws-success' : artifact.status === 'reviewed' ? 'bg-ws-accent/10 text-ws-accent' : ''}`}>
                {artifact.status}
              </span>
              <span>{artifact.type}</span>
              <span>{artifact.time}</span>
            </div>
            {selectedId === artifact.id && (
              <div style={{
                marginTop: 4,
                padding: '8px',
                background: "var(--ws-bg)",
                borderRadius: "4px",
                border: '1px solid var(--ws-edge-soft)',
                fontSize: '11px',
                color: "var(--ws-soft)",
              }}>
                <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: 4}}>
                  <span>Type: {artifact.type}</span>
                  <span>Status: {artifact.status}</span>
                </div>
                <div style={{color: "var(--ws-muted)", fontSize: 'var(--ws-type-xs)'}}>
                  Generated {artifact.time} · Click "Artifacts" in left nav to view full content
                </div>
              </div>
            )}
          </div>
        ))}
        {filtered.length === 0 && (
          <div style={{color: "var(--ws-muted)", fontSize: '11px', textAlign: 'center', padding: 'var(--ws-sp-6) 0'}}>
            No artifacts match this filter
          </div>
        )}
      </div>
    </div>
  );
}

export default ArtifactsPanel;