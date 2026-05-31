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
    <div className="flex flex-col w-full h-full bg-ws-floor overflow-hidden p-4 gap-4 text-ws-ink">
      
      {/* 1. Header Bento Bar */}
      <div className="p-4 bg-ws-bench border border-ws-line rounded-xl shadow-md flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => onNavigate({level: 'workflows'})}
            className="flex items-center justify-center w-7 h-7 rounded border border-ws-line text-ws-muted hover:text-ws-ink transition-colors"
            title="Back to Workflows"
          >
            <ArrowLeft size={14} />
          </button>
          <div className="flex items-center gap-2">
            <Settings2 size={16} className="text-ws-glow" />
            <span className="font-extrabold text-ws-ink text-[13px] tracking-tight">
              {selectedWf ? `Edit Blueprint: ${selectedWf.name}` : 'Create New Blueprint Template'}
            </span>
          </div>
        </div>
        
        <button 
          type="button" 
          onClick={handleSave}
          className="bg-ws-glow text-ws-floor font-bold rounded-md py-2 px-4 flex items-center gap-2 hover:brightness-110 shadow-md text-[11px] cursor-pointer transition-all"
        >
          <Save size={12} /> Save Template
        </button>
      </div>

      {/* 2. Workspace Body: Left config, Right Prompt editor */}
      <div className="flex-1 flex overflow-hidden gap-4 w-full">
        
        {/* LEFT COLUMN: Structural Blueprint configuration */}
        <div className="w-[440px] bg-ws-bench border border-ws-line rounded-xl shadow-md flex flex-col p-5 gap-5 shrink-0 overflow-y-auto scrollbar">
          
          <div className="flex flex-col gap-4">
            <div className="text-[10px] font-bold text-ws-muted uppercase tracking-wider px-1">
              Blueprint Metadata
            </div>
            
            <div className="flex flex-col gap-3.5">
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-bold text-ws-muted">Template Name</label>
                <input 
                  type="text" 
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full px-3 py-2 bg-ws-bg border border-ws-line rounded-md text-ws-ink outline-none text-xs focus:border-ws-glow transition-all"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-bold text-ws-muted">Target Artifact Type</label>
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

              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-bold text-ws-muted">Description</label>
                <input 
                  type="text" 
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Workflow purpose and output style..."
                  className="w-full px-3 py-2 bg-ws-bg border border-ws-line rounded-md text-ws-ink outline-none text-xs focus:border-ws-glow transition-all"
                />
              </div>
            </div>
          </div>

          {/* Required Ingestion constraints */}
          <div className="border-t border-ws-line pt-4 flex flex-col gap-3">
            <div className="text-[10px] font-bold text-ws-muted uppercase tracking-wider px-1">
              Source Input Requirements
            </div>

            <div className="flex flex-col gap-2.5">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input type="checkbox" checked={reqPdfs} onChange={e => setReqPdfs(e.target.checked)} className="w-3.5 h-3.5 accent-ws-glow bg-ws-bg border-ws-line rounded" />
                <span className="text-xs text-ws-ink">PDF Documents</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input type="checkbox" checked={reqTranscripts} onChange={e => setReqTranscripts(e.target.checked)} className="w-3.5 h-3.5 accent-ws-glow bg-ws-bg border-ws-line rounded" />
                <span className="text-xs text-ws-ink">Audio/Video Transcripts</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input type="checkbox" checked={reqNotes} onChange={e => setReqNotes(e.target.checked)} className="w-3.5 h-3.5 accent-ws-glow bg-ws-bg border-ws-line rounded" />
                <span className="text-xs text-ws-ink">Markdown & Handwritten Notes</span>
              </label>
            </div>
          </div>

          {/* Evaluation Gates checklist */}
          <div className="border-t border-ws-line pt-4 flex flex-col gap-4">
            <div className="text-[10px] font-bold text-ws-muted uppercase tracking-wider px-1 flex items-center gap-1.5">
              <Shield size={12} className="text-ws-glow" />
              <span>Compilation Evaluation Gates</span>
            </div>

            <div className="flex flex-col gap-4">
              <label className="flex items-start gap-2.5 cursor-pointer select-none">
                <input type="checkbox" checked={evalSchema} onChange={e => setEvalSchema(e.target.checked)} className="mt-0.5 w-3.5 h-3.5 accent-ws-glow bg-ws-bg border-ws-line rounded shrink-0" />
                <div>
                  <span className="text-xs font-bold text-ws-ink">JSON Schema Validation</span>
                  <p className="text-[10px] text-ws-muted margin-0 mt-0.5 leading-normal">Ensures compilation strictly conforms to target JSON formatting rules.</p>
                </div>
              </label>

              <label className="flex items-start gap-2.5 cursor-pointer select-none">
                <input type="checkbox" checked={evalSandbox} onChange={e => setEvalSandbox(e.target.checked)} className="mt-0.5 w-3.5 h-3.5 accent-ws-glow bg-ws-bg border-ws-line rounded shrink-0" />
                <div>
                  <span className="text-xs font-bold text-ws-ink">Secure Sandbox Execution</span>
                  <p className="text-[10px] text-ws-muted margin-0 mt-0.5 leading-normal">Executes generated equations or scripts in an isolated terminal to prevent compilation errors.</p>
                </div>
              </label>

              <label className="flex items-start gap-2.5 cursor-pointer select-none">
                <input type="checkbox" checked={evalSource} onChange={e => setEvalSource(e.target.checked)} className="mt-0.5 w-3.5 h-3.5 accent-ws-glow bg-ws-bg border-ws-line rounded shrink-0" />
                <div>
                  <span className="text-xs font-bold text-ws-ink">Fact Grounding & Verification</span>
                  <p className="text-[10px] text-ws-muted margin-0 mt-0.5 leading-normal">Cross-references output coordinates and facts back to linked textbook source segments.</p>
                </div>
              </label>
            </div>
          </div>

        </div>

        {/* RIGHT COLUMN: Prompt Engineering console */}
        <div className="flex-1 flex flex-col gap-4 overflow-hidden">
          
          {/* Prompt Editor Bento Panel */}
          <div className="bg-ws-bench border border-ws-line rounded-xl shadow-md flex-1 flex flex-col overflow-hidden">
            
            {/* Editor Header & Variable Badges inject options */}
            <div className="p-4 border-b border-ws-line bg-ws-bench/50 flex flex-col gap-3 shrink-0">
              <div className="flex items-center gap-1.5">
                <FileCode2 size={14} className="text-ws-glow" />
                <span className="text-xs font-bold text-ws-ink tracking-tight">Prompt Instruction Template</span>
              </div>
              
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] text-ws-muted mr-1">Insert contextual variable:</span>
                {[
                  { tag: '{{subject}}', label: 'Subject' },
                  { tag: '{{chapter}}', label: 'Chapter' },
                  { tag: '{{count}}', label: 'Count' },
                  { tag: '{{difficulty}}', label: 'Difficulty' },
                  { tag: '{{blindspots}}', label: 'Blindspots' }
                ].map(badge => (
                  <button
                    key={badge.tag}
                    type="button"
                    onClick={() => handleInjectVariable(badge.tag)}
                    className="px-2 py-1 bg-ws-bg border border-ws-line rounded text-[10px] font-bold text-ws-glow cursor-pointer display-flex items-center gap-1.5 transition-all hover:border-ws-glow hover:bg-ws-surface-2"
                  >
                    <span>{badge.tag}</span>
                    <span className="text-[8px] text-ws-muted font-normal">({badge.label})</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Interactive Textarea Prompt Editor */}
            <div className="flex-1 relative flex bg-ws-bg overflow-hidden">
              {/* Monospaced Line Number sidebar gutter */}
              <div className="w-11 bg-ws-bg border-r border-ws-line flex flex-col items-center pt-4 text-ws-muted font-mono text-[11px] select-none leading-relaxed shrink-0 gap-0.5">
                {Array.from({length: 12}).map((_, i) => (
                  <div key={i}>{i + 1}</div>
                ))}
              </div>

              <textarea 
                ref={textareaRef}
                value={templateStr}
                onChange={e => setTemplateStr(e.target.value)}
                placeholder="Write your prompting template and instructions..."
                className="flex-1 p-4 bg-transparent border-none text-ws-ink font-mono text-xs leading-relaxed outline-none resize-none h-full w-full"
              />
            </div>
          </div>

          {/* 3. Bottom: Real-Time Live Preview Console */}
          <div className="bg-ws-bench border border-ws-line rounded-xl shadow-md h-[180px] shrink-0 flex flex-col overflow-hidden">
            <div className="px-4 py-2 border-b border-ws-line bg-ws-bench/50 flex items-center gap-1.5 shrink-0">
              <Sparkles size={12} className="text-emerald-400" />
              <span className="text-[10px] font-bold text-ws-muted uppercase tracking-wider">
                Real-Time AI Ingestion Preview
              </span>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 scrollbar">
              <pre className="m-0 text-[11px] font-mono text-ws-muted whiteSpace-pre-wrap leading-relaxed bg-transparent">
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
