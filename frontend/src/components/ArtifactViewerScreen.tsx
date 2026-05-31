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
    <div style={{padding: 24, maxWidth: 1000, margin: '0 auto', height: '100%', overflow: 'auto'}}>
      <div style={{marginBottom: 24}}>
        <h1 style={{fontSize: 20, fontWeight: 700, color: "var(--ws-ink)", margin: '0 0 4px'}}>Artifacts</h1>
        <p style={{fontSize: 12, color: "var(--ws-muted)", margin: 0}}>{filtered.length} of {artifacts.length} artifacts</p>
      </div>

      {/* Sleek Horizontal Filter Panel */}
      <div style={{
        background: "var(--ws-bg)", border: '1px solid var(--ws-edge-soft)',
        borderRadius: 'var(--ws-r-lg)', padding: '16px', marginBottom: 24,
        display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center',
        boxShadow: '0 4px 20px rgba(0,0,0,0.15)'
      }}>
        <div style={{display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, paddingRight: 8, borderRight: '1px solid var(--ws-edge)'}}>
          <Filter size={16} style={{color: "var(--ws-accent)"}} />
          <span style={{fontSize: 13, fontWeight: 700, textTransform: 'uppercase', color: "var(--ws-ink)", letterSpacing: '0.04em'}}>Filters</span>
        </div>

        <div style={{display: 'flex', gap: 10, flexWrap: 'wrap', flex: '1 1 auto', alignItems: 'center'}}>
          <CustomSelect 
            value={domainFilter} 
            onChange={val => { setDomainFilter(val); setSubjectFilter('all'); }}
            options={[
              { value: 'all', label: 'All Domains' },
              ...domains.map(d => ({ value: d.id, label: d.name }))
            ]}
            style={selectStyle}
          />

          <CustomSelect 
            value={subjectFilter} 
            onChange={val => setSubjectFilter(val)}
            options={[
              { value: 'all', label: 'All Subjects' },
              ...subjects.map(s => ({ value: s.id, label: s.name }))
            ]}
            style={{...selectStyle, opacity: (domainFilter === 'all' && subjects.length === 0) ? 0.5 : 1}}
            disabled={domainFilter === 'all' && subjects.length === 0}
          />

          <CustomSelect 
            value={typeFilter} 
            onChange={val => setTypeFilter(val)}
            options={[
              { value: 'all', label: 'All Types' },
              ...types.map(t => ({ value: t, label: t }))
            ]}
            style={selectStyle}
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
            style={selectStyle}
          />
        </div>

        <div style={{position: 'relative', flex: '1 1 250px', minWidth: 200, maxWidth: 400}}>
          <Search size={14} style={{position: 'absolute', left: 12, top: 10, color: "var(--ws-muted)"}} />
          <input
            type="text"
            placeholder="Search artifacts..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              padding: '8px 16px 8px 36px', background: "var(--ws-bg)",
              border: '1px solid var(--ws-edge-soft)', borderRadius: "6px",
              color: "var(--ws-ink)", outline: 'none', fontSize: 13, width: '100%',
              transition: 'border-color 150ms ease, box-shadow 150ms ease'
            }}
            onFocus={e => { e.currentTarget.style.borderColor = "var(--ws-accent)"; e.currentTarget.style.boxShadow = '0 0 0 2px rgba(16, 185, 129, 0.08)'; }}
            onBlur={e => { e.currentTarget.style.borderColor = "var(--ws-line)"; e.currentTarget.style.boxShadow = 'none'; }}
          />
        </div>
      </div>

      {/* Artifact grid */}
      <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12}}>
        {filtered.map(artifact => {
          const domain = domains.find(d => d.id === artifact.domainId);
          const subject = domain?.subjects.find(s => s.id === artifact.subjectId);

          return (
            <div
              key={artifact.id}
              style={{
                background: "var(--ws-bg)", border: `1px solid ${selectedId === artifact.id ? "var(--ws-accent)" : "var(--ws-line)"}`,
                borderRadius: 'var(--ws-r-lg)', padding: 16, cursor: 'pointer',
                transition: 'border-color 150ms ease',
              }}
              onClick={() => setSelectedId(selectedId === artifact.id ? null : artifact.id)}
            >
              <div style={{display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8}}>
                <LayoutGrid size={14} style={{color: "var(--ws-muted)", flexShrink: 0}} />
                <span style={{fontSize: 14, fontWeight: 600, color: "var(--ws-ink)", flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}>
                  {artifact.name}
                </span>
                <button
                  type="button"
                  onClick={e => { e.stopPropagation(); onDelete(artifact.id); }}
                  style={{background: 'none', border: 'none', cursor: 'pointer', color: "var(--ws-muted)", display: 'flex', padding: 2}}
                >
                  <Trash2 size={12} />
                </button>
              </div>

              <div style={{display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8}}>
                <span style={{
                  padding: '2px 6px', fontSize: 10, fontWeight: 700, borderRadius: "4px",
                  color: artifact.status === 'approved' ? "var(--ws-accent)" : artifact.status === 'reviewed' ? 'var(--ws-info)' : "var(--ws-muted)",
                  background: artifact.status === 'approved' ? 'rgba(16,185,129,0.1)' : artifact.status === 'reviewed' ? 'rgba(59,130,246,0.1)' : "var(--ws-surface-2)",
                  border: `1px solid ${artifact.status === 'approved' ? "var(--ws-accent)" : artifact.status === 'reviewed' ? 'var(--ws-info)' : "var(--ws-surface-2)"}`,
                  textTransform: 'capitalize',
                }}>
                  {artifact.status}
                </span>
                <span style={{fontSize: 11, color: "var(--ws-muted)"}}>{artifact.type}</span>
                <span style={{fontSize: 11, color: "var(--ws-muted)", marginLeft: 'auto'}}>{artifact.time}</span>
              </div>

              <div style={{fontSize: 11, color: "var(--ws-muted)"}}>
                {domain?.name} {subject ? `› ${subject.name}` : ''}
              </div>

              {selectedId === artifact.id && (
                <div style={{
                  marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--ws-edge-soft)',
                  display: 'flex', gap: 8,
                }}>
                  <button type="button" style={{...btnStyle, color: "var(--ws-accent)", borderColor: 'rgba(16, 185, 129, 0.25)'}}>
                    <Eye size={12} /> View
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div style={{padding: 60, textAlign: 'center', color: "var(--ws-muted)", fontSize: 13}}>
          No artifacts match your filters
        </div>
      )}
    </div>
  );
}

const selectStyle: React.CSSProperties = {
  padding: '6px 32px 6px 12px', background: "var(--ws-bg)", border: '1px solid var(--ws-edge-soft)',
  borderRadius: "6px", color: "var(--ws-ink)", fontSize: 13, outline: 'none',
  cursor: 'pointer', transition: 'all 150ms ease', flex: '1 1 140px', minWidth: 120, maxWidth: 200,
  appearance: 'auto',
};

const btnStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px',
  background: 'none', border: '1px solid var(--ws-edge-soft)', borderRadius: "4px",
  fontSize: 11, fontWeight: 600, cursor: 'pointer',
};

export default ArtifactsScreen;
