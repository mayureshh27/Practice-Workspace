import {useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {conceptQueries} from '../../api/queries';

const MASTERY_COLORS: Record<string, string> = {
  mastered: "var(--ws-accent)",
  practiced: "#f59e0b",
  unseen: "var(--ws-muted)",
};

function GraphPanel() {
  const {data: graph, isLoading} = useQuery(conceptQueries.graph());
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const nodes = graph?.nodes ?? [];
  const edges = graph?.edges ?? [];

  const selected = nodes.find(n => n.id === selectedId);

  const getNodePos = (index: number) => {
    const cols = 3;
    const col = index % cols;
    const row = Math.floor(index / cols);
    return {x: 10 + col * 100, y: 10 + row * 70};
  };

  if (isLoading) {
    return <div className="flex flex-col h-full p-4 gap-4"><p className="text-ws-muted text-sm">Loading concept graph...</p></div>;
  }

  if (nodes.length === 0) {
    return (
      <div className="flex flex-col h-full p-4 gap-4">
        <p className="text-ws-muted text-sm">Concept prerequisite map. Click a node for details.</p>
        <div style={{color: "var(--ws-muted)", fontSize: '11px', textAlign: 'center', padding: '40px 0'}}>
          No concepts yet. Start practicing to build your graph.
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full p-4 gap-4">
      <p className="text-ws-muted text-sm">Concept prerequisite map. Click a node for details.</p>

      <div style={{
        position: 'relative',
        height: Math.max(200, Math.ceil(nodes.length / 3) * 70 + 20),
        background: "var(--ws-bg)",
        border: '1px solid var(--ws-edge-soft)',
        borderRadius: "6px",
        overflow: 'hidden',
      }}>
        <svg width="100%" height="100%" style={{position: 'absolute', top: 0, left: 0}}>
          {edges.map((edge, i) => {
            const fromIdx = nodes.findIndex(n => n.id === edge.fromId);
            const toIdx = nodes.findIndex(n => n.id === edge.toId);
            if (fromIdx === -1 || toIdx === -1) return null;
            const from = getNodePos(fromIdx);
            const to = getNodePos(toIdx);
            return (
              <line
                key={`${edge.fromId}-${edge.toId}-${i}`}
                x1={from.x + 40} y1={from.y + 12}
                x2={to.x + 40} y2={to.y + 12}
                stroke="var(--ws-line)" strokeWidth={1.5}
              />
            );
          })}
        </svg>
        {nodes.map((node, i) => {
          const pos = getNodePos(i);
          return (
            <button
              key={node.id}
              type="button"
              onClick={() => setSelectedId(selectedId === node.id ? null : node.id)}
              style={{
                position: 'absolute',
                left: pos.x, top: pos.y,
                width: 80, height: 24,
                background: selectedId === node.id ? "rgba(16,185,129,0.1)" : "var(--ws-bg)",
                border: `1.5px solid ${selectedId === node.id ? "var(--ws-accent)" : MASTERY_COLORS[node.mastery]}`,
                borderRadius: "4px",
                color: "var(--ws-ink)",
                fontSize: 10,
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 1,
                transition: 'all 150ms ease',
              }}
            >
              {node.label}
            </button>
          );
        })}
      </div>

      {selected && (
        <div className="bg-ws-surface border border-ws-line rounded-md p-3 flex flex-col gap-2" style={{marginTop: 8}}>
          <div className="text-ws-ink font-medium">{selected.label}</div>
          <div className="flex items-center justify-between text-ws-muted text-sm">
            <span className={`ws-tag mastery-${selected.mastery}`} style={{textTransform: 'capitalize'}}>{selected.mastery}</span>
          </div>
          <div style={{fontSize: '11px', color: "var(--ws-soft)", marginTop: 4}}>
            {selected.mastery === 'mastered' && 'You have demonstrated consistent understanding of this concept.'}
            {selected.mastery === 'practiced' && 'You have practiced this concept but may still have gaps.'}
            {selected.mastery === 'unseen' && 'You have not yet encountered exercises on this concept.'}
          </div>
          <div style={{fontSize: 'var(--ws-type-xs)', color: "var(--ws-muted)", marginTop: 4}}>
            Prerequisites: {edges.filter(e => e.toId === selected.id).map(e => nodes.find(n => n.id === e.fromId)?.label).filter(Boolean).join(', ') || 'None'}
          </div>
        </div>
      )}

      {!selected && (
        <div className="flex flex-col gap-3 overflow-y-auto flex-1" style={{marginTop: 4}}>
          <div className="bg-ws-surface border border-ws-line rounded-md p-3 flex flex-col gap-2">
            <div className="text-ws-ink font-medium">Legend</div>
            <div className="flex flex-wrap gap-2 mt-2">
              <span className="px-2 py-0.5 rounded text-[11px] font-bold tracking-wider bg-ws-success/10 text-ws-success border border-ws-success/30">Mastered</span>
              <span className="px-2 py-0.5 rounded text-[11px] font-bold tracking-wider bg-ws-accent/10 text-ws-accent border border-ws-accent/30">Practiced</span>
              <span className="px-2 py-0.5 rounded text-[11px] font-bold tracking-wider bg-ws-surface text-ws-muted border border-ws-line">Unseen</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default GraphPanel;