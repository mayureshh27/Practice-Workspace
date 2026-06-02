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

  const [reqPdfs, setReqPdfs] = useState(true);
  const [reqTranscripts, setReqTranscripts] = useState(false);
  const [reqNotes, setReqNotes] = useState(true);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

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

  const handleInjectVariable = (variable: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const currentText = textarea.value;
    const newText = currentText.substring(0, start) + variable + currentText.substring(end);
    
    setTemplateStr(newText);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + variable.length, start + variable.length);
    }, 0);
  };

  const livePreview = () => {
    return templateStr
      .replace(/\{\{subject\}\}/g, 'Modern Robotics')
      .replace(/\{\{chapter\}\}/g, 'Chapter 2: Configuration Space')
      .replace(/\{\{count\}\}/g, '5')
      .replace(/\{\{difficulty\}\}/g, 'Medium')
      .replace(/\{\{blindspots\}\}/g, '[planar degrees of freedom factors]');
  };

  return (
    <div className="flex flex-col w-full h-full bg-ws-bg overflow-hidden">
      
      <div className="px-5 py-4 border-b border-ws-edge-soft bg-ws-bg flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => onNavigate({level: 'workflows'})}
            className="flex items-center justify-center size-7 rounded-ws-sm bg-transparent border border-ws-edge-soft text-ws-soft cursor-pointer"
            title="Back to Workflows"
          >
            <ArrowLeft size={14} />
          </button>
          <div className="flex items-center gap-2">
            <Settings2 size={16} className="text-ws-accent" />
            <span className="font-bold text-ws-ink text-[13.5px]">
              {selectedWf ? `Edit Blueprint: ${selectedWf.name}` : 'Create New Blueprint Template'}
            </span>
          </div>
        </div>
        
        <button 
          type="button" 
          onClick={handleSave}
          className="bg-ws-accent text-ws-bg font-bold border-0 rounded-ws-md px-4 py-[7px] flex items-center gap-1.5 text-[11.5px] cursor-pointer transition-[border-color,background-color,color,filter] duration-[120ms] ease-emil-out h-bright"
        >
          <Save size={12} /> Save Template
        </button>
      </div>

      <div className="flex-1 flex overflow-hidden w-full">
        
        <div className="w-[440px] border-r border-ws-edge-soft bg-ws-bg flex flex-col h-full overflow-y-auto p-6 gap-5 shrink-0 scrollbar">
          
          <div>
            <div className="text-[10.5px] font-bold text-ws-muted uppercase tracking-[0.05em] mb-3">
              Blueprint Metadata
            </div>
            
            <div className="flex flex-col gap-3.5">
              <div className="flex flex-col gap-1.5">
                <label className="text-[11.5px] font-semibold text-ws-soft">Template Name</label>
                <input 
                  type="text" 
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full px-3 py-[9px] bg-ws-bg border border-ws-edge rounded-ws-md text-ws-ink text-sm outline-none"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[11.5px] font-semibold text-ws-soft">Target Artifact Type</label>
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
                  className="w-full px-3 py-2 text-sm"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[11.5px] font-semibold text-ws-soft">Description</label>
                <input 
                  type="text" 
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Workflow purpose and output style..."
                  className="w-full px-3 py-[9px] bg-ws-bg border border-ws-edge rounded-ws-md text-ws-ink text-sm outline-none"
                />
              </div>
            </div>
          </div>

          <div className="border-t border-ws-edge-soft pt-5">
            <div className="text-[10.5px] font-bold text-ws-muted uppercase tracking-[0.05em] mb-3">
              Source Input Requirements
            </div>

            <div className="flex flex-col gap-2.5">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={reqPdfs} onChange={e => setReqPdfs(e.target.checked)} className="size-[13px] accent-ws-glow" />
                <span className="text-[11.5px] text-ws-soft">PDF Documents</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={reqTranscripts} onChange={e => setReqTranscripts(e.target.checked)} className="size-[13px] accent-ws-glow" />
                <span className="text-[11.5px] text-ws-soft">Audio/Video Transcripts</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={reqNotes} onChange={e => setReqNotes(e.target.checked)} className="size-[13px] accent-ws-glow" />
                <span className="text-[11.5px] text-ws-soft">Markdown & Handwritten Notes</span>
              </label>
            </div>
          </div>

          <div className="border-t border-ws-edge-soft pt-5">
            <div className="text-[10.5px] font-bold text-ws-muted uppercase tracking-[0.05em] mb-3 flex items-center gap-1.5">
              <Shield size={12} className="text-ws-accent" />
              <span>Compilation Evaluation Gates</span>
            </div>

            <div className="flex flex-col gap-3">
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input type="checkbox" checked={evalSchema} onChange={e => setEvalSchema(e.target.checked)} className="mt-[3px] size-[13px] accent-ws-glow" />
                <div>
                  <span className="text-sm font-semibold text-ws-ink">JSON Schema Validation</span>
                  <p className="text-[10px] text-ws-muted mt-0.5 mb-0 leading-[1.4]">Ensures compilation strictly conforms to target JSON formatting rules.</p>
                </div>
              </label>

              <label className="flex items-start gap-2.5 cursor-pointer">
                <input type="checkbox" checked={evalSandbox} onChange={e => setEvalSandbox(e.target.checked)} className="mt-[3px] size-[13px] accent-ws-glow" />
                <div>
                  <span className="text-sm font-semibold text-ws-ink">Secure Sandbox Execution</span>
                  <p className="text-[10px] text-ws-muted mt-0.5 mb-0 leading-[1.4]">Executes generated equations or scripts in a isolated terminal to prevent compilation errors.</p>
                </div>
              </label>

              <label className="flex items-start gap-2.5 cursor-pointer">
                <input type="checkbox" checked={evalSource} onChange={e => setEvalSource(e.target.checked)} className="mt-[3px] size-[13px] accent-ws-glow" />
                <div>
                  <span className="text-sm font-semibold text-ws-ink">Fact Grounding & Verification</span>
                  <p className="text-[10px] text-ws-muted mt-0.5 mb-0 leading-[1.4]">Cross-references output coordinates and facts back to linked textbook source segments.</p>
                </div>
              </label>
            </div>
          </div>

        </div>

        <div className="flex-1 flex flex-col h-full overflow-hidden">
          
          <div className="p-4 border-b border-ws-edge-soft bg-ws-bg flex flex-col gap-2.5 shrink-0">
            <div className="flex items-center gap-2">
              <FileCode2 size={14} className="text-ws-accent" />
              <span className="text-[12.5px] font-bold text-ws-ink">Prompt Instruction Template</span>
            </div>
            
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] text-ws-muted mr-1">Insert contextual variable:</span>
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
                  className="px-2 py-[3px] bg-ws-bg border border-ws-edge-soft rounded-ws-sm text-ws-accent text-[9.5px] font-bold cursor-pointer flex items-center gap-0.5 transition-colors duration-100 h-bd-accent h-surface-2"
                >
                  <span>{badge.tag}</span>
                  <span className="text-[8.5px] text-ws-muted font-normal">({badge.label})</span>
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 relative flex bg-ws-bg overflow-hidden">
            
            <div className="w-11 bg-ws-bg border-r border-ws-edge-soft flex flex-col items-center pt-4 text-ws-muted font-mono text-[11px] select-none leading-[1.6] shrink-0">
              {Array.from({length: 12}).map((_, i) => (
                <div key={i}>{i + 1}</div>
              ))}
            </div>

            <textarea 
              ref={textareaRef}
              value={templateStr}
              onChange={e => setTemplateStr(e.target.value)}
              placeholder="Write your prompting template and instructions..."
              className="flex-1 p-4 bg-transparent border-0 text-ws-ink font-mono text-xs leading-[1.6] outline-none resize-none h-full w-full"
            />
          </div>

          <div className="h-[200px] border-t border-ws-edge-soft bg-ws-bg flex flex-col shrink-0">
            <div className="px-4 py-2 bg-ws-bg border-b border-ws-edge-soft flex items-center gap-1.5">
              <Sparkles size={11} className="text-[hsl(140,60%,45%)]" />
              <span className="text-[10px] font-bold text-ws-muted uppercase tracking-[0.05em]">
                Real-Time AI Ingestion Preview
              </span>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 scrollbar">
              <pre className="m-0 text-[11px] font-mono text-ws-muted whitespace-pre-wrap leading-[1.5] bg-transparent">
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
