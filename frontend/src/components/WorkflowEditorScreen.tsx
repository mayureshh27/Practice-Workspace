import {Save, FileCode2, Settings2, ArrowLeft, Shield, Sparkles} from 'lucide-react';
import {useState, useEffect, useRef} from 'react';
import type {WorkflowTemplate, NavLocation} from '../workspaceTypes';
import { CustomSelect } from './ui/CustomSelect';

type Props = {
  workflows: WorkflowTemplate[];
  workflowId?: string;
  onNavigate: (loc: NavLocation) => void;
  onSaveWorkflow: (wf: WorkflowTemplate) => void;
};

function WorkflowEditorScreen({workflows, workflowId, onNavigate, onSaveWorkflow}: Props) {
  const selectedWf = workflowId ? workflows.find(w => w.id === workflowId) : null;

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [targetType, setTargetType] = useState('Exercise Pack');
  const [templateStr, setTemplateStr] = useState('');
  
  const [evalSchema, setEvalSchema] = useState(true);
  const [evalSandbox, setEvalSandbox] = useState(true);
  const [evalSource, setEvalSource] = useState(true);

  // Required Ingestions Checklist
  const [reqPdfs, setReqPdfs] = useState(true);
  const [reqTranscripts, setReqTranscripts] = useState(false);
  const [reqNotes, setReqNotes] = useState(true);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Sync state with selected workflow or defaults
  useEffect(() => {
    if (selectedWf) {
      setName(selectedWf.name);
      setDescription(selectedWf.description);
      setTargetType(selectedWf.targetType);
      setTemplateStr(`Given the following source material from {{chapter}} of {{subject}}, generate {{count}} ${selectedWf.targetType.toLowerCase()}s at {{difficulty}} level.

The output should test the learner's understanding of the core concepts, specifically focusing on any identified blind spots: {{blindspots}}.

Format the output strictly according to the PracticeArtifact JSON schema.`);
      setEvalSchema(selectedWf.evalGates >= 1);
      setEvalSandbox(selectedWf.evalGates >= 2);
      setEvalSource(selectedWf.evalGates >= 3);
    } else {
      setName('Custom Extraction Workflow');
      setDescription('Generates custom compiled materials from notebook source files.');
      setTargetType('Summary');
      setTemplateStr(`Given the following source material from {{chapter}} of {{subject}}, extract key coordinate transforms and formulas.

Include step-by-step mathematical derivations for any identified blind spots: {{blindspots}}.

Format the output as a Markdown study guide.`);
      setEvalSchema(true);
      setEvalSandbox(false);
      setEvalSource(true);
    }
  }, [selectedWf, workflowId]);

  const handleSave = () => {
    if (!name.trim()) return;
    
    // Calculate eval gates count
    let gates = 0;
    if (evalSchema) gates++;
    if (evalSandbox) gates++;
    if (evalSource) gates++;

    const savedWf: WorkflowTemplate = {
      id: selectedWf ? selectedWf.id : `wf-${Date.now()}`,
      name: name.trim(),
      description: description.trim() || 'No description provided.',
      targetType: targetType,
      evalGates: gates,
      lastRun: selectedWf?.lastRun || 'Never run'
    };

    onSaveWorkflow(savedWf);
    onNavigate({level: 'workflows'});
  };

  // Cursor variable injection helper
  const handleInjectVariable = (variable: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const currentText = textarea.value;
    const newText = currentText.substring(0, start) + variable + currentText.substring(end);
    
    setTemplateStr(newText);

    // Reposition cursor immediately after inserted variable tag
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + variable.length, start + variable.length);
    }, 0);
  };

  // Live preview builder compiling variable placeholders on-the-fly
  const livePreview = () => {
    return templateStr
      .replace(/\{\{subject\}\}/g, 'Modern Robotics')
      .replace(/\{\{chapter\}\}/g, 'Chapter 2: Configuration Space')
      .replace(/\{\{count\}\}/g, '5')
      .replace(/\{\{difficulty\}\}/g, 'Medium')
      .replace(/\{\{blindspots\}\}/g, '[planar degrees of freedom factors]');
  };

  return (
    <div style={{
      display: 'flex', 
      flexDirection: 'column',
      width: '100%', 
      height: '100%', 
      background: "var(--ws-bg)", 
      overflow: 'hidden'
    }}>
      
      {/* 1. Header */}
      <div style={{
        padding: '16px 20px', 
        borderBottom: '1px solid var(--ws-edge-soft)', 
        background: "var(--ws-bg)", 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        flexShrink: 0
      }}>
        <div style={{display: 'flex', alignItems: 'center', gap: 12}}>
          <button
            type="button"
            onClick={() => onNavigate({level: 'workflows'})}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 28, height: 28, borderRadius: "4px",
              background: 'none', border: '1px solid var(--ws-edge-soft)',
              color: "var(--ws-soft)", cursor: 'pointer'
            }}
            title="Back to Workflows"
          >
            <ArrowLeft size={14} />
          </button>
          <div style={{display: 'flex', alignItems: 'center', gap: 8}}>
            <Settings2 size={16} style={{color: "var(--ws-accent)"}} />
            <span style={{fontWeight: 700, color: "var(--ws-ink)", fontSize: 13.5}}>
              {selectedWf ? `Edit Blueprint: ${selectedWf.name}` : 'Create New Blueprint Template'}
            </span>
          </div>
        </div>
        
        <button 
          type="button" 
          onClick={handleSave}
          style={{
            background: "var(--ws-accent)", color: "var(--ws-bg)", fontWeight: 700,
            border: 'none', borderRadius: "6px", padding: '7px 16px',
            display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, cursor: 'pointer',
            transition: 'all 120ms ease'
          }}
          onMouseEnter={e => { e.currentTarget.style.filter = 'brightness(1.1)'; }}
          onMouseLeave={e => { e.currentTarget.style.filter = 'none'; }}
        >
          <Save size={12} /> Save Template
        </button>
      </div>

      {/* 2. Workspace Body: Left config, Right Prompt editor */}
      <div style={{
        flex: 1,
        display: 'flex',
        overflow: 'hidden',
        width: '100%'
      }}>
        
        {/* LEFT COLUMN: Structural Blueprint configuration */}
        <div style={{
          width: 440,
          borderRight: '1px solid var(--ws-edge-soft)',
          background: "var(--ws-bg)",
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          overflowY: 'auto',
          padding: 24,
          gap: 20,
          flexShrink: 0
        }} className="scrollbar">
          
          <div>
            <div style={{fontSize: 10.5, fontWeight: 700, color: "var(--ws-muted)", textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12}}>
              Blueprint Metadata
            </div>
            
            <div style={{display: 'flex', flexDirection: 'column', gap: 14}}>
              <div style={{display: 'flex', flexDirection: 'column', gap: 6}}>
                <label style={{fontSize: 11.5, fontWeight: 600, color: "var(--ws-soft)"}}>Template Name</label>
                <input 
                  type="text" 
                  value={name}
                  onChange={e => setName(e.target.value)}
                  style={{
                    width: '100%', padding: '9px 12px', background: "var(--ws-bg)",
                    border: '1px solid var(--ws-edge)', borderRadius: "6px",
                    color: "var(--ws-ink)", fontSize: 12, outline: 'none'
                  }}
                />
              </div>

              <div style={{display: 'flex', flexDirection: 'column', gap: 6}}>
                <label style={{fontSize: 11.5, fontWeight: 600, color: "var(--ws-soft)"}}>Target Artifact Type</label>
                <CustomSelect 
                  value={targetType}
                  onChange={val => setTargetType(val)}
                  options={[
                    { value: 'Exercise Pack', label: 'Exercise Pack' },
                    { value: 'Lesson', label: 'Lesson' },
                    { value: 'Quiz', label: 'Quiz' },
                    { value: 'Summary', label: 'Summary' },
                    { value: 'Workbook', label: 'Workbook' }
                  ]}
                  style={{
                    width: '100%', padding: '8px 12px', fontSize: 12
                  }}
                />
              </div>

              <div style={{display: 'flex', flexDirection: 'column', gap: 6}}>
                <label style={{fontSize: 11.5, fontWeight: 600, color: "var(--ws-soft)"}}>Description</label>
                <input 
                  type="text" 
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Workflow purpose and output style..."
                  style={{
                    width: '100%', padding: '9px 12px', background: "var(--ws-bg)",
                    border: '1px solid var(--ws-edge)', borderRadius: "6px",
                    color: "var(--ws-ink)", fontSize: 12, outline: 'none'
                  }}
                />
              </div>
            </div>
          </div>

          {/* Required Ingestion constraints */}
          <div style={{borderTop: '1px solid var(--ws-edge-soft)', paddingTop: 20}}>
            <div style={{fontSize: 10.5, fontWeight: 700, color: "var(--ws-muted)", textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12}}>
              Source Input Requirements
            </div>

            <div style={{display: 'flex', flexDirection: 'column', gap: 10}}>
              <label style={{display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer'}}>
                <input type="checkbox" checked={reqPdfs} onChange={e => setReqPdfs(e.target.checked)} style={{width: 13, height: 13}} className="accent-ws-glow" />
                <span style={{fontSize: 11.5, color: "var(--ws-soft)"}}>PDF Documents</span>
              </label>
              <label style={{display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer'}}>
                <input type="checkbox" checked={reqTranscripts} onChange={e => setReqTranscripts(e.target.checked)} style={{width: 13, height: 13}} className="accent-ws-glow" />
                <span style={{fontSize: 11.5, color: "var(--ws-soft)"}}>Audio/Video Transcripts</span>
              </label>
              <label style={{display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer'}}>
                <input type="checkbox" checked={reqNotes} onChange={e => setReqNotes(e.target.checked)} style={{width: 13, height: 13}} className="accent-ws-glow" />
                <span style={{fontSize: 11.5, color: "var(--ws-soft)"}}>Markdown & Handwritten Notes</span>
              </label>
            </div>
          </div>

          {/* Evaluation Gates checklist */}
          <div style={{borderTop: '1px solid var(--ws-edge-soft)', paddingTop: 20}}>
            <div style={{fontSize: 10.5, fontWeight: 700, color: "var(--ws-muted)", textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6}}>
              <Shield size={12} style={{color: "var(--ws-accent)"}} />
              <span>Compilation Evaluation Gates</span>
            </div>

            <div style={{display: 'flex', flexDirection: 'column', gap: 12}}>
              <label style={{display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer'}}>
                <input type="checkbox" checked={evalSchema} onChange={e => setEvalSchema(e.target.checked)} style={{marginTop: 3, width: 13, height: 13}} className="accent-ws-glow" />
                <div>
                  <span style={{fontSize: 12, fontWeight: 600, color: "var(--ws-ink)"}}>JSON Schema Validation</span>
                  <p style={{fontSize: 10, color: "var(--ws-muted)", margin: '2px 0 0', lineHeight: 1.4}}>Ensures compilation strictly conforms to target JSON formatting rules.</p>
                </div>
              </label>

              <label style={{display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer'}}>
                <input type="checkbox" checked={evalSandbox} onChange={e => setEvalSandbox(e.target.checked)} style={{marginTop: 3, width: 13, height: 13}} className="accent-ws-glow" />
                <div>
                  <span style={{fontSize: 12, fontWeight: 600, color: "var(--ws-ink)"}}>Secure Sandbox Execution</span>
                  <p style={{fontSize: 10, color: "var(--ws-muted)", margin: '2px 0 0', lineHeight: 1.4}}>Executes generated equations or scripts in a isolated terminal to prevent compilation errors.</p>
                </div>
              </label>

              <label style={{display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer'}}>
                <input type="checkbox" checked={evalSource} onChange={e => setEvalSource(e.target.checked)} style={{marginTop: 3, width: 13, height: 13}} className="accent-ws-glow" />
                <div>
                  <span style={{fontSize: 12, fontWeight: 600, color: "var(--ws-ink)"}}>Fact Grounding & Verification</span>
                  <p style={{fontSize: 10, color: "var(--ws-muted)", margin: '2px 0 0', lineHeight: 1.4}}>Cross-references output coordinates and facts back to linked textbook source segments.</p>
                </div>
              </label>
            </div>
          </div>

        </div>

        {/* RIGHT COLUMN: Prompt Engineering console */}
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          overflow: 'hidden'
        }}>
          
          {/* Editor Header & Variable Badges inject options */}
          <div style={{
            padding: 16, 
            borderBottom: '1px solid var(--ws-edge-soft)', 
            background: "var(--ws-bg)",
            display: 'flex', 
            flexDirection: 'column', 
            gap: 10,
            flexShrink: 0
          }}>
            <div style={{display: 'flex', alignItems: 'center', gap: 8}}>
              <FileCode2 size={14} style={{color: "var(--ws-accent)"}} />
              <span style={{fontSize: 12.5, fontWeight: 700, color: "var(--ws-ink)"}}>Prompt Instruction Template</span>
            </div>
            
            <div style={{display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap'}}>
              <span style={{fontSize: 10, color: "var(--ws-muted)", marginRight: 4}}>Insert contextual variable:</span>
              {[
                { tag: '{{subject}}', label: 'Subject Name' },
                { tag: '{{chapter}}', label: 'Chapter Title' },
                { tag: '{{count}}', label: 'Problem Count' },
                { tag: '{{difficulty}}', label: 'Difficulty' },
                { tag: '{{blindspots}}', label: 'Blindspots' }
              ].map(badge => (
                <button
                  key={badge.tag}
                  type="button"
                  onClick={() => handleInjectVariable(badge.tag)}
                  style={{
                    padding: '3px 8px', background: "var(--ws-bg)", border: '1px solid var(--ws-edge-soft)',
                    borderRadius: "4px", color: "var(--ws-accent)", fontSize: 9.5, fontWeight: 700,
                    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 2, transition: 'all 100ms ease'
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--ws-accent)"; e.currentTarget.style.background = "var(--ws-surface-2)"; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--ws-line)"; e.currentTarget.style.background = "var(--ws-bg)"; }}
                >
                  <span>{badge.tag}</span>
                  <span style={{fontSize: 8.5, color: "var(--ws-muted)", fontWeight: 400}}>({badge.label})</span>
                </button>
              ))}
            </div>
          </div>

          {/* Interactive Textarea Prompt Editor */}
          <div style={{flex: 1, position: 'relative', display: 'flex', background: "var(--ws-bg)", overflow: 'hidden'}}>
            
            {/* Monospaced Line Number sidebar gutter */}
            <div style={{
              width: 44, background: "var(--ws-bg)", borderRight: '1px solid var(--ws-edge-soft)',
              display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 16,
              color: "var(--ws-muted)", fontFamily: 'monospace', fontSize: 11, userSelect: 'none',
              lineHeight: 1.6, flexShrink: 0
            }}>
              {Array.from({length: 12}).map((_, i) => (
                <div key={i}>{i + 1}</div>
              ))}
            </div>

            <textarea 
              ref={textareaRef}
              value={templateStr}
              onChange={e => setTemplateStr(e.target.value)}
              placeholder="Write your prompting template and instructions..."
              style={{
                flex: 1, padding: 16, background: 'transparent', border: 'none',
                color: "var(--ws-ink)", fontFamily: 'var(--font-mono, monospace)', fontSize: 12,
                lineHeight: 1.6, outline: 'none', resize: 'none', height: '100%', width: '100%'
              }}
            />
          </div>

          {/* 3. Bottom: Real-Time Live Preview Console */}
          <div style={{
            height: 200, 
            borderTop: '1px solid var(--ws-edge-soft)', 
            background: "var(--ws-bg)",
            display: 'flex', 
            flexDirection: 'column',
            flexShrink: 0
          }}>
            <div style={{
              padding: '8px 16px', background: "var(--ws-bg)", borderBottom: '1px solid var(--ws-edge-soft)',
              display: 'flex', alignItems: 'center', gap: 6
            }}>
              <Sparkles size={11} style={{color: 'hsl(140, 60%, 45%)'}} />
              <span style={{fontSize: 10, fontWeight: 700, color: "var(--ws-muted)", textTransform: 'uppercase', letterSpacing: '0.05em'}}>
                Real-Time AI Ingestion Preview
              </span>
            </div>
            
            <div style={{flex: 1, overflowY: 'auto', padding: 16}} className="scrollbar">
              <pre style={{
                margin: 0, fontSize: 11, fontFamily: 'var(--font-mono, monospace)',
                color: "var(--ws-muted)", whiteSpace: 'pre-wrap', lineHeight: 1.5, background: 'none'
              }}>
                {livePreview()}
              </pre>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}

export default WorkflowEditorScreen;
