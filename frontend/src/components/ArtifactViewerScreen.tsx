import {Filter, LayoutGrid, Eye, Trash2, Search} from 'lucide-react';
import {useState, useMemo} from 'react';
import type {Artifact, Domain} from '../workspaceTypes';
import { CustomSelect } from './ui/CustomSelect';

type Props = {
  artifacts: Artifact[];
  domains: Domain[];
  onDelete: (id: string) => void;
};

function ArtifactsScreen({artifacts, domains, onDelete}: Props) {
  const [search, setSearch] = useState('');
  const [domainFilter, setDomainFilter] = useState('all');
  const [subjectFilter, setSubjectFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const subjects = useMemo(() => {
    if (domainFilter === 'all') return domains.flatMap(d => d.subjects);
    const dom = domains.find(d => d.id === domainFilter);
    return dom ? dom.subjects : [];
  }, [domains, domainFilter]);

  const types = useMemo(() => [...new Set(artifacts.map(a => a.type))], [artifacts]);

  const filtered = useMemo(() => {
    return artifacts.filter(a => {
      if (domainFilter !== 'all' && a.domainId !== domainFilter) return false;
      if (subjectFilter !== 'all' && a.subjectId !== subjectFilter) return false;
      if (typeFilter !== 'all' && a.type !== typeFilter) return false;
      if (statusFilter !== 'all' && a.status !== statusFilter) return false;
      if (search) {
        const needle = search.toLowerCase();
        if (!a.name.toLowerCase().includes(needle) && !a.type.toLowerCase().includes(needle)) return false;
      }
      return true;
    });
  }, [artifacts, domainFilter, subjectFilter, typeFilter, statusFilter, search]);

  return (
    <div className="p-4 h-full flex flex-col overflow-hidden bg-ws-floor text-ws-ink">
      <div className="flex-1 flex flex-col overflow-hidden bg-ws-bench border border-ws-line rounded-xl shadow-md p-6 max-w-[1200px] mx-auto w-full">
        
        {/* Header */}
        <div className="flex justify-between items-center mb-6 shrink-0">
          <div>
            <h1 className="text-xl font-extrabold text-ws-ink m-0 mb-1.5 tracking-tight flex items-center gap-2">
              <LayoutGrid size={18} className="text-ws-glow" />
              Artifacts & Materials
            </h1>
            <p className="text-[13px] text-ws-muted m-0">
              Browse, filter, and review practice session outputs, generation results, and structured resources.
            </p>
          </div>
          <span className="text-xs font-mono px-2.5 py-1 bg-ws-floor border border-ws-line rounded-md text-ws-muted">
            {filtered.length} / {artifacts.length} artifacts
          </span>
        </div>

        {/* Sleek Horizontal Filter Panel */}
        <div className="flex gap-4 flex-wrap items-center bg-ws-floor border border-ws-line rounded-lg p-4 mb-6 shrink-0">
          <div className="flex items-center gap-2 pr-4 border-r border-ws-line shrink-0">
            <Filter size={14} className="text-ws-glow" />
            <span className="text-[11px] font-bold uppercase tracking-wider text-ws-ink">Filters</span>
          </div>

          <div className="flex flex-1 gap-3 flex-wrap items-center">
            <CustomSelect 
              value={domainFilter} 
              onChange={val => { setDomainFilter(val); setSubjectFilter('all'); }}
              options={[
                { value: 'all', label: 'All Domains' },
                ...domains.map(d => ({ value: d.id, label: d.name }))
              ]}
              className="bg-ws-bench border border-ws-line rounded-md px-3 py-1.5 text-xs text-ws-ink outline-none cursor-pointer hover:border-ws-glow/50 transition-colors"
            />

            <CustomSelect 
              value={subjectFilter} 
              onChange={val => setSubjectFilter(val)}
              options={[
                { value: 'all', label: 'All Subjects' },
                ...subjects.map(s => ({ value: s.id, label: s.name }))
              ]}
              disabled={domainFilter === 'all' && subjects.length === 0}
              className="bg-ws-bench border border-ws-line rounded-md px-3 py-1.5 text-xs text-ws-ink outline-none cursor-pointer hover:border-ws-glow/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            />

            <CustomSelect 
              value={typeFilter} 
              onChange={val => setTypeFilter(val)}
              options={[
                { value: 'all', label: 'All Types' },
                ...types.map(t => ({ value: t, label: t }))
              ]}
              className="bg-ws-bench border border-ws-line rounded-md px-3 py-1.5 text-xs text-ws-ink outline-none cursor-pointer hover:border-ws-glow/50 transition-colors"
            />

            <CustomSelect 
              value={statusFilter} 
              onChange={val => setStatusFilter(val)}
              options={[
                { value: 'all', label: 'All Status' },
                { value: 'approved', label: 'Approved' },
                { value: 'reviewed', label: 'Reviewed' },
                { value: 'draft', label: 'Draft' }
              ]}
              className="bg-ws-bench border border-ws-line rounded-md px-3 py-1.5 text-xs text-ws-ink outline-none cursor-pointer hover:border-ws-glow/50 transition-colors"
            />
          </div>

          <div className="relative w-full max-w-[280px] shrink-0">
            <Search size={13} className="absolute left-3 top-2.5 text-ws-muted" />
            <input
              type="text"
              placeholder="Search artifacts..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-ws-bench border border-ws-line rounded-md text-xs text-ws-ink placeholder-ws-muted outline-none focus:border-ws-glow transition-all"
            />
          </div>
        </div>

        {/* Artifact grid */}
        <div className="flex-1 overflow-y-auto pr-1">
          <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
            {filtered.map(artifact => {
              const domain = domains.find(d => d.id === artifact.domainId);
              const subject = domain?.subjects.find(s => s.id === artifact.subjectId);

              return (
                <div
                  key={artifact.id}
                  className={`bg-ws-floor border rounded-lg p-4 cursor-pointer transition-all hover:border-ws-glow ${selectedId === artifact.id ? 'border-ws-glow shadow-md shadow-ws-glow/5' : 'border-ws-line'}`}
                  onClick={() => setSelectedId(selectedId === artifact.id ? null : artifact.id)}
                >
                  <div className="flex items-center gap-2 mb-2 shrink-0">
                    <LayoutGrid size={13} className="text-ws-muted shrink-0" />
                    <span className="text-[13px] font-bold text-ws-ink flex-1 overflow-hidden text-ellipsis whitespace-nowrap">
                      {artifact.name}
                    </span>
                    <button
                      type="button"
                      onClick={e => { e.stopPropagation(); onDelete(artifact.id); }}
                      className="bg-transparent border-none text-ws-muted hover:text-red-500 cursor-pointer p-0.5"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>

                  <div className="flex items-center gap-2 mb-3 shrink-0 flex-wrap">
                    <span className={`px-1.5 py-0.5 text-[9px] font-bold rounded border uppercase tracking-wider ${artifact.status === 'approved' ? "text-ws-glow border-ws-glow/30 bg-ws-glow/5" : artifact.status === 'reviewed' ? 'text-sky-400 border-sky-500/30 bg-sky-500/5' : "text-ws-muted border-ws-line bg-ws-bench/50"}`}>
                      {artifact.status}
                    </span>
                    <span className="text-[10px] text-ws-muted">{artifact.type}</span>
                    <span className="text-[10px] text-ws-muted ml-auto shrink-0">{artifact.time}</span>
                  </div>

                  <div className="text-[10px] text-ws-muted truncate">
                    {domain?.name} {subject ? `› ${subject.name}` : ''}
                  </div>

                  {selectedId === artifact.id && (
                    <div className="mt-3 pt-3 border-t border-ws-line flex gap-2" onClick={e => e.stopPropagation()}>
                      <button type="button" className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-ws-bench border border-ws-line rounded-md text-ws-glow text-[11px] font-bold hover:border-ws-glow transition-all">
                        <Eye size={12} /> View Material
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {filtered.length === 0 && (
            <div className="p-16 text-center text-ws-muted text-xs italic">
              No artifacts match your filters
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ArtifactsScreen;
