import {FileText, Search, ChevronDown, ChevronRight, ToggleLeft, ToggleRight} from 'lucide-react';
import {useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {sourcesQueries} from '../../api/queries';

function SourcesPanel() {
  const {data: sources = [], isLoading} = useQuery(sourcesQueries.list());
  const [filter, setFilter] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [localContext, setLocalContext] = useState<Record<string, boolean>>({});

  const filtered = sources.filter(
    s => s.title.toLowerCase().includes(filter.toLowerCase()) || s.type.toLowerCase().includes(filter.toLowerCase())
  );

  const toggleContext = (id: string) => {
    setLocalContext(prev => ({...prev, [id]: !(prev[id] ?? true)}));
  };

  const toggleExpand = (id: string) => {
    setExpandedId(prev => prev === id ? null : id);
  };

  const contextCount = sources.filter(s => localContext[s.id] ?? s.inContext).length;
  const totalChunks = sources.filter(s => localContext[s.id] ?? s.inContext).reduce((sum, s) => sum + s.chunkCount, 0);

  if (isLoading) {
    return <div className="flex flex-col h-full p-4 gap-4"><p className="text-ws-muted text-sm">Loading sources...</p></div>;
  }

  return (
    <div className="flex flex-col h-full p-4 gap-4">
      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
        <p className="text-ws-muted text-sm m-0">{contextCount} sources · {totalChunks} chunks active</p>
      </div>

      <div style={{position: 'relative'}}>
        <Search size={12} style={{position: 'absolute', left: 8, top: 9, color: "var(--ws-muted)"}} />
        <input
          type="text"
          className="flex-1 bg-ws-surface border border-ws-line rounded px-3 py-2 text-ws-ink outline-none focus:border-ws-success transition-colors"
          style={{paddingLeft: 28, width: '100%'}}
          placeholder="Filter sources..."
          value={filter}
          onChange={e => setFilter(e.target.value)}
        />
      </div>
      
      <div className="flex flex-col gap-3 overflow-y-auto flex-1">
        {filtered.map(source => {
          const inContext = localContext[source.id] ?? source.inContext;
          return (
            <div key={source.id} className="bg-ws-surface border border-ws-line rounded-md p-3 flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => toggleExpand(source.id)}
                  style={{background: 'none', border: 'none', padding: 0, color: "var(--ws-muted)", cursor: 'pointer', display: 'flex'}}
                >
                  {expandedId === source.id ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </button>
                <FileText size={14} className="text-ws-muted" />
                <span className="text-ws-ink font-medium">{source.title}</span>
                <button
                  type="button"
                  onClick={() => toggleContext(source.id)}
                  style={{background: 'none', border: 'none', padding: 0, cursor: 'pointer', marginLeft: 'auto', display: 'flex', color: inContext ? "var(--ws-accent)" : "var(--ws-muted)"}}
                  title={inContext ? 'Remove from context' : 'Add to context'}
                >
                  {inContext ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                </button>
              </div>
              <div className="flex items-center justify-between text-ws-muted text-sm">
                <span>{source.type}</span>
                <span>{source.chunkCount} chunks</span>
              </div>
              {expandedId === source.id && (
                <div style={{marginTop: 4, display: 'flex', flexDirection: 'column', gap: 6}}>
                  {source.chunks.map(chunk => (
                    <div key={chunk.id} style={{
                      padding: '6px 8px',
                      background: "var(--ws-bg)",
                      borderRadius: "4px",
                      border: '1px solid var(--ws-edge-soft)',
                      fontSize: 'var(--ws-type-xs)',
                      color: "var(--ws-soft)",
                      lineHeight: 1.4,
                    }}>
                      {chunk.text}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div style={{color: "var(--ws-muted)", fontSize: '11px', textAlign: 'center', padding: 'var(--ws-sp-6) 0'}}>
            {isLoading ? 'Loading...' : `No sources match "${filter}"`}
          </div>
        )}
      </div>
    </div>
  );
}

export default SourcesPanel;