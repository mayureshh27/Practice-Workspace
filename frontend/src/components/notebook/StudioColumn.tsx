import { AlertCircle, Columns, FileOutput, Play, Plus, RefreshCw, Settings2 } from 'lucide-react';
import { useNavigate } from '@tanstack/react-router';
import type { WorkflowTemplate } from '../../workspaceTypes';
import type { ArtifactDTO } from '../../api/workspaceApi';
import { NotesPanel } from './NotesPanel';

type ArtifactsStatus = {
  isFetching: boolean;
  isLoading: boolean;
  isError: boolean;
};

type Props = {
  collapsed: boolean;
  studioWorkflows: WorkflowTemplate[];
  isGenerating: string | null;
  runError: string | null;

  modelConfigured: boolean;
  subjectArtifacts: ArtifactDTO[];
  artifactsStatus: ArtifactsStatus;
  notes: string[];
  showNotesForm: boolean;
  newNoteText: string;
  subjectId: string;
  firstChapterId: string | undefined;
  onRun: (wf: WorkflowTemplate) => void;
  onDismissError: () => void;
  onRetryLast: () => void;
  onShowNotesForm: (show: boolean) => void;
  onNoteTextChange: (text: string) => void;
  onAddNote: () => void;
  onToggleCollapse: () => void;
};

export function StudioColumn({
  collapsed,
  studioWorkflows,
  isGenerating,
  runError,

  modelConfigured,
  subjectArtifacts,
  artifactsStatus,
  notes,
  showNotesForm,
  newNoteText,
  firstChapterId,
  onRun,
  onDismissError,
  onRetryLast,
  onShowNotesForm,
  onNoteTextChange,
  onAddNote,
  onToggleCollapse,
}: Props) {
  const navigate = useNavigate();

  return (
    <div
      className={`border border-ws-edge-soft rounded-[12px] bg-ws-bench flex flex-col transition-[width] duration-200 ease-emil-out overflow-hidden h-full shrink-0 ${
        collapsed ? 'w-[50px]' : 'w-[340px]'
      }`}
    >
      {/* Header */}
      <div className="px-3.5 py-4 border-b border-ws-edge-soft flex items-center justify-between shrink-0">
        {!collapsed && <span className="text-[13px] font-bold text-ws-ink">Notebook Studio</span>}
        <button
          type="button"
          onClick={onToggleCollapse}
          className="press bg-transparent border-none text-ws-muted cursor-pointer p-1.5 rounded hover:bg-ws-surface-2 transition-colors"
          title={collapsed ? 'Expand Studio' : 'Collapse Studio'}
        >
          <Columns size={14} />
        </button>
      </div>

      {!collapsed && (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Workflows section */}
          <div className="px-4 pt-4 pb-2 flex items-center justify-between gap-2">
            <div className="text-[10px] font-bold text-ws-muted uppercase tracking-wider">
              Workflows
              {!modelConfigured && (
                <span className="ml-2 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-ws-sm bg-ws-warning/10 text-ws-warning text-[9px] normal-case tracking-normal">
                  <AlertCircle size={9} />
                  Model not configured
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() => navigate({ to: '/workflow-editor' })}
              className="press bg-transparent border-none text-ws-muted cursor-pointer p-1 rounded hover:bg-ws-surface-2 transition-colors flex items-center gap-1 text-[10px]"
              title="New workflow"
            >
              <Plus size={12} />
              New
            </button>
          </div>

          <div className="px-4 pb-3 max-h-[40%] overflow-y-auto scrollbar flex flex-col gap-1.5">
            {studioWorkflows.length === 0 ? (
              <div className="px-3 py-4 text-center text-[10px] text-ws-muted italic border border-dashed border-ws-edge-soft rounded-ws-md">
                No workflows yet.
                <br />
                <button
                  type="button"
                  onClick={() => navigate({ to: '/workflow-editor' })}
                  className="press mt-2 text-ws-accent bg-transparent border-none text-[10px] font-bold cursor-pointer"
                >
                  Create one
                </button>
              </div>
            ) : (
              studioWorkflows.map((wf) => {
                const running = isGenerating === wf.id;
                return (
                  <div
                    key={wf.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => !running && onRun(wf)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onRun(wf);
                      }
                    }}
                    title="Run workflow"
                    className={`fade-in group flex items-start gap-2 px-2.5 py-2 border border-ws-edge-soft rounded-ws-md bg-ws-bg cursor-pointer transition-colors duration-150 hover:border-ws-accent/50 ${
                      running ? 'opacity-60 pointer-events-none' : ''
                    }`}
                  >
                    <div className="w-6 h-6 shrink-0 rounded-ws-sm bg-ws-surface-2 border border-ws-edge-soft flex items-center justify-center text-ws-accent">
                      {running ? (
                        <RefreshCw size={12} className="animate-spin" />
                      ) : (
                        <Play size={11} />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[11px] font-bold text-ws-ink truncate">{wf.name}</div>
                      <div className="text-[9px] text-ws-muted mt-0.5 truncate">
                        {wf.targetType} · {wf.evalGates} gate{wf.evalGates === 1 ? '' : 's'}
                        {wf.scope !== 'global' && ` · ${wf.scope}`}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate({
                          to: '/workflow-editor',
                          search: {
                            id: wf.id,
                            fromSubjectId: wf.subjectId || undefined,
                            fromChapterId: firstChapterId || undefined,
                          },
                        });
                      }}
                      title="Edit workflow"
                      className="press shrink-0 bg-transparent border-none text-ws-muted cursor-pointer p-1 rounded hover:bg-ws-surface-2 hover:text-ws-ink transition-colors"
                    >
                      <Settings2 size={12} />
                    </button>
                  </div>
                );
              })
            )}
          </div>

          {/* Run error banner */}
          {runError && (
            <div className="mx-4 mb-3 bg-red-500/10 border border-ws-danger rounded-ws-md p-2.5 flex flex-col gap-2">
              <div className="flex items-start gap-2">
                <AlertCircle size={12} className="text-red-500 shrink-0 mt-px" />
                <span className="text-[10px] text-red-500 leading-[1.4] flex-1">{runError}</span>
              </div>
              <div className="flex gap-1.5 justify-end">
                <button
                  type="button"
                  onClick={onDismissError}
                  className="press bg-transparent border-none text-ws-muted text-[10px] font-bold cursor-pointer px-2 py-1 rounded"
                >
                  Dismiss
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onDismissError();
                    onRetryLast();
                  }}
                  className="press bg-red-500/20 border border-red-500/40 text-red-500 text-[10px] font-bold cursor-pointer px-2 py-1 rounded flex items-center gap-1"
                >
                  <RefreshCw size={9} />
                  Retry
                </button>
              </div>
            </div>
          )}

          {/* Generated history */}
          <div className="flex-1 flex flex-col min-h-0 border-t border-ws-edge-soft">
            <div className="px-4 pt-3 pb-2 flex items-center justify-between">
              <div className="text-[10px] font-bold text-ws-muted uppercase tracking-wider">
                Generated History
              </div>
              {artifactsStatus.isFetching && (
                <RefreshCw size={10} className="text-ws-muted animate-spin" />
              )}
            </div>
            <div className="flex-1 overflow-y-auto px-4 pb-4 scrollbar flex flex-col gap-1.5">
              {artifactsStatus.isError ? (
                <div className="px-3 py-3 text-[10px] text-red-500 border border-dashed border-ws-danger rounded-ws-md">
                  Failed to load history.
                </div>
              ) : artifactsStatus.isLoading ? (
                <div className="px-3 py-3 text-[10px] text-ws-muted italic">Loading…</div>
              ) : subjectArtifacts.length === 0 ? (
                <div className="px-3 py-3 text-[10px] text-ws-muted italic text-center border border-dashed border-ws-edge-soft rounded-ws-md">
                  No artifacts yet for this subject.
                </div>
              ) : (
                subjectArtifacts.map((art, i) => (
                  <div
                    key={art.id}
                    className={`fade-in px-2.5 py-2 border border-ws-edge-soft rounded-ws-md bg-ws-bg flex items-center gap-2 stagger-${Math.min(i + 1, 8)}`}
                  >
                    <FileOutput size={13} className="text-ws-accent shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="text-[11px] font-semibold text-ws-ink truncate">
                        {art.name}
                      </div>
                      <div className="text-[9px] text-ws-muted mt-0.5">
                        {art.time} · {art.type}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Notes section */}
          <div className="px-4 pb-4">
            <NotesPanel
              notes={notes}
              showNotesForm={showNotesForm}
              newNoteText={newNoteText}
              onShowNotesForm={onShowNotesForm}
              onNoteTextChange={onNoteTextChange}
              onAddNote={onAddNote}
            />
          </div>
        </div>
      )}
    </div>
  );
}
