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
    <div style={{
      display: 'flex', 
      width: '100%', 
      height: '100%', 
      background: "var(--ws-bg)", 
      overflow: 'hidden'
    }}>
      
      {/* LEFT COLUMN: List pane */}
      <div style={{
        width: 380,
        borderRight: '1px solid var(--ws-edge-soft)',
        background: "var(--ws-bg)",
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        flexShrink: 0
      }}>
        
        {/* Header */}
        <div style={{
          padding: '20px 16px 16px', 
          borderBottom: '1px solid var(--ws-edge-soft)',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          flexShrink: 0
        }}>
          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
            <div>
              <h1 style={{fontSize: 15, fontWeight: 700, color: "var(--ws-ink)", margin: 0}}>Workflow Manager</h1>
              <p style={{fontSize: 10.5, color: "var(--ws-muted)", margin: '2px 0 0'}}>{workflows.length} templates configured</p>
            </div>
            
            <button
              type="button"
              onClick={() => onNavigate({level: 'workflow-editor'})}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px',
                background: "var(--ws-accent)", color: "var(--ws-bg)", border: 'none',
                borderRadius: "6px", fontWeight: 700, fontSize: 11, cursor: 'pointer',
                transition: 'all 120ms ease'
              }}
              onMouseEnter={e => { e.currentTarget.style.filter = 'brightness(1.1)'; }}
              onMouseLeave={e => { e.currentTarget.style.filter = 'none'; }}
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
            style={{
              width: '100%', padding: '8px 12px',
              background: "var(--ws-bg)", border: '1px solid var(--ws-edge)',
              borderRadius: "6px", color: "var(--ws-ink)", outline: 'none', fontSize: 11.5,
              transition: 'border-color 150ms ease'
            }}
            onFocus={e => { e.currentTarget.style.borderColor = "var(--ws-accent)"; }}
            onBlur={e => { e.currentTarget.style.borderColor = "var(--ws-surface-2)"; }}
          />
        </div>

        {/* Scrollable list */}
        <div style={{flex: 1, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 8}} className="scrollbar">
          {filtered.map(wf => {
            const isSelected = wf.id === selectedId;
            return (
              <div 
                key={wf.id} 
                onClick={() => { setSelectedId(wf.id); setIsSimulating(false); setSimStep(0); }}
                style={{
                  display: 'flex', flexDirection: 'column', gap: 8, padding: 12,
                  background: isSelected ? "var(--ws-surface-2)" : 'transparent', 
                  border: '1px solid',
                  borderColor: isSelected ? "var(--ws-surface-2)" : "var(--ws-line)",
                  borderRadius: 'var(--ws-r-lg)', cursor: 'pointer',
                  transition: 'all 150ms ease'
                }}
                onMouseEnter={e => { if (!isSelected) e.currentTarget.style.borderColor = 'var(--ws-edge-strong)'; }}
                onMouseLeave={e => { if (!isSelected) e.currentTarget.style.borderColor = "var(--ws-line)"; }}
              >
                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                  <span style={{fontSize: 12.5, fontWeight: 700, color: "var(--ws-ink)"}}>{wf.name}</span>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 4, padding: '2px 6px',
                    background: "var(--ws-bg)", border: '1px solid var(--ws-edge-soft)', borderRadius: 4,
                    fontSize: 9, color: "var(--ws-soft)", fontWeight: 600
                  }}>
                    {getTargetIcon(wf.targetType)}
                    <span>{wf.targetType}</span>
                  </div>
                </div>

                <p style={{fontSize: 11, color: "var(--ws-muted)", margin: 0, lineHeight: 1.45, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', textOverflow: 'ellipsis'}}>
                  {wf.description}
                </p>

                <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid var(--ws-edge-soft)', paddingTop: 8, marginTop: 4}}>
                  <div style={{display: 'flex', alignItems: 'center', gap: 10, fontSize: 9.5, color: "var(--ws-muted)"}}>
                    <span style={{display: 'flex', alignItems: 'center', gap: 3}}>
                      <Shield size={10} /> {wf.evalGates} Gates
                    </span>
                    {wf.lastRun && (
                      <span style={{display: 'flex', alignItems: 'center', gap: 3}}>
                        <Clock size={10} /> {wf.lastRun}
                      </span>
                    )}
                  </div>
                  <ArrowRight size={12} style={{color: isSelected ? "var(--ws-accent)" : "var(--ws-muted)", transition: 'transform 150ms ease'}} />
                </div>
              </div>
            );
          })}

          {filtered.length === 0 && (
            <div style={{padding: 40, textAlign: 'center', color: "var(--ws-muted)", fontSize: 12, fontStyle: 'italic'}}>
              {search ? `No templates found matching "${search}"` : 'No templates added yet.'}
            </div>
          )}
        </div>
      </div>

      {/* RIGHT COLUMN: Inspector Details pane */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden'
      }}>
        {selectedWf ? (
          <div style={{flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden'}}>
            
            {/* Header info */}
            <div style={{
              padding: 20, 
              borderBottom: '1px solid var(--ws-edge-soft)', 
              background: "var(--ws-bg)",
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'flex-start',
              flexShrink: 0
            }}>
              <div>
                <div style={{display: 'flex', alignItems: 'center', gap: 8}}>
                  <h2 style={{fontSize: 16, fontWeight: 800, color: "var(--ws-ink)", margin: 0}}>{selectedWf.name}</h2>
                  <span style={{
                    padding: '2px 8px', background: "var(--ws-bg)", border: '1px solid var(--ws-edge-soft)',
                    borderRadius: 4, fontSize: 10, fontWeight: 700, color: "var(--ws-accent)"
                  }}>
                    Active Blueprint
                  </span>
                </div>
                <p style={{fontSize: 11.5, color: "var(--ws-soft)", margin: '4px 0 0'}}>{selectedWf.description}</p>
              </div>

              {/* Controls bar */}
              <div style={{display: 'flex', gap: 6}}>
                <button
                  type="button"
                  onClick={() => onNavigate({level: 'workflow-editor', workflowId: selectedWf.id})}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px',
                    background: "var(--ws-bg)", border: '1px solid var(--ws-edge-soft)',
                    borderRadius: "6px", color: "var(--ws-soft)", fontSize: 11, fontWeight: 600, cursor: 'pointer',
                    transition: 'all 120ms ease'
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = "var(--ws-surface-2)"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "var(--ws-bg)"; }}
                >
                  <Settings2 size={12} /> Edit Template
                </button>
                <button
                  type="button"
                  onClick={() => onDuplicate(selectedWf.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px',
                    background: "var(--ws-bg)", border: '1px solid var(--ws-edge-soft)',
                    borderRadius: "6px", color: "var(--ws-soft)", fontSize: 11, fontWeight: 600, cursor: 'pointer',
                    transition: 'all 120ms ease'
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = "var(--ws-surface-2)"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "var(--ws-bg)"; }}
                >
                  <Copy size={12} /> Duplicate
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(selectedWf.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px',
                    background: "var(--ws-bg)", border: '1px solid var(--ws-edge-soft)',
                    borderRadius: "6px", color: "#ef4444", fontSize: 11, fontWeight: 600, cursor: 'pointer',
                    transition: 'all 120ms ease'
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = "var(--ws-surface-2)"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "var(--ws-bg)"; }}
                >
                  <Trash2 size={12} /> Delete
                </button>
              </div>
            </div>

            {/* Inspector panels: Scrollable internally */}
            <div style={{flex: 1, overflowY: 'auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 20}} className="scrollbar">
              
              {/* Pipeline Blueprint Visualizer */}
              <div>
                <div style={{fontSize: 10, fontWeight: 700, color: "var(--ws-muted)", textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10}}>
                  Execution Pipeline Blueprint
                </div>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '16px 20px',
                  background: "var(--ws-bg)", border: '1px solid var(--ws-edge-soft)', borderRadius: 'var(--ws-r-lg)'
                }}>
                  {/* Step 1: Sources */}
                  <div style={{flex: 1, display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center', textAlign: 'center'}}>
                    <div style={{
                      width: 32, height: 32, borderRadius: '50%', background: "var(--ws-bg)",
                      border: '1px solid var(--ws-edge-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: "var(--ws-soft)"
                    }}>
                      <Database size={13} />
                    </div>
                    <span style={{fontSize: 10.5, fontWeight: 700, color: "var(--ws-ink)"}}>1. Active Sources</span>
                    <span style={{fontSize: 9, color: "var(--ws-muted)"}}>Index source chunks</span>
                  </div>

                  <ArrowRight size={14} style={{color: 'var(--ws-edge-strong)'}} />

                  {/* Step 2: Prompt Compiler */}
                  <div style={{flex: 1, display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center', textAlign: 'center'}}>
                    <div style={{
                      width: 32, height: 32, borderRadius: '50%', background: "var(--ws-bg)",
                      border: '1px solid var(--ws-edge-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: "var(--ws-soft)"
                    }}>
                      <FileText size={13} />
                    </div>
                    <span style={{fontSize: 10.5, fontWeight: 700, color: "var(--ws-ink)"}}>2. Prompt Compiler</span>
                    <span style={{fontSize: 9, color: "var(--ws-muted)"}}>Inject context & prompt</span>
                  </div>

                  <ArrowRight size={14} style={{color: 'var(--ws-edge-strong)'}} />

                  {/* Step 3: Eval Checks */}
                  <div style={{flex: 1, display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center', textAlign: 'center'}}>
                    <div style={{
                      width: 32, height: 32, borderRadius: '50%', background: "var(--ws-bg)",
                      border: '1px solid var(--ws-edge-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: "var(--ws-accent)"
                    }}>
                      <Shield size={13} />
                    </div>
                    <span style={{fontSize: 10.5, fontWeight: 700, color: "var(--ws-ink)"}}>3. Evaluation Gates</span>
                    <span style={{fontSize: 9, color: "var(--ws-muted)"}}>{selectedWf.evalGates} active gate filters</span>
                  </div>

                  <ArrowRight size={14} style={{color: 'var(--ws-edge-strong)'}} />

                  {/* Step 4: Persistent Target */}
                  <div style={{flex: 1, display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center', textAlign: 'center'}}>
                    <div style={{
                      width: 32, height: 32, borderRadius: '50%', background: "var(--ws-bg)",
                      border: '1px solid var(--ws-edge-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: 'hsl(140, 60%, 45%)'
                    }}>
                      <Check size={13} />
                    </div>
                    <span style={{fontSize: 10.5, fontWeight: 700, color: "var(--ws-ink)"}}>4. Artifact Output</span>
                    <span style={{fontSize: 9, color: "var(--ws-muted)"}}>{selectedWf.targetType} file</span>
                  </div>
                </div>
              </div>

              {/* Readonly Prompt Template Codeblock */}
              <div>
                <div style={{fontSize: 10, fontWeight: 700, color: "var(--ws-muted)", textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10}}>
                  Prompt Instructions Blueprint
                </div>
                <div style={{
                  background: "var(--ws-bg)", border: '1px solid var(--ws-edge-soft)', borderRadius: 'var(--ws-r-lg)',
                  overflow: 'hidden', display: 'flex', flexDirection: 'column'
                }}>
                  <div style={{padding: '8px 16px', background: "var(--ws-bg)", borderBottom: '1px solid var(--ws-edge-soft)', display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                    <span style={{fontSize: 10, fontFamily: 'monospace', color: "var(--ws-muted)"}}>prompt_template.txt</span>
                    <span style={{fontSize: 9, color: "var(--ws-muted)", textTransform: 'uppercase'}}>read-only</span>
                  </div>
                  <pre style={{
                    margin: 0, padding: 16, fontSize: 11, fontFamily: 'var(--font-mono, monospace)',
                    color: "var(--ws-ink)", overflowX: 'auto', whiteSpace: 'pre-wrap', lineHeight: 1.5,
                    maxHeight: 200, background: 'none'
                  }}>
{`Given the following source material from {{chapter}} of {{subject}}, generate {{count}} ${selectedWf.targetType.toLowerCase()}s at {{difficulty}} level.

The output should test the learner's understanding of the core concepts, specifically focusing on any identified blind spots.

Format the output strictly according to the PracticeArtifact JSON schema.`}
                  </pre>
                </div>
              </div>

              {/* dry-run compiler simulator */}
              <div>
                <div style={{fontSize: 10, fontWeight: 700, color: "var(--ws-muted)", textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10}}>
                  Test Workflow Loop Compiler Simulator
                </div>
                <div style={{
                  border: '1px solid var(--ws-edge-soft)', borderRadius: 'var(--ws-r-lg)',
                  background: "var(--ws-bg)", padding: 16, display: 'flex', flexDirection: 'column', gap: 12
                }}>
                  <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                    <div style={{display: 'flex', flexDirection: 'column', gap: 2}}>
                      <span style={{fontSize: 12, fontWeight: 700, color: "var(--ws-ink)"}}>Run dry-run simulation</span>
                      <span style={{fontSize: 10.5, color: "var(--ws-muted)"}}>Simulate compiling over a mock subject dataset to test filters.</span>
                    </div>

                    <button
                      type="button"
                      onClick={handleRunSimulation}
                      disabled={isSimulating}
                      style={{
                        padding: '8px 16px', background: isSimulating ? "var(--ws-bg)" : "var(--ws-accent)",
                        color: isSimulating ? "var(--ws-muted)" : "var(--ws-bg)", border: 'none',
                        borderRadius: "6px", fontSize: 11.5, fontWeight: 700, cursor: isSimulating ? 'not-allowed' : 'pointer',
                        display: 'flex', alignItems: 'center', gap: 6, transition: 'all 120ms ease'
                      }}
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
                    <div style={{
                      background: "var(--ws-bg)", border: '1px solid var(--ws-edge)', borderRadius: "6px",
                      padding: 12, display: 'flex', flexDirection: 'column', gap: 8,
                      fontFamily: 'monospace', fontSize: 11
                    }}>
                      {simLogs.map((log, idx) => {
                        const showIndicator = () => {
                          if (log.status === 'success') return <span style={{color: 'hsl(140, 60%, 45%)'}}>✓</span>;
                          if (log.status === 'running') return <RefreshCw size={10} className="animate-spin" style={{color: "var(--ws-accent)"}} />;
                          return <span style={{color: "var(--ws-muted)"}}>○</span>;
                        };
                        
                        return (
                          <div key={idx} style={{
                            display: 'flex', gap: 8, alignItems: 'center',
                            color: log.status === 'running' ? "var(--ws-ink)" : log.status === 'success' ? 'var(--ws-soft)' : "var(--ws-muted)"
                          }}>
                            <div style={{width: 14, display: 'flex', justifyContent: 'center'}}>{showIndicator()}</div>
                            <span>{log.message}</span>
                          </div>
                        );
                      })}

                      {simStep >= simLogs.length && (
                        <div style={{
                          marginTop: 8, padding: 8, background: 'rgba(71,217,159,0.1)',
                          border: '1px solid var(--ws-signal-pass, hsl(140, 60%, 40%))', borderRadius: 4,
                          color: "var(--ws-ink)", fontSize: 10.5, display: 'flex', alignItems: 'center', gap: 6
                        }}>
                          <Check size={12} style={{color: 'hsl(140, 60%, 45%)'}} />
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
          <div style={{
            flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', gap: 12, padding: 40, color: "var(--ws-muted)"
          }}>
            <Settings2 size={36} style={{color: 'var(--ws-edge-strong)'}} />
            <div style={{fontSize: 12, textAlign: 'center'}}>
              Select a workflow template from the left directory to view details, configure gates, or execute custom compilation pipelines.
            </div>
          </div>
        )}
      </div>

    </div>
  );
}

export default WorkflowManagerScreen;
