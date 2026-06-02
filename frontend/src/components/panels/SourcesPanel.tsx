import {FileText, Search, ChevronDown, ChevronRight} from 'lucide-react';
import {useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {sourcesQueries} from '../../api/queries';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';

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
    return <div className="flex flex-col h-full p-4 gap-4"><p className="text-muted-foreground text-sm">Loading sources...</p></div>;
  }

  return (
    <div className="flex flex-col h-full p-4 gap-4">
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground text-sm m-0">{contextCount} sources · {totalChunks} chunks active</p>
      </div>

      <div className="relative">
        <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        <Input
          type="text"
          placeholder="Filter sources..."
          value={filter}
          onChange={e => setFilter(e.target.value)}
          className="pl-7"
        />
      </div>

      <div className="flex flex-col gap-3 overflow-y-auto flex-1">
        {filtered.map(source => {
          const inContext = localContext[source.id] ?? source.inContext;
          return (
            <div key={source.id} className="bg-card border border-border rounded-md p-3 flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => toggleExpand(source.id)}
                  className="bg-transparent border-0 p-0 text-muted-foreground cursor-pointer flex"
                  aria-label={expandedId === source.id ? 'Collapse' : 'Expand'}
                >
                  {expandedId === source.id ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </button>
                <FileText size={14} className="text-muted-foreground" />
                <span className="text-foreground font-medium flex-1">{source.title}</span>
                <div className="flex items-center gap-1.5 ml-auto">
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    {inContext ? 'In context' : 'Off'}
                  </span>
                  <Switch
                    checked={inContext}
                    onCheckedChange={() => toggleContext(source.id)}
                    aria-label={inContext ? 'Remove from context' : 'Add to context'}
                  />
                </div>
              </div>
              <div className="flex items-center justify-between text-muted-foreground text-sm">
                <span>{source.type}</span>
                <span>{source.chunkCount} chunks</span>
              </div>
              {expandedId === source.id && (
                <div className="mt-1 flex flex-col gap-1.5">
                  {source.chunks.map(chunk => (
                    <div key={chunk.id} className="px-2 py-1.5 bg-background rounded border border-border text-xs text-muted-foreground leading-[1.4]">
                      {chunk.text}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className={cn("text-muted-foreground text-[11px] text-center py-6")}>
            {isLoading ? 'Loading...' : `No sources match "${filter}"`}
          </div>
        )}
      </div>
    </div>
  );
}

export default SourcesPanel;
