import {FileText, FolderTree, FileUp, CheckCircle, Clock, AlertTriangle, ChevronRight, ChevronDown} from 'lucide-react';
import {useState} from 'react';

type Source = { id: string; name: string; status: string; chunks: number; citations: number; artifacts: number; };

const ALL_SOURCES: Record<string, Source[]> = {
  'cspace': [
    {id: '1', name: 'MR-v2.pdf', status: 'indexed', chunks: 142, citations: 89, artifacts: 3},
    {id: '2', name: 'Lecture 4 Transcript', status: 'extracting', chunks: 0, citations: 0, artifacts: 0},
  ],
  'topology': [
    {id: '3', name: 'Go Book Notes', status: 'chunking', chunks: 14, citations: 0, artifacts: 0},
  ],
  'dof': [
    {id: '4', name: 'Gruebler Equation Reference', status: 'indexed', chunks: 12, citations: 5, artifacts: 1},
  ]
};

type TreeNode = {
  id: string;
  label: string;
  children?: TreeNode[];
};

const TREE_DATA: TreeNode[] = [
  {
    id: 'rob', label: 'Robotics Learning', children: [
      {
        id: 'mr', label: 'Modern Robotics', children: [
          {
            id: 'ch2', label: 'Ch2 Configuration Space', children: [
              {id: 'topology', label: 'Topology'},
              {id: 'cspace', label: 'C-space'},
              {id: 'dof', label: 'Degrees of Freedom'},
            ]
          },
          {id: 'ch3', label: 'Ch3 Rigid-Body Motions'},
        ]
      },
      {id: 'kin', label: 'Kinematics'},
      {id: 'dyn', label: 'Dynamics'},
    ]
  }
];

function ResourceManagerScreen() {
  const [expanded, setExpanded] = useState<Set<string>>(new Set(['rob', 'mr', 'ch2']));
  const [selected, setSelected] = useState<Set<string>>(new Set(['cspace']));
  const [activeTopic, setActiveTopic] = useState<string>('cspace');

  const toggleExpand = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelect = (node: TreeNode, isSelected: boolean) => {
    setSelected(prev => {
      const next = new Set(prev);
      
      const toggleRecursive = (n: TreeNode, select: boolean) => {
        if (select) next.add(n.id);
        else next.delete(n.id);
        if (n.children) n.children.forEach(c => toggleRecursive(c, select));
      };

      toggleRecursive(node, isSelected);
      return next;
    });
    if (!node.children) {
      setActiveTopic(node.id);
    }
  };

  const renderTree = (nodes: TreeNode[], depth = 0) => {
    return nodes.map(node => {
      const isExpanded = expanded.has(node.id);
      const isSelected = selected.has(node.id);
      const hasChildren = !!node.children && node.children.length > 0;

      return (
        <div key={node.id} className="flex flex-col">
          <div 
            className={`flex items-center gap-2 py-1 px-2 hover:bg-ws-bg rounded cursor-pointer ${activeTopic === node.id ? 'bg-ws-bg border-l-2 border-ws-success' : ''}`}
            style={{paddingLeft: `${depth * 16 + 8}px`}}
            onClick={() => {
              if (hasChildren) toggleExpand(node.id);
              else setActiveTopic(node.id);
            }}
          >
            <div className="w-4 h-4 flex items-center justify-center text-ws-muted">
              {hasChildren && (isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />)}
            </div>
            <div onClick={e => e.stopPropagation()}>
              <input 
                type="checkbox" 
                className="mr-2"
                checked={isSelected}
                onChange={(e) => toggleSelect(node, e.target.checked)}
              />
            </div>
            <span className={`text-sm ${hasChildren ? 'text-ws-soft font-medium' : 'text-ws-ink'}`}>
              {node.label}
            </span>
          </div>
          {hasChildren && isExpanded && (
            <div>
              {renderTree(node.children!, depth + 1)}
            </div>
          )}
        </div>
      );
    });
  };

  const currentSources = ALL_SOURCES[activeTopic] || [];

  return (
    <div className="p-4 h-full flex flex-col overflow-hidden bg-ws-floor text-ws-ink">
      <div className="p-4 bg-ws-bench border border-ws-line rounded-xl shadow-md flex w-full items-center justify-between shrink-0 mb-4">
        <div>
          <h1 className="text-base font-extrabold text-ws-ink m-0 tracking-tight">Resource Manager</h1>
          <p className="text-[11px] text-ws-muted m-0 mt-0.5">Manage source reference materials and ingestion indices</p>
        </div>
        <button type="button" className="bg-ws-glow text-ws-floor font-bold rounded-md py-2 px-4 flex items-center gap-2 hover:brightness-110 transition-all cursor-pointer shadow-md text-[13px]">
          <FileUp size={14} /> Add Source
        </button>
      </div>
      
      <div className="flex-1 flex w-full h-[calc(100%-70px)] gap-4 overflow-hidden">
        {/* Hierarchy Tree Panel */}
        <div className="w-1/3 bg-ws-bench border border-ws-line rounded-xl shadow-md flex flex-col overflow-hidden shrink-0">
          <div className="p-4 border-b border-ws-line bg-ws-bench/50 shrink-0">
            <span className="font-bold text-[13px] tracking-tight text-ws-ink flex items-center gap-2">
              <FolderTree size={14} className="text-ws-glow" /> Curriculum Tree
            </span>
          </div>
          <div className="p-3 flex-1 overflow-y-auto scrollbar">
            {renderTree(TREE_DATA)}
          </div>
        </div>
        
        {/* Detail Panel */}
        <div className="w-2/3 bg-ws-bench border border-ws-line rounded-xl shadow-md flex flex-col overflow-hidden shrink-0">
          <div className="p-4 border-b border-ws-line bg-ws-bench/50 shrink-0">
            <span className="font-bold text-[13px] tracking-tight text-ws-ink flex items-center gap-2">
              <FileText size={14} className="text-ws-glow" /> Topic Sources
            </span>
          </div>
          <div className="p-4 flex-1 overflow-y-auto flex flex-col gap-3 scrollbar">
            {currentSources.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-ws-muted p-10">
                <FileText size={32} className="mb-3 opacity-30" />
                <p className="text-xs">No sources assigned to this topic.</p>
              </div>
            ) : currentSources.map(s => (
              <div key={s.id} className="p-4 border border-ws-line rounded-lg bg-ws-bg flex gap-4 transition-all hover:border-ws-glow/50 shadow-sm">
                <div className="mt-0.5">
                  {s.status === 'indexed' && <CheckCircle size={18} className="text-emerald-400" />}
                  {s.status === 'extracting' && <Clock size={18} className="text-ws-muted animate-pulse" />}
                  {s.status === 'chunking' && <AlertTriangle size={18} className="text-amber-400 animate-pulse" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1.5 gap-2">
                    <span className="font-bold text-ws-ink text-sm tracking-tight truncate">{s.name}</span>
                    <span className="text-[9px] px-1.5 py-0.5 bg-ws-bench border border-ws-line rounded font-bold text-ws-muted uppercase tracking-wider shrink-0">{s.status}</span>
                  </div>
                  <div className="flex gap-4 text-[11px] text-ws-muted">
                    <span>{s.chunks} chunks</span>
                    <span>{s.citations} citations</span>
                    <span>{s.artifacts} artifacts generated</span>
                  </div>
                </div>
                <div className="flex flex-col gap-1.5 shrink-0">
                  <button type="button" className="bg-ws-bg border border-ws-line rounded-md text-ws-muted text-xs font-semibold cursor-pointer hover:border-ws-glow hover:text-ws-ink transition-all py-1.5 px-3 text-center !w-auto">Inspect</button>
                  <button type="button" className="bg-ws-bg border border-ws-line rounded-md text-ws-muted text-xs font-semibold cursor-pointer hover:border-ws-glow hover:text-ws-ink transition-all py-1.5 px-3 text-center !w-auto">Reassign</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default ResourceManagerScreen;
