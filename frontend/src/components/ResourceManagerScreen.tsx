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
    <div className="h-full max-w-none p-6">
      <div className="flex w-full items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-ws-ink mb-0">Resource Manager</h1>
        <button type="button" className="bg-ws-success text-[#0a0a0b] font-semibold rounded-md py-2 px-4 flex items-center gap-2 hover:brightness-110 transition-all cursor-pointer shadow-md">
          <FileUp size={16} /> Add Source
        </button>
      </div>
      
      <div className="flex w-full h-[calc(100%-60px)] gap-6">
        {/* Hierarchy Tree */}
        <div className="w-1/3 bg-ws-surface border border-ws-line rounded-lg flex flex-col overflow-hidden">
          <div className="p-4 border-b border-ws-line bg-ws-surface-2">
            <span className="font-medium text-ws-ink flex items-center gap-2"><FolderTree size={16} /> Curriculum Tree</span>
          </div>
          <div className="p-2 flex-1 overflow-auto">
            {renderTree(TREE_DATA)}
          </div>
        </div>
        
        {/* Detail Panel */}
        <div className="w-2/3 bg-ws-surface border border-ws-line rounded-lg flex flex-col overflow-hidden">
          <div className="p-4 border-b border-ws-line bg-ws-surface-2">
            <span className="font-medium text-ws-ink flex items-center gap-2">
              Topic Sources
            </span>
          </div>
          <div className="p-4 flex-1 overflow-auto flex flex-col gap-4">
            {currentSources.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-ws-muted">
                <FileText size={32} className="mb-4 opacity-50" />
                <p>No sources assigned to this topic.</p>
              </div>
            ) : currentSources.map(s => (
              <div key={s.id} className="p-4 border border-ws-line rounded-lg bg-ws-bg flex gap-4">
                <div className="mt-1">
                  {s.status === 'indexed' && <CheckCircle size={20} className="text-ws-success" />}
                  {s.status === 'extracting' && <Clock size={20} className="text-ws-muted" />}
                  {s.status === 'chunking' && <AlertTriangle size={20} className="text-ws-warning" />}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-ws-ink text-base">{s.name}</span>
                    <span className="text-[11px] text-ws-muted uppercase tracking-wider">{s.status}</span>
                  </div>
                  <div className="flex gap-6 text-[11px] text-ws-muted">
                    <span>{s.chunks} chunks</span>
                    <span>{s.citations} citations</span>
                    <span>{s.artifacts} artifacts generated</span>
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <button type="button" className="bg-ws-bg border border-ws-line rounded-md text-ws-muted text-sm font-semibold cursor-pointer hover:border-ws-success hover:text-ws-success transition-all py-1 px-3 text-center !w-auto">Inspect</button>
                  <button type="button" className="bg-ws-bg border border-ws-line rounded-md text-ws-muted text-sm font-semibold cursor-pointer hover:border-ws-success hover:text-ws-success transition-all py-1 px-3 text-center !w-auto">Reassign</button>
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
