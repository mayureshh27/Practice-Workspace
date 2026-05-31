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
  
  // Selection simulation states
  const [isSimulating, setIsSimulating] = useState(false);
  const [simStep, setSimStep] = useState(0);
  const [simLogs, setSimLogs] = useState<SimulationStep[]>([]);

  const filtered = workflows.filter(w =>
    w.name.toLowerCase().includes(search.toLowerCase()) ||
    w.targetType.toLowerCase().includes(search.toLowerCase())
  );

  // Default selection
  useEffect(() => {
    if (filtered.length > 0 && !selectedId) {
      setSelectedId(filtered[0].id);
    }
  }, [filtered, selectedId]);

  const selectedWf = workflows.find(w => w.id === selectedId) || null;

  // Run dry-run simulation
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

    // Filter based on checked gates
    const activeSteps = steps.filter((_, idx) => {
      if (selectedWf.targetType === 'Practice Solver') return true;
      if (idx === 4 && selectedWf.evalGates < 2) return false; // skip sandbox
      if (idx === 5 && selectedWf.evalGates < 3) return false; // skip grounding
      return true;
    });

    setSimLogs(activeSteps);

    let current = 0;
    const interval = setInterval(() => {
      setSimLogs(prev => {
        const next = [...prev];
        // Mark current successful
        if (next[current]) {
          next[current].status = 'success';
        }
        // Advance and mark next running
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
      case 'Practice Solver': return <Play size={14} style={{color: "var(--ws-accent)"}} />;
      default: return <Cpu size={14} />;
    }
  };

  return (
    <div className="flex w-full h-full bg-ws-floor overflow-hidden p-4 gap-4 text-ws-ink">
      
      {/* LEFT COLUMN: List pane panel */}
      <div className="w-[380px] bg-ws-bench border border-ws-line rounded-xl shadow-md flex flex-col overflow-hidden shrink-0">
        
        {/* Header */}
        <div className="p-4 border-b border-ws-line flex flex-col gap-3 shrink-0 bg-ws-bench/50">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-[14px] font-extrabold text-ws-ink m-0 tracking-tight">Workflow Manager</h1>
              <p className="text-[11px] text-ws-muted m-0 mt-0.5">{workflows.length} templates configured</p>
            </div>
            
            <button
              type="button"
              onClick={() => onNavigate({level: 'workflow-editor'})}
              className="inline-flex items-center gap-1.5 px-3 h-8 bg-ws-glow text-ws-floor font-bold rounded-md text-[11px] cursor-pointer shadow-sm transition-all hover:brightness-110"
            >
              <Plus size={12} /> New Template
            </button>
          </div>

          {/* Search bar */}
          <input
            type="text"
            placeholder="Search templates or target types..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full px-3 py-2 bg-ws-bg border border-ws-line rounded-md text-ws-ink outline-none text-xs focus:border-ws-glow transition-all"
          />
        </div>

        {/* Scrollable list */}
        <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2 scrollbar">
          {filtered.map(wf => {
            const isSelected = wf.id === selectedId;
            return (
              <div 
                key={wf.id} 
                onClick={() => { setSelectedId(wf.id); setIsSimulating(false); setSimStep(0); }}
                className={`flex flex-col gap-2.5 p-3.5 border rounded-lg cursor-pointer transition-all duration-150 shadow-sm ${isSelected ? "bg-ws-bg border-ws-glow" : "bg-ws-bg/40 border-ws-line hover:border-ws-glow/50 hover:bg-ws-bg/70"}`}
              >
                <div className="flex justify-between items-center">
                  <span className="text-[13px] font-bold text-ws-ink tracking-tight">{wf.name}</span>
                  <div className="flex items-center gap-1 px-1.5 py-0.5 bg-ws-bench border border-ws-line rounded text-[10px] text-ws-muted font-bold">
                    {getTargetIcon(wf.targetType)}
                    <span className="ml-1">{wf.targetType}</span>
                  </div>
                </div>

                <p className="text-[11px] text-ws-muted m-0 leading-relaxed line-clamp-2">
                  {wf.description}
                </p>

                <div className="flex items-center justify-between border-t border-ws-line pt-2.5 mt-1.5">
                  <div className="flex items-center gap-2.5 text-[10px] text-ws-muted">
                    <span className="flex items-center gap-1">
                      <Shield size={11} /> {wf.evalGates} Gates
                    </span>
                    {wf.lastRun && (
                      <span className="flex items-center gap-1">
                        <Clock size={11} /> {wf.lastRun}
                      </span>
                    )}
                  </div>
                  <ArrowRight size={12} className={`transition-transform duration-150 ${isSelected ? "text-ws-glow translate-x-0.5" : "text-ws-muted"}`} />
                </div>
              </div>
            );
          })}

          {filtered.length === 0 && (
            <div className="p-10 text-center text-ws-muted text-xs italic">
              {search ? `No templates found matching "${search}"` : 'No templates added yet.'}
            </div>
          )}
        </div>
      </div>

      {/* RIGHT COLUMN: Inspector Details panel */}
      <div className="flex-1 bg-ws-bench border border-ws-line rounded-xl shadow-md flex flex-col overflow-hidden shrink-0">
        {selectedWf ? (
          <div className="flex-1 flex flex-col overflow-hidden">
            
            {/* Header info */}
            <div className="p-5 border-b border-ws-line bg-ws-bench/50 flex justify-between items-start shrink-0 gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-extrabold text-ws-ink m-0 tracking-tight">{selectedWf.name}</h2>
                  <span className="px-2 py-0.5 bg-ws-bg border border-ws-line rounded text-[10px] font-bold text-ws-glow">
                    Active Blueprint
                  </span>
                </div>
                <p className="text-xs text-ws-muted m-0 mt-1 leading-normal">{selectedWf.description}</p>
              </div>

              {/* Controls bar */}
              <div className="flex gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => onNavigate({level: 'workflow-editor', workflowId: selectedWf.id})}
                  className="flex items-center gap-1.5 px-3 h-8 bg-ws-bg border border-ws-line rounded-md text-ws-ink text-xs font-semibold hover:bg-ws-surface-2 transition-colors"
                >
                  <Settings2 size={12} /> Edit Template
                </button>
                <button
                  type="button"
                  onClick={() => onDuplicate(selectedWf.id)}
                  className="flex items-center gap-1.5 px-3 h-8 bg-ws-bg border border-ws-line rounded-md text-ws-ink text-xs font-semibold hover:bg-ws-surface-2 transition-colors"
                >
                  <Copy size={12} /> Duplicate
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(selectedWf.id)}
                  className="flex items-center gap-1.5 px-3 h-8 bg-ws-bg border border-ws-line rounded-md text-red-400 text-xs font-semibold hover:bg-ws-surface-2 transition-colors"
                >
                  <Trash2 size={12} /> Delete
                </button>
              </div>
            </div>

            {/* Inspector panels: Scrollable internally */}
            <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-5 scrollbar">
              
              {/* Pipeline Blueprint Visualizer */}
              <div className="flex flex-col gap-2.5">
                <div className="text-[10px] font-bold text-ws-muted uppercase tracking-wider px-1">
                  Execution Pipeline Blueprint
                </div>
                <div className="flex items-center gap-2.5 p-4 bg-ws-bg border border-ws-line rounded-lg shadow-sm">
                  {/* Step 1: Sources */}
                  <div className="flex-1 flex flex-col gap-1 items-center text-center">
                    <div className="w-8 h-8 rounded-full bg-ws-bench border border-ws-line flex items-center justify-center text-ws-muted shadow-sm">
                      <Database size={13} />
                    </div>
                    <span className="text-[11px] font-bold text-ws-ink mt-1">1. Active Sources</span>
                    <span className="text-[9px] text-ws-muted">Index source chunks</span>
                  </div>

                  <ArrowRight size={14} className="text-ws-muted" />

                  {/* Step 2: Prompt Compiler */}
                  <div className="flex-1 flex flex-col gap-1 items-center text-center">
                    <div className="w-8 h-8 rounded-full bg-ws-bench border border-ws-line flex items-center justify-center text-ws-muted shadow-sm">
                      <FileText size={13} />
                    </div>
                    <span className="text-[11px] font-bold text-ws-ink mt-1">2. Prompt Compiler</span>
                    <span className="text-[9px] text-ws-muted">Inject context & prompt</span>
                  </div>

                  <ArrowRight size={14} className="text-ws-muted" />

                  {/* Step 3: Eval Checks */}
                  <div className="flex-1 flex flex-col gap-1 items-center text-center">
                    <div className="w-8 h-8 rounded-full bg-ws-bench border border-ws-line flex items-center justify-center text-ws-glow shadow-sm">
                      <Shield size={13} />
                    </div>
                    <span className="text-[11px] font-bold text-ws-ink mt-1">3. Evaluation Gates</span>
                    <span className="text-[9px] text-ws-muted">{selectedWf.evalGates} active gate filters</span>
                  </div>

                  <ArrowRight size={14} className="text-ws-muted" />

                  {/* Step 4: Persistent Target */}
                  <div className="flex-1 flex flex-col gap-1 items-center text-center">
                    <div className="w-8 h-8 rounded-full bg-ws-bench border border-ws-line flex items-center justify-center text-emerald-400 shadow-sm">
                      <Check size={13} />
                    </div>
                    <span className="text-[11px] font-bold text-ws-ink mt-1">4. Artifact Output</span>
                    <span className="text-[9px] text-ws-muted">{selectedWf.targetType} file</span>
                  </div>
                </div>
              </div>

              {/* Readonly Prompt Template Codeblock */}
              <div className="flex flex-col gap-2.5">
                <div className="text-[10px] font-bold text-ws-muted uppercase tracking-wider px-1">
                  Prompt Instructions Blueprint
                </div>
                <div className="bg-ws-bg border border-ws-line rounded-lg overflow-hidden flex flex-col shadow-sm">
                  <div className="px-4 py-2 bg-ws-bench/35 border-b border-ws-line flex justify-between items-center">
                    <span className="text-[10px] font-mono text-ws-muted">prompt_template.txt</span>
                    <span className="text-[9px] text-ws-muted uppercase font-bold tracking-wider">read-only</span>
                  </div>
                  <pre className="m-0 p-4 text-[11px] font-mono text-ws-ink overflow-x-auto whiteSpace-pre-wrap leading-relaxed max-h-[160px] bg-transparent">
{`Given the following source material from {{chapter}} of {{subject}}, generate {{count}} ${selectedWf.targetType.toLowerCase()}s at {{difficulty}} level.

The output should test the learner's understanding of the core concepts, specifically focusing on any identified blind spots.

Format the output strictly according to the PracticeArtifact JSON schema.`}
                  </pre>
                </div>
              </div>

              {/* dry-run compiler simulator */}
              <div className="flex flex-col gap-2.5">
                <div className="text-[10px] font-bold text-ws-muted uppercase tracking-wider px-1">
                  Test Workflow Loop Compiler Simulator
                </div>
                <div className="border border-ws-line rounded-lg bg-ws-bg/40 p-4 flex flex-col gap-3 shadow-sm">
                  <div className="flex justify-between items-center gap-4">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[13px] font-bold text-ws-ink">Run dry-run simulation</span>
                      <span className="text-[11px] text-ws-muted">Simulate compiling over a mock subject dataset to test filters.</span>
                    </div>

                    <button
                      type="button"
                      onClick={handleRunSimulation}
                      disabled={isSimulating}
                      className={`inline-flex items-center gap-1.5 px-4 h-9 font-bold rounded-md text-xs cursor-pointer transition-all ${isSimulating ? "bg-ws-bench border border-ws-line text-ws-muted" : "bg-ws-glow text-ws-floor hover:brightness-110 shadow-sm"}`}
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

                  {/* Simulator display console */}
                  {(simLogs.length > 0) && (
                    <div className="bg-ws-bg border border-ws-line rounded-lg p-3 flex flex-col gap-2 font-mono text-[11px] shadow-inner">
                      {simLogs.map((log, idx) => {
                        const showIndicator = () => {
                          if (log.status === 'success') return <span className="text-emerald-400 font-bold">✓</span>;
                          if (log.status === 'running') return <RefreshCw size={10} className="animate-spin text-ws-glow" />;
                          return <span className="text-ws-muted">○</span>;
                        };
                        
                        return (
                          <div key={idx} className={`flex gap-2.5 items-center transition-colors ${log.status === 'running' ? "text-ws-ink" : log.status === 'success' ? "text-ws-muted/80" : "text-ws-muted"}`}>
                            <div className="w-3.5 flex justify-center shrink-0">{showIndicator()}</div>
                            <span>{log.message}</span>
                          </div>
                        );
                      })}

                      {simStep >= simLogs.length && (
                        <div className="mt-2.5 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-md text-ws-ink text-[11px] flex items-center gap-2">
                          <Check size={12} className="text-emerald-400 shrink-0" />
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
            <Settings2 size={32} className="text-ws-muted/40" />
            <div className="text-xs text-center max-w-sm leading-relaxed">
              Select a workflow template from the left directory to view details, configure gates, or execute custom compilation pipelines.
            </div>
          </div>
        )}
      </div>

    </div>
  );
}

export default WorkflowManagerScreen;
