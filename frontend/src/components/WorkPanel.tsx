import { useState } from 'react';
import Editor from '@monaco-editor/react';
import { CheckCircle2, FileText, Play, RotateCcw, Send, Upload, ChevronDown, ChevronRight, Copy, Check } from 'lucide-react';
import type { OutputComparison, RunMode, Theme, UploadedFile } from '../types';
import OutputPanel from './OutputPanel';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

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

  const editorTheme = theme === 'dark' ? 'vs-dark' : 'vs';
  const emptyMessage = needsFiles
    ? 'Upload files to preview them here. Use Run for optional Go drafts.'
    : canSubmitProblem
      ? 'Run code to see formatted output. Submit runs this exercise against local tests.'
      : 'Use Run mode to produce a reproducible proof, then open the proof checklist before marking this project complete.';
  const disabled = !!runningMode;

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
    <section className={cn("flex flex-col h-full overflow-hidden bg-background border border-border rounded-lg", !mainEditorExpanded && 'editor-collapsed')} style={{ flex: mainEditorExpanded ? '1' : '0 0 55px' }}>

      {/* Editor top header actions toolbar */}
      <div className={cn("flex justify-between items-center bg-muted border-b border-border py-3 shrink-0", mainEditorExpanded ? 'px-4' : 'px-2')}>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => setMainEditorExpanded(!mainEditorExpanded)}
            title={mainEditorExpanded ? "Collapse Editor" : "Expand Editor"}
            className="size-7"
          >
            {mainEditorExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </Button>

          {mainEditorExpanded && (
          <div className="flex flex-col">
            <b className="text-[13px] font-bold text-foreground tracking-tight">
              {needsFiles ? 'File workspace' : 'Go editor'}
            </b>
            <span className="text-[11px] text-muted-foreground">
              {needsFiles ? 'Upload sample input files' : canSubmitProblem ? 'Drafts save locally' : 'Manual project completion'}
            </span>
          </div>
          )}
        </div>

        {mainEditorExpanded && (
        <div className="flex items-center gap-1.5">
          {needsFiles && (
            <Button
              asChild
              variant="secondary"
              size="sm"
              className={cn("press h-8", disabled && "opacity-50 pointer-events-none")}
            >
              <label>
                <Upload size={14} />
                <span>Upload</span>
                <input
                  type="file"
                  multiple
                  className="hidden"
                  disabled={disabled}
                  onChange={e => onAddFiles(e.target.files)}
                />
              </label>
            </Button>
          )}

          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={disabled}
            onClick={onResetDraft}
            className="press h-8"
          >
            <RotateCcw
              size={14}
              className="transition-transform duration-200 ease-emil-out hover-capable:hover:-rotate-180"
            />
            <span>Reset</span>
          </Button>

          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={disabled}
            onClick={() => onRun('run')}
            className="press h-8"
          >
            <Play
              size={14}
              className="text-success transition-transform duration-200 hover-capable:hover:translate-x-px hover-capable:hover:scale-110"
            />
            <span className="hover-capable:hover:text-foreground">{runningMode === 'run' ? 'Running...' : 'Run'}</span>
          </Button>

          {canSubmitProblem ? (
            <Button
              type="button"
              size="sm"
              disabled={disabled}
              onClick={() => onRun('submit')}
              className="press h-8 bg-success text-[#0a0a0b] hover:bg-success/90 hover:shadow-[0_0_10px_rgba(16,185,129,0.4)]"
            >
              <Send
                size={14}
                className="transition-transform duration-200 hover-capable:hover:translate-x-px hover-capable:hover:-translate-y-px hover-capable:hover:scale-110"
              />
              <span>{runningMode === 'submit' ? 'Submitting...' : 'Submit'}</span>
            </Button>
          ) : (
            <Button
              type="button"
              size="sm"
              disabled={disabled}
              onClick={onMarkComplete}
              className="press h-8 bg-success text-[#0a0a0b] hover:bg-success/90 hover:shadow-[0_0_10px_rgba(16,185,129,0.4)]"
            >
              <CheckCircle2
                size={14}
                className="transition-transform duration-200 hover-capable:hover:scale-110"
              />
              <span>{solved ? 'Completed' : proofReady ? 'Mark complete' : 'Proof checklist'}</span>
            </Button>
          )}
        </div>
      )}
    </div>

      {mainEditorExpanded && (
        needsFiles ? (
          <div className="flex-1 flex flex-col gap-4 p-4 overflow-y-auto scrollbar">

            {/* Glowing drag-and-drop target zone area */}
            <div
              className={cn(
                "text-center px-4 py-6 rounded-lg border border-dashed transition-[background-color,border-color,box-shadow] duration-180",
                isDragging
                  ? 'bg-accent border-success shadow-[0_0_12px_rgba(16,185,129,0.3)]'
                  : 'bg-background border-border'
              )}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => { e.preventDefault(); setIsDragging(false); onAddFiles(e.dataTransfer.files); }}
            >
              <Upload size={24} className={cn("text-success mx-auto mb-2.5 transition-transform duration-200", isDragging && '-translate-y-0.5')} />
              <h3 className="text-[13px] font-bold text-foreground m-0 mb-1.5 tracking-tight">
                Upload sample input files
              </h3>
              <p className="text-xs text-muted-foreground m-0 mb-3.5 leading-relaxed max-w-[460px] mx-auto">
                For file-based textbook problems, drop files here to save them to browser localStorage. Draft Go solvers will have local access.
              </p>
              <Button
                asChild
                size="sm"
                className={cn("press h-8 bg-success text-[#0a0a0b] hover:bg-success/90", disabled && "opacity-50 pointer-events-none")}
              >
                <label>
                  <span>Choose files</span>
                  <input
                    type="file"
                    multiple
                    className="hidden"
                    disabled={disabled}
                    onChange={e => onAddFiles(e.target.files)}
                  />
                </label>
              </Button>
            </div>

            {/* List of uploaded files visually represented */}
            {uploaded.length > 0 && (
              <div className="flex flex-col gap-2">
                <div className="flex justify-between items-center mb-0.5">
                  <b className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                    <FileText size={14} className="text-success" />
                    <span>{uploaded.length} uploaded files</span>
                  </b>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={onClearFiles}
                    className="text-success hover:text-success h-7 px-2"
                  >
                    Clear All
                  </Button>
                </div>

                {uploaded.map((file, index) => {
                  const fileKey = `${file.name}-${index}`;
                  const isExpanded = expandedFiles[fileKey] ?? (index === 0);
                  const isCopied = copiedFileIndex === index;

                  return (
                    <Collapsible
                      key={fileKey}
                      open={isExpanded}
                      onOpenChange={() => toggleFileCard(fileKey)}
                      className="flex flex-col bg-background border border-border rounded-md overflow-hidden transition-all duration-200"
                    >
                      <CollapsibleTrigger className="flex items-center gap-2 h-8 px-2.5 cursor-pointer bg-background hover:bg-accent transition-colors duration-150 data-[state=open]:border-b data-[state=open]:border-border">
                        <FileText size={14} className="text-success shrink-0" />
                        <b className="text-[13px] font-bold text-foreground flex-1 whitespace-nowrap overflow-hidden text-ellipsis text-left">
                          {file.name}
                        </b>
                        <span className="text-[11px] text-muted-foreground shrink-0 pr-1">
                          {file.text.length} chars
                        </span>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={(e) => handleCopyFile(e, file.text, index)}
                          className={cn("size-6", isCopied ? "text-success" : "text-muted-foreground hover:text-foreground")}
                          title="Copy file content"
                        >
                          {isCopied ? <Check size={12} /> : <Copy size={12} />}
                        </Button>
                        <span className="text-muted-foreground shrink-0 p-0.5">
                          {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        </span>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <pre className="m-0 px-4 py-3 text-[11px] font-mono text-muted-foreground bg-background overflow-x-auto max-h-[220px] leading-relaxed scrollbar">
                          {file.text.slice(0, 2000)}{file.text.length > 2000 ? '\n\n[... content truncated for display ...]' : ''}
                        </pre>
                      </CollapsibleContent>
                    </Collapsible>
                  );
                })}
              </div>
            )}

            {/* Optional Go compiler sandbox tray collapse panel */}
            <div className="flex flex-col bg-background border border-border rounded-md overflow-hidden mt-1">
              <Collapsible open={editorExpanded} onOpenChange={setEditorExpanded}>
                <CollapsibleTrigger className="flex items-center justify-between px-3.5 py-2 cursor-pointer bg-background hover:bg-accent transition-colors duration-150 w-full data-[state=open]:border-b data-[state=open]:border-border">
                  <span className="text-[10px] font-bold text-foreground uppercase tracking-wider">
                    Optional Go draft editor
                  </span>
                  <span className="text-muted-foreground">
                    {editorExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </span>
                </CollapsibleTrigger>
                <CollapsibleContent>
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
                    <div className="flex justify-between items-center bg-background border-t border-border px-3 h-8 shrink-0 text-xs text-muted-foreground font-mono">
                      <div className="flex items-center gap-2">
                        <span className="flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-success" />
                          <span>Go Playground Sandbox</span>
                        </span>
                      </div>
                      <div>
                        <span>Tab Size: 4</span>
                      </div>
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>
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
            <div className="flex justify-between items-center bg-background border-t border-border px-4 h-8 shrink-0 text-xs text-muted-foreground font-mono">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-success" />
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
      {mainEditorExpanded && <OutputPanel verdict={verdict} output={output} emptyMessage={emptyMessage} comparison={comparison} />}
    </section>
  );
}

// Local re-import to keep this file self-contained for the Collapsible usages above
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

export default WorkPanel;
