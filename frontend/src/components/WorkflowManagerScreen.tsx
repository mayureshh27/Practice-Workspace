import {Plus, Play, Copy, Trash2, Settings2, Clock, Shield, ArrowRight, Check, RefreshCw, Layers, Database, Cpu, HelpCircle, FileText} from 'lucide-react';
import {useState, useEffect} from 'react';
import type {WorkflowTemplate, NavLocation} from '../workspaceTypes';

type Props = {
  workflows: WorkflowTemplate[];
  onNavigate: (loc: NavLocation) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
};

type SimulationStep = {
  message: string;
  status: 'pending' | 'running' | 'success' | 'fail';
};

function WorkflowManagerScreen({workflows, onNavigate, onDelete, onDuplicate}: Props) {
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  
  const [isSimulating, setIsSimulating] = useState(false);
  const [simStep, setSimStep] = useState(0);
  const [simLogs, setSimLogs] = useState<SimulationStep[]>([]);

  const filtered = workflows.filter(w =>
    w.name.toLowerCase().includes(search.toLowerCase()) ||
    w.targetType.toLowerCase().includes(search.toLowerCase())
  );

  useEffect(() => {
    if (filtered.length > 0 && !selectedId) {
      setSelectedId(filtered[0].id);
    }
  }, [filtered, selectedId]);

  const selectedWf = workflows.find(w => w.id === selectedId) || null;

  const handleRunSimulation = () => {
    if (!selectedWf || isSimulating) return;

    setIsSimulating(true);
    setSimStep(0);
    
    const steps: SimulationStep[] = selectedWf.targetType === 'Practice Solver' ? [
      { message: 'Fetching active coding exercise details from problems.json...', status: 'running' },
      { message: 'Retrieving user draft implementation from workspace buffer...', status: 'pending' },
      { message: 'Booting Go execution environment (local compiler fallback mode)...', status: 'pending' },
      { message: 'Running Evaluation Gate 1: Syntax & Code Compilation check...', status: 'pending' },
      { message: 'Running Evaluation Gate 2: Local AssertEqual Unit Tests check...', status: 'pending' },
      { message: 'Running Evaluation Gate 3: local-test execution verifier check...', status: 'pending' },
      { message: 'Saving exercise completion & local solved stats to localStorage!', status: 'pending' }
    ] : [
      { message: 'Initializing context compilation pipeline...', status: 'running' },
      { message: 'Extracting source reference chunks from Modern_Robotics_Kinematics.pdf...', status: 'pending' },
      { message: 'Injecting workspace coordinates and prompt templates...', status: 'pending' },
      { message: 'Running Evaluation Gate 1: JSON Schema Validation...', status: 'pending' },
      { message: 'Running Evaluation Gate 2: Sandbox Execution Verification...', status: 'pending' },
      { message: 'Running Evaluation Gate 3: Source Fact Grounding Verification...', status: 'pending' },
      { message: 'Synthesizing output and persistent workspace compilation...', status: 'pending' }
    ];

    const activeSteps = steps.filter((_, idx) => {
      if (selectedWf.targetType === 'Practice Solver') return true;
      if (idx === 4 && selectedWf.evalGates < 2) return false;
      if (idx === 5 && selectedWf.evalGates < 3) return false;
      return true;
    });

    setSimLogs(activeSteps);

    let current = 0;
    const interval = setInterval(() => {
      setSimLogs(prev => {
        const next = [...prev];
        if (next[current]) {
          next[current].status = 'success';
        }
        if (next[current + 1]) {
          next[current + 1].status = 'running';
        }
        return next;
      });

      current++;
      setSimStep(current);

      if (current >= activeSteps.length) {
        clearInterval(interval);
        setIsSimulating(false);
      }
    }, 1000);
  };

  const getTargetIcon = (type: string) => {
    switch (type) {
      case 'Exercise Pack': return <Layers size={14} />;
      case 'Quiz': return <HelpCircle size={14} />;
      case 'Summary': return <FileText size={14} />;
      case 'Practice Solver': return <Play size={14} className="text-ws-accent" />;
      default: return <Cpu size={14} />;
    }
  };

  return (
    <div className="flex w-full h-full bg-ws-bg overflow-hidden">
      
      <div className="w-[380px] border-r border-ws-edge-soft bg-ws-bg flex flex-col h-full shrink-0">
        
        <div className="pt-5 px-4 pb-4 border-b border-ws-edge-soft flex flex-col gap-3 shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-[15px] font-bold text-ws-ink m-0">Workflow Manager</h1>
              <p className="text-[10.5px] text-ws-muted mt-0.5 mb-0">{workflows.length} templates configured</p>
            </div>
            
            <button
              type="button"
              onClick={() => onNavigate({level: 'workflow-editor'})}
              className="flex items-center gap-1.5 px-3 py-[7px] bg-ws-accent text-ws-bg border-0 rounded-ws-md font-bold text-[11px] cursor-pointer transition-[border-color,background-color,color,filter] duration-[120ms] ease-emil-out h-bright"
            >
              <Plus size={12} /> New Template
            </button>
          </div>

          <input
            type="text"
            placeholder="Search templates or target types..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full px-3 py-2 bg-ws-bg border border-ws-edge rounded-ws-md text-ws-ink outline-none text-[11.5px] transition-colors duration-150 focus:border-ws-accent"
          />
        </div>

        <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2 scrollbar">
          {filtered.map(wf => {
            const isSelected = wf.id === selectedId;
            return (
              <div 
                key={wf.id} 
                onClick={() => { setSelectedId(wf.id); setIsSimulating(false); setSimStep(0); }}
                className={`flex flex-col gap-2 p-3 ${isSelected ? 'bg-ws-surface-2 border-ws-surface-2' : 'bg-transparent border-ws-line'} border rounded-ws-lg cursor-pointer transition-colors duration-150 ${!isSelected ? 'h-bd-strong' : ''}`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[12.5px] font-bold text-ws-ink">{wf.name}</span>
                  <div className="flex items-center gap-1 px-1.5 py-0.5 bg-ws-bg border border-ws-edge-soft rounded-ws-sm text-[9px] text-ws-soft font-semibold">
                    {getTargetIcon(wf.targetType)}
                    <span>{wf.targetType}</span>
                  </div>
                </div>

                <p className="text-[11px] text-ws-muted m-0 leading-[1.45] line-clamp-2">
                  {wf.description}
                </p>

                <div className="flex items-center justify-between border-t border-ws-edge-soft pt-2 mt-1">
                  <div className="flex items-center gap-2.5 text-[9.5px] text-ws-muted">
                    <span className="flex items-center gap-[3px]">
                      <Shield size={10} /> {wf.evalGates} Gates
                    </span>
                    {wf.lastRun && (
                      <span className="flex items-center gap-[3px]">
                        <Clock size={10} /> {wf.lastRun}
                      </span>
                    )}
                  </div>
                  <ArrowRight size={12} className={`${isSelected ? 'text-ws-accent' : 'text-ws-muted'} transition-transform duration-150`} />
                </div>
              </div>
            );
          })}

          {filtered.length === 0 && (
            <div className="p-10 text-center text-ws-muted text-sm italic">
              {search ? `No templates found matching "${search}"` : 'No templates added yet.'}
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {selectedWf ? (
          <div className="flex-1 flex flex-col overflow-hidden">
            
            <div className="p-5 border-b border-ws-edge-soft bg-ws-bg flex items-start justify-between shrink-0">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-extrabold text-ws-ink m-0">{selectedWf.name}</h2>
                  <span className="px-2 py-0.5 bg-ws-bg border border-ws-edge-soft rounded-ws-sm text-[10px] font-bold text-ws-accent">
                    Active Blueprint
                  </span>
                </div>
                <p className="text-[11.5px] text-ws-soft mt-1 mb-0">{selectedWf.description}</p>
              </div>

              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => onNavigate({level: 'workflow-editor', workflowId: selectedWf.id})}
                  className="flex items-center gap-1 px-3 py-1.5 bg-ws-bg border border-ws-edge-soft rounded-ws-md text-ws-soft text-[11px] font-semibold cursor-pointer transition-colors duration-[120ms] ease-emil-out h-surface-2"
                >
                  <Settings2 size={12} /> Edit Template
                </button>
                <button
                  type="button"
                  onClick={() => onDuplicate(selectedWf.id)}
                  className="flex items-center gap-1 px-3 py-1.5 bg-ws-bg border border-ws-edge-soft rounded-ws-md text-ws-soft text-[11px] font-semibold cursor-pointer transition-colors duration-[120ms] ease-emil-out h-surface-2"
                >
                  <Copy size={12} /> Duplicate
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(selectedWf.id)}
                  className="press flex items-center gap-1 px-3 py-1.5 bg-ws-bg border border-ws-edge-soft rounded-ws-md text-red-500 text-[11px] font-semibold cursor-pointer h-surface-2"
                >
                  <Trash2 size={12} /> Delete
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-5 scrollbar">
              
              <div>
                <div className="text-[10px] font-bold text-ws-muted uppercase tracking-[0.05em] mb-2.5">
                  Execution Pipeline Blueprint
                </div>
                <div className="flex items-center gap-2.5 px-5 py-4 bg-ws-bg border border-ws-edge-soft rounded-ws-lg">
                  <div className="flex-1 flex flex-col gap-1 items-center text-center">
                    <div className="size-8 rounded-full bg-ws-bg border border-ws-edge-soft flex items-center justify-center text-ws-soft">
                      <Database size={13} />
                    </div>
                    <span className="text-[10.5px] font-bold text-ws-ink">1. Active Sources</span>
                    <span className="text-[9px] text-ws-muted">Index source chunks</span>
                  </div>

                  <ArrowRight size={14} className="text-ws-edge-strong" />

                  <div className="flex-1 flex flex-col gap-1 items-center text-center">
                    <div className="size-8 rounded-full bg-ws-bg border border-ws-edge-soft flex items-center justify-center text-ws-soft">
                      <FileText size={13} />
                    </div>
                    <span className="text-[10.5px] font-bold text-ws-ink">2. Prompt Compiler</span>
                    <span className="text-[9px] text-ws-muted">Inject context & prompt</span>
                  </div>

                  <ArrowRight size={14} className="text-ws-edge-strong" />

                  <div className="flex-1 flex flex-col gap-1 items-center text-center">
                    <div className="size-8 rounded-full bg-ws-bg border border-ws-edge-soft flex items-center justify-center text-ws-accent">
                      <Shield size={13} />
                    </div>
                    <span className="text-[10.5px] font-bold text-ws-ink">3. Evaluation Gates</span>
                    <span className="text-[9px] text-ws-muted">{selectedWf.evalGates} active gate filters</span>
                  </div>

                  <ArrowRight size={14} className="text-ws-edge-strong" />

                  <div className="flex-1 flex flex-col gap-1 items-center text-center">
                    <div className="size-8 rounded-full bg-ws-bg border border-ws-edge-soft flex items-center justify-center text-[hsl(140,60%,45%)]">
                      <Check size={13} />
                    </div>
                    <span className="text-[10.5px] font-bold text-ws-ink">4. Artifact Output</span>
                    <span className="text-[9px] text-ws-muted">{selectedWf.targetType} file</span>
                  </div>
                </div>
              </div>

              <div>
                <div className="text-[10px] font-bold text-ws-muted uppercase tracking-[0.05em] mb-2.5">
                  Prompt Instructions Blueprint
                </div>
                <div className="bg-ws-bg border border-ws-edge-soft rounded-ws-lg overflow-hidden flex flex-col">
                  <div className="px-4 py-2 bg-ws-bg border-b border-ws-edge-soft flex items-center justify-between">
                    <span className="text-[10px] font-mono text-ws-muted">prompt_template.txt</span>
                    <span className="text-[9px] text-ws-muted uppercase">read-only</span>
                  </div>
                  <pre className="m-0 p-4 text-[11px] font-mono text-ws-ink overflow-x-auto whitespace-pre-wrap leading-[1.5] max-h-[200px] bg-transparent">
{`Given the following source material from {{chapter}} of {{subject}}, generate {{count}} ${selectedWf.targetType.toLowerCase()}s at {{difficulty}} level.

The output should test the learner's understanding of the core concepts, specifically focusing on any identified blind spots.

Format the output strictly according to the PracticeArtifact JSON schema.`}
                  </pre>
                </div>
              </div>

              <div>
                <div className="text-[10px] font-bold text-ws-muted uppercase tracking-[0.05em] mb-2.5">
                  Test Workflow Loop Compiler Simulator
                </div>
                <div className="border border-ws-edge-soft rounded-ws-lg bg-ws-bg p-4 flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm font-bold text-ws-ink">Run dry-run simulation</span>
                      <span className="text-[10.5px] text-ws-muted">Simulate compiling over a mock subject dataset to test filters.</span>
                    </div>

                    <button
                      type="button"
                      onClick={handleRunSimulation}
                      disabled={isSimulating}
                      className={`px-4 py-2 ${isSimulating ? 'bg-ws-bg text-ws-muted cursor-not-allowed' : 'bg-ws-accent text-ws-bg cursor-pointer'} border-0 rounded-ws-md text-[11.5px] font-bold flex items-center gap-1.5 transition-colors duration-[120ms] ease-emil-out`}
                    >
                      {isSimulating ? (
                        <>
                          <RefreshCw size={12} className="animate-spin" />
                          <span>Compiling...</span>
                        </>
                      ) : (
                        <>
                          <Play size={12} />
                          <span>Execute Workflow Loop</span>
                        </>
                      )}
                    </button>
                  </div>

                  {(simLogs.length > 0) && (
                    <div className="bg-ws-bg border border-ws-edge rounded-ws-md p-3 flex flex-col gap-2 font-mono text-[11px]">
                      {simLogs.map((log, idx) => {
                        const showIndicator = () => {
                          if (log.status === 'success') return <span className="text-[hsl(140,60%,45%)]">✓</span>;
                          if (log.status === 'running') return <RefreshCw size={10} className="animate-spin text-ws-accent" />;
                          return <span className="text-ws-muted">○</span>;
                        };
                        
                        return (
                          <div key={idx} className={`flex gap-2 items-center ${log.status === 'running' ? 'text-ws-ink' : log.status === 'success' ? 'text-ws-soft' : 'text-ws-muted'}`}>
                            <div className="w-[14px] flex justify-center">{showIndicator()}</div>
                            <span>{log.message}</span>
                          </div>
                        );
                      })}

                      {simStep >= simLogs.length && (
                        <div className="mt-2 p-2 bg-[rgba(71,217,159,0.1)] border border-[hsl(140,60%,40%)] rounded-ws-sm text-ws-ink text-[10.5px] flex items-center gap-1.5">
                          <Check size={12} className="text-[hsl(140,60%,45%)]" />
                          <span>
                            {selectedWf.targetType === 'Practice Solver' 
                              ? 'Sandbox compiler verification loops completed successfully! Exercise solved and verified locally.' 
                              : `Dry-run compilation loops completed successfully! Persistent Mock ${selectedWf.targetType} file created.`}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

            </div>

          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 p-10 text-ws-muted">
            <Settings2 size={36} className="text-ws-edge-strong" />
            <div className="text-sm text-center">
              Select a workflow template from the left directory to view details, configure gates, or execute custom compilation pipelines.
            </div>
          </div>
        )}
      </div>

    </div>
  );
}

export default WorkflowManagerScreen;
