import {Filter, GitBranch} from 'lucide-react';
import {useState, useCallback} from 'react';
import { CustomSelect } from './ui/CustomSelect';
import {
  ReactFlow,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  MarkerType
} from '@xyflow/react';
import type { Node, Edge } from '@xyflow/react';
import '@xyflow/react/dist/style.css';

const initialNodes: Node[] = [
  { id: '1', position: { x: 50, y: 125 }, data: { label: 'Topology', status: 'mastered' }, type: 'default', className: 'ws-graph-node mastered' },
  { id: '2', position: { x: 250, y: 125 }, data: { label: 'Configuration Space', status: 'practiced' }, type: 'default', className: 'ws-graph-node practiced' },
  { id: '3', position: { x: 450, y: 125 }, data: { label: 'Rigid Body', status: 'unseen' }, type: 'default', className: 'ws-graph-node unseen' },
  { id: '4', position: { x: 250, y: 250 }, data: { label: 'Degrees of Freedom', status: 'blind-spot' }, type: 'default', className: 'ws-graph-node blind-spot' },
];

const initialEdges: Edge[] = [
  { id: 'e1-2', source: '1', target: '2', animated: true, style: { stroke: '#3f3f46' }, markerEnd: { type: MarkerType.ArrowClosed, color: '#3f3f46' } },
  { id: 'e2-3', source: '2', target: '3', style: { stroke: '#3f3f46' }, markerEnd: { type: MarkerType.ArrowClosed, color: '#3f3f46' } },
  { id: 'e2-4', source: '2', target: '4', style: { stroke: '#3f3f46' }, markerEnd: { type: MarkerType.ArrowClosed, color: '#3f3f46' } },
];

function GraphScreen() {
  const [nodes, _, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const onConnect = useCallback((params: any) => setEdges((eds) => addEdge(params, eds)), [setEdges]);

  const onNodeClick = (_: any, node: Node) => {
    setSelectedNodeId(node.id);
  };

  const selectedNode = nodes.find(n => n.id === selectedNodeId);

  return (
    <div className="p-4 h-full flex flex-col overflow-hidden bg-ws-floor text-ws-ink gap-4">
      <style>{`
        .ws-graph-node {
          background: #0d1117;
          border: 1px solid #27272a;
          border-radius: 0.375rem;
          padding: 8px 16px;
          color: #f4f4f5;
          font-weight: 500;
          font-size: 14px;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .ws-graph-node::before {
          content: '';
          display: block;
          width: 8px;
          height: 8px;
          border-radius: 50%;
        }
        .ws-graph-node.mastered { border-color: var(--ws-glow); }
        .ws-graph-node.mastered::before { background: var(--ws-glow); }
        .ws-graph-node.practiced { border-color: var(--ws-glow); box-shadow: 0 0 0 2px rgba(20,184,166,0.3); }
        .ws-graph-node.practiced::before { background: var(--ws-glow); }
        .ws-graph-node.unseen { opacity: 0.7; }
        .ws-graph-node.unseen::before { background: #a1a1aa; }
        .ws-graph-node.blind-spot { border-color: #eab308; }
        .ws-graph-node.blind-spot::before { background: #eab308; }
        
        /* React Flow Dark Theme Overrides */
        .react-flow__pane { background: #09090b; }
        .react-flow__background { fill: #3f3f46; opacity: 0.2; }
        .react-flow__controls { background: #0d1117; border: 1px solid #27272a; box-shadow: none; border-radius: 0.375rem; overflow: hidden; }
        .react-flow__controls-button { background: transparent; border-bottom: 1px solid #27272a; fill: #d4d4d8; }
        .react-flow__controls-button:hover { background: #09090b; fill: #f4f4f5; }
        .react-flow__controls-button:last-child { border-bottom: none; }
      `}</style>

      {/* Interactive Graph Canvas Bento Panel */}
      <div className="flex-1 bg-ws-bench border border-ws-line rounded-xl shadow-md overflow-hidden relative flex flex-col">
        {/* Filters Overlay floating inside */}
        <div className="absolute top-4 left-4 z-10 bg-ws-bench border border-ws-line rounded-lg p-4 shadow-lg w-80">
          <h3 className="font-bold text-[13px] tracking-tight text-ws-ink mb-3 flex items-center gap-2">
            <Filter size={14} className="text-ws-glow" /> Graph Filters
          </h3>
          
          <div className="flex flex-col gap-3">
            <div>
              <label className="block text-[10px] font-bold text-ws-muted uppercase tracking-wider mb-1">Domain</label>
              <CustomSelect 
                value="Robotics Learning"
                onChange={() => {}}
                options={[
                  { value: 'Robotics Learning', label: 'Robotics Learning' },
                  { value: 'CMU MRSD Prep', label: 'CMU MRSD Prep' }
                ]}
                style={{ width: '100%', padding: '6px', fontSize: '11px' }}
              />
            </div>
            
            <div>
              <label className="block text-[10px] font-bold text-ws-muted uppercase tracking-wider mb-1">Subject</label>
              <CustomSelect 
                value="Modern Robotics"
                onChange={() => {}}
                options={[
                  { value: 'Modern Robotics', label: 'Modern Robotics' },
                  { value: 'All Subjects', label: 'All Subjects' }
                ]}
                style={{ width: '100%', padding: '6px', fontSize: '11px' }}
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-ws-muted uppercase tracking-wider mb-2">Show Elements</label>
              <div className="flex flex-col gap-1.5">
                <label className="flex items-center gap-2 text-xs text-ws-ink cursor-pointer select-none">
                  <input type="checkbox" defaultChecked className="accent-ws-glow rounded w-3 h-3" /> Concepts
                </label>
                <label className="flex items-center gap-2 text-xs text-ws-ink cursor-pointer select-none">
                  <input type="checkbox" defaultChecked className="accent-ws-glow rounded w-3 h-3" /> Prerequisites
                </label>
                <label className="flex items-center gap-2 text-xs text-ws-ink cursor-pointer select-none">
                  <input type="checkbox" className="accent-ws-glow rounded w-3 h-3" /> Sources
                </label>
              </div>
            </div>
          </div>
        </div>

        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={onNodeClick}
          fitView
          attributionPosition="bottom-right"
        >
          <Background color="#3f3f46" gap={24} size={2} />
          <Controls showInteractive={false} position="top-right" style={{margin: '16px'}} />
        </ReactFlow>
      </div>

      {/* Node Detail Bento Panel */}
      <div className="h-44 bg-ws-bench border border-ws-line rounded-xl shadow-md p-5 flex gap-6 shrink-0 overflow-hidden">
        {selectedNode ? (
          <>
            <div className="w-1/3 border-r border-ws-line pr-6 flex flex-col justify-center shrink-0">
              <div className="flex items-center gap-2 mb-1.5 shrink-0">
                <div className={`w-2.5 h-2.5 rounded-full ${selectedNode.data.status === 'mastered' ? 'bg-ws-glow animate-pulse' : selectedNode.data.status === 'practiced' ? 'bg-ws-glow' : selectedNode.data.status === 'blind-spot' ? 'bg-amber-400' : 'bg-ws-muted'}`}></div>
                <h2 className="text-base font-extrabold text-ws-ink m-0 tracking-tight">{selectedNode.data.label as string}</h2>
              </div>
              <div className="text-ws-muted text-xs mb-3">Chapter 2 · {Math.floor(Math.random() * 5) + 1} exercises</div>
              <div className="flex gap-2">
                <button type="button" className="bg-ws-glow text-ws-floor font-bold rounded-md py-1.5 px-4 text-[11px] hover:brightness-110 shadow-sm cursor-pointer transition-all">Practice</button>
                <button type="button" className="bg-ws-bg border border-ws-line rounded-md text-ws-ink hover:bg-ws-surface-2 transition-all font-semibold cursor-pointer py-1.5 px-3 text-[11px]">Sources</button>
              </div>
            </div>
            
            <div className="flex-1 flex flex-col justify-center shrink-0">
              <div className="grid grid-cols-3 gap-6">
                <div>
                  <div className="text-[10px] font-bold text-ws-muted uppercase tracking-wider mb-1">Status</div>
                  <div className="text-xs text-ws-ink font-bold capitalize">{selectedNode.data.status as string}</div>
                </div>
                <div>
                  <div className="text-[10px] font-bold text-ws-muted uppercase tracking-wider mb-1">Attempts</div>
                  <div className="text-xs text-ws-ink font-bold">{Math.floor(Math.random() * 10)} attempts</div>
                </div>
                <div>
                  <div className="text-[10px] font-bold text-ws-muted uppercase tracking-wider mb-1">Last Practiced</div>
                  <div className="text-xs text-ws-ink font-bold">{Math.floor(Math.random() * 5) + 1} days ago</div>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-ws-muted">
            <span className="flex items-center gap-2 text-xs"><GitBranch size={16} className="text-ws-glow" /> Select a node in the graph to view details.</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default GraphScreen;
