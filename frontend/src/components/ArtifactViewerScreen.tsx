import {Filter, LayoutGrid, Eye, Trash2, Search} from 'lucide-react';
import {useState, useMemo} from 'react';
import type {Artifact, Domain} from '../workspaceTypes';
import { CustomSelect } from './ui/CustomSelect';

type Props = {
  artifacts: Artifact[];
  domains: Domain[];
  onDelete: (id: string) => void;
};

const selectClasses =
  "bg-ws-bg border border-ws-edge-soft rounded-ws-md text-ws-ink text-[13px] outline-none cursor-pointer transition-colors duration-150 py-1.5 pl-3 pr-8 flex-[1_1_140px] min-w-[120px] max-w-[200px] appearance-auto";

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
    <div className="screen-container">
      <div className="screen-header">
        <h1>Artifacts</h1>
        <p>{filtered.length} of {artifacts.length} artifacts</p>
      </div>

      <div className="bg-ws-bg border border-ws-edge-soft rounded-ws-lg p-4 mb-6 flex gap-4 flex-wrap items-center shadow-md">
        <div className="flex items-center gap-2 shrink-0 pr-2 border-r border-ws-line">
          <Filter size={16} className="text-ws-accent" />
          <span className="text-[13px] font-bold uppercase text-ws-ink tracking-[0.04em]">Filters</span>
        </div>

        <div className="flex gap-2.5 flex-wrap flex-auto items-center">
          <CustomSelect
            value={domainFilter}
            onChange={val => { setDomainFilter(val); setSubjectFilter('all'); }}
            options={[
              { value: 'all', label: 'All Domains' },
              ...domains.map(d => ({ value: d.id, label: d.name }))
            ]}
            className={selectClasses}
          />

          <CustomSelect
            value={subjectFilter}
            onChange={val => setSubjectFilter(val)}
            options={[
              { value: 'all', label: 'All Subjects' },
              ...subjects.map(s => ({ value: s.id, label: s.name }))
            ]}
            className={selectClasses}
            disabled={domainFilter === 'all' && subjects.length === 0}
          />

          <CustomSelect
            value={typeFilter}
            onChange={val => setTypeFilter(val)}
            options={[
              { value: 'all', label: 'All Types' },
              ...types.map(t => ({ value: t, label: t }))
            ]}
            className={selectClasses}
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
            className={selectClasses}
          />
        </div>

        <div className="relative flex-[1_1_250px] min-w-[200px] max-w-[400px]">
          <Search size={14} className="absolute left-3 top-[10px] text-ws-muted" />
          <input
            type="text"
            placeholder="Search artifacts..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-ws-bg border border-ws-edge-soft rounded-ws-md text-ws-ink text-[13px] outline-none py-2 pr-4 pl-9 transition-colors duration-150 focus:border-ws-accent focus:shadow-[0_0_0_2px_rgba(16,185,129,0.08)]"
          />
        </div>
      </div>

      <div className="card-grid">
        {filtered.map(artifact => {
          const domain = domains.find(d => d.id === artifact.domainId);
          const subject = domain?.subjects.find(s => s.id === artifact.subjectId);

          return (
            <div
              key={artifact.id}
              className={`bg-ws-bg border rounded-ws-lg p-4 cursor-pointer transition-colors duration-150 ${selectedId === artifact.id ? 'border-ws-accent' : 'border-ws-line'}`}
              onClick={() => setSelectedId(selectedId === artifact.id ? null : artifact.id)}
            >
              <div className="flex items-center gap-2 mb-2">
                <LayoutGrid size={14} className="text-ws-muted shrink-0" />
                <span className="text-sm font-semibold text-ws-ink flex-1 truncate">
                  {artifact.name}
                </span>
                <button
                  type="button"
                  onClick={e => { e.stopPropagation(); onDelete(artifact.id); }}
                  className="bg-transparent border-none cursor-pointer text-ws-muted flex p-0.5 h-cl-danger"
                >
                  <Trash2 size={12} />
                </button>
              </div>

              <div className="flex items-center gap-1.5 mb-2">
                <span className={`
                  px-1.5 py-0.5 text-[10px] font-bold rounded-ws-sm capitalize
                  ${artifact.status === 'approved'
                    ? 'text-ws-accent bg-ws-accent/10 border border-ws-accent'
                    : artifact.status === 'reviewed'
                      ? 'text-ws-info bg-ws-info/10 border border-ws-info'
                      : 'text-ws-muted bg-ws-surface-2 border border-ws-surface-2'
                  }
                `}>
                  {artifact.status}
                </span>
                <span className="text-[11px] text-ws-muted">{artifact.type}</span>
                <span className="text-[11px] text-ws-muted ml-auto">{artifact.time}</span>
              </div>

              <div className="text-[11px] text-ws-muted">
                {domain?.name} {subject ? `› ${subject.name}` : ''}
              </div>

              {selectedId === artifact.id && (
                <div className="mt-2.5 pt-2.5 border-t border-ws-edge-soft flex gap-2">
                  <button type="button" className="flex items-center gap-1 px-2.5 py-1 bg-transparent border border-ws-edge-soft rounded-ws-sm text-[11px] font-semibold cursor-pointer text-ws-accent border-[rgba(16,185,129,0.25)] press">
                    <Eye size={12} /> View
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="p-[60px] text-center text-ws-muted text-[13px]">
          No artifacts match your filters
        </div>
      )}
    </div>
  );
}

export default ArtifactsScreen;
