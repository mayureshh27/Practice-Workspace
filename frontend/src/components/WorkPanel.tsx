import { useState } from 'react';
import Editor from '@monaco-editor/react';
import { CheckCircle2, FileText, Play, RotateCcw, Send, Upload, ChevronDown, ChevronRight, Copy, Check } from 'lucide-react';
import type { OutputComparison, RunMode, Theme, UploadedFile } from '../types';
import OutputPanel from './OutputPanel';

type Props = {
  needsFiles: boolean;
  canSubmitProblem: boolean;
  code: string;
  theme: Theme;
  runningMode: RunMode | '';
  uploaded: UploadedFile[];
  proofReady: boolean;
  solved: boolean;
  verdict: string;
  output: string;
  comparison: OutputComparison | null;
  onSaveDraft: (value: string | undefined) => void;
  onResetDraft: () => void;
  onAddFiles: (files: FileList | null) => void;
  onClearFiles: () => void;
  onRun: (mode: RunMode) => void;
  onMarkComplete: () => void;
};

function WorkPanel({
  needsFiles,
  canSubmitProblem,
  code,
  theme,
  runningMode,
  uploaded,
  proofReady,
  solved,
  verdict,
  output,
  comparison,
  onSaveDraft,
  onResetDraft,
  onAddFiles,
  onClearFiles,
  onRun,
  onMarkComplete
}: Props) {
  const [expandedFiles, setExpandedFiles] = useState<Record<string, boolean>>({});
  const [editorExpanded, setEditorExpanded] = useState(false);
  const [mainEditorExpanded, setMainEditorExpanded] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const [copiedFileIndex, setCopiedFileIndex] = useState<number | null>(null);

  // Button hover states for custom micro-animations
  const [isResetHovered, setIsResetHovered] = useState(false);
  const [isRunHovered, setIsRunHovered] = useState(false);
  const [isSubmitHovered, setIsSubmitHovered] = useState(false);
  const [isUploadHovered, setIsUploadHovered] = useState(false);

  const editorTheme = theme === 'dark' ? 'vs-dark' : 'vs';
  const emptyMessage = needsFiles
    ? 'Upload files to preview them here. Use Run for optional Go drafts.'
    : canSubmitProblem
      ? 'Run code to see formatted output. Submit runs this exercise against local tests.'
      : 'Use Run mode to produce a reproducible proof, then open the proof checklist before marking this project complete.';

  const toggleFileCard = (fileKey: string) => {
    setExpandedFiles(prev => ({
      ...prev,
      [fileKey]: !prev[fileKey]
    }));
  };

  const handleCopyFile = (e: React.MouseEvent, text: string, idx: number) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopiedFileIndex(idx);
    setTimeout(() => setCopiedFileIndex(null), 2000);
  };

  return (
    <section className={`flex flex-col h-full overflow-hidden bg-ws-bg border border-ws-line rounded-lg ${!mainEditorExpanded ? 'editor-collapsed' : ''}`}>
      
      {/* Editor top header actions toolbar */}
      <div className="flex justify-between items-center bg-ws-floor border-b border-ws-line px-4 py-3 shrink-0">
        
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setMainEditorExpanded(!mainEditorExpanded)}
            className="flex items-center justify-center w-7 h-7 rounded border border-ws-line text-ws-muted hover:bg-ws-bg hover:text-ws-ink transition-colors"
            title={mainEditorExpanded ? "Collapse Editor" : "Expand Editor"}
          >
            {mainEditorExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
          
          <div className="flex flex-col">
            <b className="text-[13px] font-bold text-ws-ink tracking-tight">
              {needsFiles ? 'File workspace' : 'Go editor'}
            </b>
            <span className="text-[11px] text-ws-muted">
              {needsFiles ? 'Upload sample input files' : canSubmitProblem ? 'Drafts save locally' : 'Manual project completion'}
            </span>
          </div>
        </div>

        {/* Toolbar Run/Submit capsule action buttons */}
        <div className="flex items-center gap-1.5">
          {needsFiles && (
            <label 
              className={`inline-flex items-center gap-1.5 px-3 h-8 text-[13px] font-medium text-ws-muted bg-ws-surface-2 border border-ws-line rounded-md cursor-pointer transition-all duration-150 ${runningMode ? 'opacity-50 cursor-not-allowed pointer-events-none' : 'hover:text-ws-ink hover:border-ws-line-strong'}`}
              onMouseEnter={() => setIsUploadHovered(true)}
              onMouseLeave={() => setIsUploadHovered(false)}
            >
              <Upload 
                size={14} 
                className={`transition-transform duration-200 ${isUploadHovered ? '-translate-y-px text-ws-ink' : ''}`}
              /> 
              <span>Upload</span>
              <input
                type="file"
                multiple
                className="hidden"
                disabled={!!runningMode}
                onChange={e => onAddFiles(e.target.files)}
              />
            </label>
          )}
          
          <button 
            type="button" 
            className={`inline-flex items-center gap-1.5 px-3 h-8 text-[13px] font-medium text-ws-muted bg-ws-surface-2 border border-ws-line rounded-md cursor-pointer transition-all duration-150 ${runningMode ? 'opacity-50 cursor-not-allowed pointer-events-none' : 'hover:text-ws-ink hover:border-ws-line-strong'}`}
            disabled={!!runningMode} 
            onClick={onResetDraft}
            onMouseEnter={() => setIsResetHovered(true)}
            onMouseLeave={() => setIsResetHovered(false)}
          >
            <RotateCcw 
              size={14} 
              className={`transition-transform duration-300 ease-in-out ${isResetHovered ? '-rotate-180 text-ws-ink' : ''}`}
            /> 
            <span>Reset</span>
          </button>

          <button 
            type="button" 
            className={`inline-flex items-center gap-1.5 px-3 h-8 text-[13px] font-medium text-ws-muted bg-ws-surface-2 border border-ws-line rounded-md cursor-pointer transition-all duration-150 ${runningMode ? 'opacity-50 cursor-not-allowed pointer-events-none' : 'hover:text-ws-ink hover:border-ws-line-strong'}`}
            disabled={!!runningMode} 
            onClick={() => onRun('run')}
            onMouseEnter={() => setIsRunHovered(true)}
            onMouseLeave={() => setIsRunHovered(false)}
          >
            <Play 
              size={14} 
              className={`text-ws-success transition-transform duration-200 ${isRunHovered ? 'translate-x-px scale-110' : ''}`}
            /> 
            <span className={isRunHovered ? 'text-ws-ink' : ''}>{runningMode === 'run' ? 'Running...' : 'Run'}</span>
          </button>

          {canSubmitProblem ? (
            <button 
              type="button" 
              className={`inline-flex items-center gap-1.5 px-3 h-8 text-[13px] font-bold text-[#0a0a0b] bg-ws-success border border-ws-success rounded-md cursor-pointer transition-all duration-150 ${runningMode ? 'opacity-50 cursor-not-allowed pointer-events-none' : 'hover:shadow-[0_0_10px_rgba(16,185,129,0.4)]'}`}
              disabled={!!runningMode} 
              onClick={() => onRun('submit')}
              onMouseEnter={() => setIsSubmitHovered(true)}
              onMouseLeave={() => setIsSubmitHovered(false)}
            >
              <Send 
                size={14} 
                className={`transition-transform duration-200 ${isSubmitHovered ? 'translate-x-px -translate-y-px scale-110' : ''}`}
              /> 
              <span>{runningMode === 'submit' ? 'Submitting...' : 'Submit'}</span>
            </button>
          ) : (
            <button 
              type="button" 
              className={`inline-flex items-center gap-1.5 px-3 h-8 text-[13px] font-bold text-[#0a0a0b] bg-ws-success border border-ws-success rounded-md cursor-pointer transition-all duration-150 ${runningMode ? 'opacity-50 cursor-not-allowed pointer-events-none' : 'hover:scale-[1.025] hover:shadow-[0_0_10px_rgba(16,185,129,0.4)]'}`}
              disabled={!!runningMode} 
              onClick={onMarkComplete}
              onMouseEnter={() => setIsSubmitHovered(true)}
              onMouseLeave={() => setIsSubmitHovered(false)}
            >
              <CheckCircle2 
                size={14} 
                className={`transition-transform duration-200 ${isSubmitHovered ? 'scale-110' : ''}`}
              /> 
              <span>{solved ? 'Completed' : proofReady ? 'Mark complete' : 'Proof checklist'}</span>
            </button>
          )}
        </div>
      </div>

      {mainEditorExpanded && (
        needsFiles ? (
          <div className="flex-1 flex flex-col gap-4 p-4 overflow-y-auto scrollbar">
            
            {/* Glowing drag-and-drop target zone area */}
            <div 
              className={`text-center px-4 py-6 rounded-lg border border-dashed transition-all duration-180 ${isDragging ? 'bg-ws-surface-2 border-ws-success shadow-[0_0_12px_rgba(16,185,129,0.3)]' : 'bg-ws-bg border-ws-line'}`}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => { e.preventDefault(); setIsDragging(false); onAddFiles(e.dataTransfer.files); }}
            >
              <Upload size={24} className={`text-ws-success mx-auto mb-2.5 transition-transform duration-200 ${isDragging ? '-translate-y-0.5' : ''}`} />
              <h3 className="text-[13px] font-bold text-ws-ink m-0 mb-1.5 tracking-tight">
                Upload sample input files
              </h3>
              <p className="text-xs text-ws-muted m-0 mb-3.5 leading-relaxed max-w-[460px] mx-auto">
                For file-based textbook problems, drop files here to save them to browser localStorage. Draft Go solvers will have local access.
              </p>
              <label 
                className={`inline-flex items-center gap-1.5 px-3.5 h-8 text-[13px] font-bold text-[#0a0a0b] bg-ws-success border border-ws-success rounded-md cursor-pointer transition-all duration-120 hover:brightness-110 ${runningMode ? 'opacity-50 cursor-not-allowed pointer-events-none' : ''}`}
              >
                <span>Choose files</span>
                <input
                  type="file"
                  multiple
                  className="hidden"
                  disabled={!!runningMode}
                  onChange={e => onAddFiles(e.target.files)}
                />
              </label>
            </div>

            {/* List of uploaded files visually represented */}
            {uploaded.length > 0 && (
              <div className="flex flex-col gap-2">
                <div className="flex justify-between items-center mb-0.5">
                  <b className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-ws-muted">
                    <FileText size={14} className="text-ws-success" />
                    <span>{uploaded.length} uploaded files</span>
                  </b>
                  <button 
                    type="button" 
                    onClick={onClearFiles} 
                    className="text-ws-success text-[13px] font-bold bg-transparent border-none cursor-pointer hover:text-ws-success transition-colors duration-120"
                  >
                    Clear All
                  </button>
                </div>
                
                {uploaded.map((file, index) => {
                  const fileKey = `${file.name}-${index}`;
                  const isExpanded = expandedFiles[fileKey] ?? (index === 0);
                  const isCopied = copiedFileIndex === index;

                  return (
                    <div 
                      key={fileKey} 
                      className={`flex flex-col bg-ws-bg border border-ws-line rounded-md overflow-hidden transition-all duration-200 ${isExpanded ? 'shadow-[0_3px_10px_rgba(0,0,0,0.06)]' : ''}`}
                    >
                      <div
                        onClick={() => toggleFileCard(fileKey)}
                        className={`flex items-center gap-2 h-8 px-2.5 cursor-pointer bg-ws-bg hover:bg-ws-surface-2 transition-colors duration-150 ${isExpanded ? 'border-b border-ws-line' : ''}`}
                      >
                        <FileText size={14} className="text-ws-success shrink-0" />
                        <b className="text-[13px] font-bold text-ws-ink flex-1 whitespace-nowrap overflow-hidden text-ellipsis">
                          {file.name}
                        </b>
                        <span className="text-[11px] text-ws-muted shrink-0 pr-1">
                          {file.text.length} chars
                        </span>
                        
                        {/* Copy file content button */}
                        <button
                          type="button"
                          onClick={(e) => handleCopyFile(e, file.text, index)}
                          className={`flex items-center justify-center p-1 rounded bg-transparent border border-ws-line cursor-pointer transition-colors duration-120 ${isCopied ? 'text-ws-success' : 'text-ws-muted hover:text-ws-ink'}`}
                          title="Copy file content"
                        >
                          {isCopied ? <Check size={12} /> : <Copy size={12} />}
                        </button>

                        <div className="text-ws-muted shrink-0 p-0.5">
                          {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        </div>
                      </div>
                      
                      {isExpanded && (
                        <pre 
                          className="m-0 px-4 py-3 text-[11px] font-mono text-ws-muted bg-ws-bg overflow-x-auto max-h-[220px] leading-relaxed scrollbar"
                        >
                          {file.text.slice(0, 2000)}{file.text.length > 2000 ? '\n\n[... content truncated for display ...]' : ''}
                        </pre>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Optional Go compiler sandbox tray collapse panel */}
            <div className="flex flex-col bg-ws-bg border border-ws-line rounded-md overflow-hidden mt-1">
              <div
                onClick={() => setEditorExpanded(!editorExpanded)}
                className={`flex items-center justify-between px-3.5 py-2 cursor-pointer bg-ws-bg hover:bg-ws-surface-2 transition-colors duration-150 ${editorExpanded ? 'border-b border-ws-line' : ''}`}
              >
                <span className="text-[10px] font-bold text-ws-ink uppercase tracking-wider">
                  Optional Go draft editor
                </span>
                <div className="text-ws-muted">
                  {editorExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </div>
              </div>
              
              {editorExpanded && (
                <div className="relative flex flex-col h-[280px]">
                  <div className="flex-1 min-h-0">
                    <Editor
                      key={theme}
                      height="100%"
                      defaultLanguage="go"
                      theme={editorTheme}
                      value={code}
                      onChange={onSaveDraft}
                      options={{
                        fontSize: 13,
                        fontFamily: 'JetBrains Mono, monospace',
                        minimap: { enabled: false },
                        scrollBeyondLastLine: false,
                        renderLineHighlight: 'all',
                        padding: { top: 12, bottom: 12 },
                        lineNumbers: 'on',
                        glyphMargin: false,
                        folding: true,
                        lineDecorationsWidth: 6,
                        lineNumbersMinChars: 3
                      }}
                    />
                  </div>
                  
                  {/* Floating Monaco micro-toolbar */}
                  <div className="flex justify-between items-center bg-ws-bg border-t border-ws-line px-3 h-8 shrink-0 text-xs text-ws-muted font-mono">
                    <div className="flex items-center gap-2">
                      <span className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-ws-success" />
                        <span>Go Playground Sandbox</span>
                      </span>
                    </div>
                    <div>
                      <span>Tab Size: 4</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

          </div>
        ) : (
          <div className="flex-1 flex flex-col relative min-h-0">
            <div className="flex-1 min-h-0">
              <Editor
                key={theme}
                height="100%"
                defaultLanguage="go"
                theme={editorTheme}
                value={code}
                onChange={onSaveDraft}
                options={{
                  fontSize: 13,
                  fontFamily: 'JetBrains Mono, monospace',
                  minimap: { enabled: false },
                  scrollBeyondLastLine: false,
                  renderLineHighlight: 'all',
                  padding: { top: 16, bottom: 16 },
                  lineNumbers: 'on',
                  glyphMargin: false,
                  folding: true,
                  lineDecorationsWidth: 10,
                  lineNumbersMinChars: 4
                }}
              />
            </div>
            
            {/* Bottom floating micro-toolbar details bar */}
            <div className="flex justify-between items-center bg-ws-bg border-t border-ws-line px-4 h-8 shrink-0 text-xs text-ws-muted font-mono">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-ws-success" />
                  <span>Go Editor (Auto-saved)</span>
                </span>
                <span>UTF-8</span>
              </div>
              <div className="flex items-center gap-3">
                <span>Monaco Instance</span>
                <span>Tab Size: 4</span>
              </div>
            </div>
          </div>
        )
      )}
      
      {/* Interactive terminal output console workspace */}
      <OutputPanel verdict={verdict} output={output} emptyMessage={emptyMessage} comparison={comparison} />
    </section>
  );
}

export default WorkPanel;
