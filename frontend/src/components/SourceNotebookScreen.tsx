import {Sparkles, Send, FileOutput, ArrowLeft, Plus, StickyNote, Globe, Check, Columns, X, Upload, Clipboard, Cloud, AlertCircle, Settings2, RefreshCw, ChevronRight, Play} from 'lucide-react';
import {useState, useRef, useEffect, useMemo} from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import type {Domain, Subject, Artifact, NavLocation, WorkflowTemplate} from '../workspaceTypes';
import { CustomSelect } from './ui/CustomSelect';
import { useUIStore } from '../stores/uiStore';
import { useWorkspaceStore } from '../stores/workspaceStore';
import { artifactsQueries } from '../api/queries';

const GithubIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" className="shrink-0" {...props}>
    <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
  </svg>
);

type Message = { id: string; role: 'user' | 'assistant'; content: string };
type GeneratedArtifact = { id: string; name: string; type: string; time: string };

type Props = {
  domain: Domain;
  subject: Subject;
  onNavigate: (loc: NavLocation) => void;
  onAddResource?: (domainId: string, subjectId: string, name: string, fileType: string, linesCount: number) => void;
};

function SourceNotebookScreen({domain, subject, onNavigate, onAddResource}: Props) {
  // Collapsible column states
  const [sourcesCollapsed, setSourcesCollapsed] = useState(false);
  const [studioCollapsed, setStudioCollapsed] = useState(false);

  // Ingestion Overlay Modal States
  const [showAddSources, setShowAddSources] = useState(false);
  const [ingestType, setIngestType] = useState<'upload' | 'github' | 'web' | 'drive' | 'text'>('upload');
  const [ingestUrl, setIngestUrl] = useState('');
  const [ingestText, setIngestText] = useState('');
  const [ingestName, setIngestName] = useState('');
  const [isIngesting, setIsIngesting] = useState(false);
  const [ingestFilter, setIngestFilter] = useState<'web' | 'github'>('web');

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sources checklist
  const [sources, setSources] = useState(() => 
    subject.resources.map(res => ({
      id: res.id,
      name: res.name,
      chunks: Math.ceil(res.lines / 20),
      selected: true
    }))
  );

  // Sync when subject resources change
  useEffect(() => {
    setSources(
      subject.resources.map(res => ({
        id: res.id,
        name: res.name,
        chunks: Math.ceil(res.lines / 20),
        selected: true
      }))
    );
  }, [subject]);

  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: `Welcome to the Source Notebook for ${subject.name}! I have compiled **${subject.resources.length} resource files** from your current subject layers. Choose your files in the left sidebar to scope our context, and trigger slide, audio, or problem-set compilers in the Right Studio.`
    }
  ]);

  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isGenerating, setIsGenerating] = useState<string | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const [notes, setNotes] = useState<string[]>([]);
  const [showNotesForm, setShowNotesForm] = useState(false);
  const [newNoteText, setNewNoteText] = useState('');

  const navigate = useNavigate();
  const setCreationModal = useUIStore(s => s.setCreationModal);
  const workflows = useWorkspaceStore(s => s.workflows);
  const runWorkflow = useWorkspaceStore(s => s.runWorkflow);
  const modelConfigured = useWorkspaceStore(s => s.modelConfigured);

  // Studio: workflows scoped to this subject, plus all global ones.
  // Backend's GET /api/workflows bubbles global + scoped by passing
  // subjectId, but the store is hydrated with the unfiltered list at
  // boot, so we filter client-side to keep the Studio in sync.
  const studioWorkflows = useMemo(() => {
    return workflows.filter(wf =>
      wf.scope === 'global' ||
      (wf.scope === 'subject' && wf.subjectId === subject.id)
    );
  }, [workflows, subject.id]);

  // Generated History — backend-driven, filtered to the current subject.
  const artifactsQuery = useQuery(artifactsQueries.list());
  const subjectArtifacts = useMemo(() => {
    const items = artifactsQuery.data ?? [];
    return items.filter(a => a.subjectId === subject.id);
  }, [artifactsQuery.data, subject.id]);

  // Subjects that have a non-empty chapter list — required for + New
  // Topic to know which chapter to drop the new topic into.
  const firstChapterId = subject.chapters[0]?.id;

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const toggleSource = (id: string) => {
    setSources(prev => prev.map(s => s.id === id ? {...s, selected: !s.selected} : s));
  };

  const handleSelectAll = () => {
    const allSelected = sources.every(s => s.selected);
    setSources(prev => prev.map(s => ({...s, selected: !allSelected})));
  };

  const handleSend = () => {
    if (!input.trim()) return;
    
    const userMsg: Message = {id: Date.now().toString(), role: 'user', content: input.trim()};
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    setTimeout(() => {
      const aiMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `I've analyzed your custom prompt with our selected reference sources. What other study overview or C-Space coordinate transform explanation should we extract?`
      };
      setMessages(prev => [...prev, aiMsg]);
      setIsTyping(false);
    }, 1200);
  };

  const runStudioWorkflow = async (wf: WorkflowTemplate) => {
    setIsGenerating(wf.id);
    setRunError(null);
    try {
      const artifact = await runWorkflow(wf, {
        domainId: domain.id,
        subjectId: subject.id,
        subjectName: subject.name,
        chapterId: firstChapterId,
        chapterName: subject.chapters[0]?.name,
      });
      // Refresh the artifacts query so the Generated History
      // updates without a manual reload.
      await artifactsQuery.refetch();
      // Append a chat completion so the user sees the run was
      // acknowledged, even if they don't scroll to the right panel.
      setMessages(prev => [
        ...prev,
        {
          id: `${artifact?.id ?? Date.now()}-ai`,
          role: 'assistant',
          content: `⚡ **${wf.name}** finished — generated **${wf.targetType}** for *${subject.name}*. ${
            artifact?.payload && typeof artifact.payload === 'object' && 'problems' in artifact.payload
              ? `(${Object.keys((artifact.payload as Record<string, unknown>).problems as object).length} problems)`
              : ''
          }`,
        },
      ]);
    } catch (err) {
      setRunError(err instanceof Error ? err.message : 'Workflow run failed.');
    } finally {
      setIsGenerating(null);
    }
  };

  const handleAddNote = () => {
    if (newNoteText.trim()) {
      setNotes(prev => [newNoteText.trim(), ...prev]);
      setNewNoteText('');
      setShowNotesForm(false);
    }
  };

  // Local file upload handling
  const handleLocalFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    setIsIngesting(true);
    setTimeout(() => {
      Array.from(files).forEach(file => {
        const name = file.name;
        const fileType = name.split('.').pop()?.toUpperCase() || 'TXT';
        const lines = 120 + Math.floor(Math.random() * 200);
        onAddResource?.(domain.id, subject.id, name, fileType, lines);
      });
      
      setMessages(prev => [
        ...prev,
        {
          id: `file-${Date.now()}`,
          role: 'assistant',
          content: `📥 **Local Files Ingested Successfully!**\n\nI have successfully indexed and loaded **${files.length} custom files** into your study layers. The ingested chunks are active and scoped for study in Left Sources.`
        }
      ]);
      
      setIsIngesting(false);
      setShowAddSources(false);
    }, 1000);
  };

  // GitHub / Webpage Ingestion submissions
  const handleIngestSubmit = () => {
    if (ingestType === 'github' && ingestUrl.trim()) {
      setIsIngesting(true);
      setTimeout(() => {
        const repoName = ingestUrl.split('/').pop() || 'repository';
        onAddResource?.(domain.id, subject.id, `${repoName}-README.md`, 'MD', 160);
        onAddResource?.(domain.id, subject.id, `${repoName}-architecture.md`, 'MD', 240);
        
        setMessages(prev => [
          ...prev,
          {
            id: `git-${Date.now()}`,
            role: 'assistant',
            content: `🐙 **GitHub Repository Ingested!**\n\nSynched repository **${ingestUrl}** and compiled structural references:\n\n- **${repoName}-README.md** (160 lines MD)\n- **${repoName}-architecture.md** (240 lines MD)\n\nYou can select these repository elements in Left Sources to include in your AI syntheses.`
          }
        ]);
        
        setIsIngesting(false);
        setShowAddSources(false);
        setIngestUrl('');
      }, 1500);
    } else if (ingestType === 'web' && ingestUrl.trim()) {
      setIsIngesting(true);
      setTimeout(() => {
        const domainLabel = ingestUrl.replace('https://', '').replace('http://', '').split('/')[0] || 'Webpage';
        onAddResource?.(domain.id, subject.id, `${domainLabel} Course Reference`, 'HTML', 180);
        
        setMessages(prev => [
          ...prev,
          {
            id: `web-${Date.now()}`,
            role: 'assistant',
            content: `🌐 **Website Reference Ingested!**\n\nSuccessfully fetched textbook contents from webpage **${ingestUrl}**:\n\n- **${domainLabel} Course Reference** (180 lines HTML)\n\nThe active text context has been integrated into your subject layers.`
          }
        ]);
        
        setIsIngesting(false);
        setShowAddSources(false);
        setIngestUrl('');
      }, 1200);
    } else if (ingestType === 'text' && ingestText.trim()) {
      setIsIngesting(true);
      setTimeout(() => {
        const name = ingestName.trim() || `Copied Text Context ${sources.length + 1}`;
        onAddResource?.(domain.id, subject.id, name, 'TXT', Math.ceil(ingestText.split('\n').length));
        
        setMessages(prev => [
          ...prev,
          {
            id: `text-${Date.now()}`,
            role: 'assistant',
            content: `✍️ **Arbitrary Textbook Context Ingested!**\n\nYour clipboard copy context has been saved:\n\n- **${name}** (${Math.ceil(ingestText.split('\n').length)} lines TXT)\n\nThis note is now active in Left Sources.`
          }
        ]);
        
        setIsIngesting(false);
        setShowAddSources(false);
        setIngestText('');
        setIngestName('');
      }, 1000);
    }
  };

  const handleDriveConnectMock = () => {
    setIsIngesting(true);
    setTimeout(() => {
      onAddResource?.(domain.id, subject.id, `Lecture_Slides_Week3.pdf`, 'PDF', 320);
      onAddResource?.(domain.id, subject.id, `Midterm_Exam_Review.md`, 'MD', 190);
      
      setMessages(prev => [
        ...prev,
        {
          id: `drive-${Date.now()}`,
          role: 'assistant',
          content: `📂 **Google Drive Connected!**\n\nImported slide decks and review packages from your synched folders:\n\n- **Lecture_Slides_Week3.pdf** (320 lines PDF)\n- **Midterm_Exam_Review.md** (190 lines MD)`
        }
      ]);
      
      setIsIngesting(false);
      setShowAddSources(false);
    }, 1200);
  };

  const totalChunks = useMemo(() => sources.filter(s => s.selected).reduce((acc, s) => acc + s.chunks, 0), [sources]);
  const allChecked = useMemo(() => sources.length > 0 && sources.every(s => s.selected), [sources]);

  return (
    <div className="flex w-full h-full bg-ws-bg p-3 gap-3 overflow-hidden relative">
      
      {/* 1. Left Column: Sources */}
      <div className={`border border-ws-edge-soft rounded-[12px] bg-ws-bench flex flex-col transition-[width] duration-200 ease-emil-out overflow-hidden h-full shrink-0 ${sourcesCollapsed ? 'w-[50px]' : 'w-[280px]'}`}>
        <div className="px-3.5 py-4 border-b border-ws-edge-soft flex items-center justify-between shrink-0">
          {!sourcesCollapsed && (
            <div className="flex flex-col gap-0.5">
              <span className="text-[13px] font-bold text-ws-ink">Sources</span>
              <span className="text-[10px] text-ws-muted">{sources.length} total sources loaded</span>
            </div>
          )}
          <button
            type="button"
            onClick={() => setSourcesCollapsed(!sourcesCollapsed)}
            className="press bg-transparent border-none text-ws-muted cursor-pointer p-1.5 rounded hover:bg-ws-surface-2 transition-colors"
            title={sourcesCollapsed ? "Expand Sources" : "Collapse Sources"}
          >
            <Columns size={14} />
          </button>
        </div>

        {!sourcesCollapsed && (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Search web inputs */}
            <div className="p-3 flex flex-col gap-2 border-b border-ws-edge-soft shrink-0">
              <button
                type="button"
                onClick={() => setShowAddSources(true)}
                className="press w-full px-3 py-2 bg-ws-bg border border-dashed border-ws-edge rounded-ws-md text-ws-accent font-bold text-[11px] flex items-center gap-1.5 justify-center cursor-pointer transition-colors duration-150 h-bd-accent h-accent-tint"
              >
                <Plus size={12} /> Add sources
              </button>

              <div className="flex gap-1 items-center pl-1">
                <Globe size={11} className="text-ws-muted" />
                <span className="text-[10px] text-ws-muted">Search the web for new sources</span>
              </div>
            </div>

            {/* Selector list header */}
            <div className="px-3 py-2 flex justify-between items-center border-b border-ws-edge-soft shrink-0">
              <span className="text-[11px] text-ws-muted">{totalChunks} chunks active</span>
              <button
                type="button"
                onClick={handleSelectAll}
                className="press bg-transparent border-none text-ws-accent text-[10px] font-bold cursor-pointer flex items-center gap-1 hover:opacity-80 transition-opacity"
              >
                <Check size={11} /> {allChecked ? 'Deselect all' : 'Select all'}
              </button>
            </div>

            {/* Checklist: Scrollable internally */}
            <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-1 scrollbar">
              {sources.map(s => (
                <div
                  key={s.id}
                  onClick={() => toggleSource(s.id)}
                  className={`press flex items-start gap-2 p-2 rounded-ws-md cursor-pointer border transition-colors duration-150 ${
                    s.selected ? 'bg-ws-surface-2 border-ws-line' : 'bg-transparent border-transparent hover:bg-ws-surface-2'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={s.selected}
                    onChange={() => {}}
                    className="accent-ws-glow mt-0.5 cursor-pointer w-[13px] h-[13px]"
                  />
                  <div className="min-w-0 flex-1">
                    <div className={`text-[11px] truncate ${s.selected ? 'font-semibold text-ws-ink' : 'font-normal text-ws-soft'}`}>
                      {s.name}
                    </div>
                    <div className="text-[9px] text-ws-muted mt-0.5">{s.chunks} chunks loaded</div>
                  </div>
                </div>
              ))}
              {sources.length === 0 && (
                <div className="p-6 text-center text-ws-muted text-[11px] italic">
                  No reference files linked to subject.
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 2. Middle Column: Analysis Chat */}
      <div className="flex-1 flex flex-col overflow-hidden bg-ws-bench border border-ws-edge-soft rounded-[12px] h-full">
        <div className="px-6 py-4 border-b border-ws-edge-soft flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => onNavigate({level: 'subject', domainId: domain.id, subjectId: subject.id})}
            className="press bg-transparent border-none text-ws-muted flex cursor-pointer p-1.5 rounded hover:bg-ws-surface-2 transition-colors"
            title="Back to subject"
          >
            <ArrowLeft size={16} />
          </button>
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-bold text-ws-ink m-0">{subject.name} Notebook</h2>
            <div className="text-[10px] text-ws-muted mt-px">{sources.filter(s => s.selected).length} sources selected</div>
          </div>
          <button
            type="button"
            onClick={() => setCreationModal({ open: true, type: 'chapter', domainId: domain.id, subjectId: subject.id })}
            className="press shrink-0 bg-transparent border border-ws-edge-soft text-ws-soft cursor-pointer px-2 py-1 rounded-ws-sm text-[10px] font-semibold flex items-center gap-1 hover:bg-ws-surface-2 transition-colors"
            title="Add chapter to this subject"
          >
            <Plus size={11} />
            Chapter
          </button>
          <button
            type="button"
            disabled={!firstChapterId}
            onClick={() => firstChapterId && setCreationModal({
              open: true,
              type: 'topic',
              domainId: domain.id,
              subjectId: subject.id,
              chapterId: firstChapterId,
            })}
            className={`press shrink-0 bg-transparent border border-ws-edge-soft text-ws-soft cursor-pointer px-2 py-1 rounded-ws-sm text-[10px] font-semibold flex items-center gap-1 hover:bg-ws-surface-2 transition-colors ${
              !firstChapterId ? 'opacity-40 cursor-not-allowed hover:bg-transparent' : ''
            }`}
            title={firstChapterId ? `Add topic to ${subject.chapters[0].name}` : 'Create a chapter first'}
          >
            <Plus size={11} />
            Topic
          </button>
        </div>

        {/* Dynamic Chat log: Scrollable internally */}
        <div className="flex-1 overflow-y-auto px-6 py-5 scrollbar">
          {/* Avatar Robot Header Card */}
          <div className="flex flex-col items-center text-center bg-ws-bg border border-ws-edge-soft rounded-ws-lg p-6 mb-7">
            <div className="w-12 h-12 rounded-full bg-ws-surface-2 border border-ws-edge-soft flex items-center justify-center mb-3">
              <Sparkles size={22} className="text-ws-soft" />
            </div>
            
            <h1 className="text-lg font-extrabold text-ws-ink m-0 mb-1 tracking-tight">
              {subject.name} Admissions & Study Roadmap
            </h1>
            <p className="text-xs text-ws-muted m-0">
              {sources.length} sources · Ingested context available for compilation
            </p>

            <div className="mt-3 px-3 py-1 bg-ws-surface-2 border border-ws-edge rounded-ws-md text-[10px] text-ws-soft">
              💡 Add a cover image and custom note to personalize your notebook!
            </div>
          </div>

          {/* Chat Messages */}
          <div className="flex flex-col gap-4">
            {messages.map(m => (
              <div key={m.id} className={`flex gap-3 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {m.role === 'assistant' && (
                  <div className="w-7 h-7 rounded-full bg-ws-surface-2 border border-ws-edge flex items-center justify-center shrink-0">
                    <Sparkles size={13} className="text-ws-glow" />
                  </div>
                )}
                <div
                  className={`max-w-[80%] px-3.5 py-3 rounded-ws-md text-xs leading-[1.5] whitespace-pre-line ${
                    m.role === 'assistant'
                      ? 'bg-ws-bg border border-ws-edge-soft text-ws-ink'
                      : 'bg-ws-accent border-none text-ws-bg'
                  }`}
                >
                  {m.content}
                </div>
              </div>
            ))}
            {isTyping && (
              <div className="flex gap-3">
                <div className="w-7 h-7 rounded-full bg-ws-surface-2 border border-ws-edge flex items-center justify-center shrink-0">
                  <Sparkles size={13} className="text-ws-glow animate-pulse" />
                </div>
                <div className="bg-ws-bg border border-ws-edge-soft rounded-ws-md p-3 text-xs text-ws-muted italic">
                  Synthesizing selected chunks...
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Large Chat Input Prompt bar */}
        <div className="p-4 border-t border-ws-edge-soft shrink-0">
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Ask a question or create something..."
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleSend(); }}
              className="flex-1 px-4 py-3 bg-ws-bg border border-ws-edge rounded-ws-lg text-ws-ink text-xs outline-none"
            />
            <div className="shrink-0 text-[10px] text-ws-muted select-none">
              {sources.filter(s => s.selected).length} sources
            </div>
            <button
              type="button"
              onClick={handleSend}
              disabled={!input.trim()}
              className={`press shrink-0 w-7 h-7 rounded-full border-none flex items-center justify-center transition-colors duration-100 ${
                input.trim() ? 'bg-ws-accent text-ws-bg cursor-pointer' : 'bg-ws-surface-2 text-ws-muted cursor-not-allowed'
              }`}
            >
              <Send size={12} />
            </button>
          </div>
        </div>
      </div>

      {/* 3. Right Column: Studio action dashboard */}
      <div className={`border border-ws-edge-soft rounded-[12px] bg-ws-bench flex flex-col transition-[width] duration-200 ease-emil-out overflow-hidden h-full shrink-0 ${studioCollapsed ? 'w-[50px]' : 'w-[340px]'}`}>
        <div className="px-3.5 py-4 border-b border-ws-edge-soft flex items-center justify-between shrink-0">
          {!studioCollapsed && (
            <span className="text-[13px] font-bold text-ws-ink">Notebook Studio</span>
          )}
          <button
            type="button"
            onClick={() => setStudioCollapsed(!studioCollapsed)}
            className="press bg-transparent border-none text-ws-muted cursor-pointer p-1.5 rounded hover:bg-ws-surface-2 transition-colors"
            title={studioCollapsed ? "Expand Studio" : "Collapse Studio"}
          >
            <Columns size={14} />
          </button>
        </div>

        {!studioCollapsed && (
          <div className="flex-1 flex flex-col overflow-hidden">

            {/* Workflows header */}
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

            {/* Workflows list — scrollable, click body to run, gear to edit */}
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
                      onClick={() => !running && runStudioWorkflow(wf)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          runStudioWorkflow(wf);
                        }
                      }}
                      title="Run workflow"
                      className={`fade-in group flex items-start gap-2 px-2.5 py-2 border border-ws-edge-soft rounded-ws-md bg-ws-bg cursor-pointer transition-colors duration-150 hover:border-ws-accent/50 ${
                        running ? 'opacity-60 pointer-events-none' : ''
                      }`}
                    >
                      <div className="w-6 h-6 shrink-0 rounded-ws-sm bg-ws-surface-2 border border-ws-edge-soft flex items-center justify-center text-ws-accent">
                        {running ? <RefreshCw size={12} className="animate-spin" /> : <Play size={11} />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-[11px] font-bold text-ws-ink truncate">
                          {wf.name}
                        </div>
                        <div className="text-[9px] text-ws-muted mt-0.5 truncate">
                          {wf.targetType} · {wf.evalGates} gate{wf.evalGates === 1 ? '' : 's'}
                          {wf.scope !== 'global' && ` · ${wf.scope}`}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate({ to: '/workflow-editor', search: { id: wf.id } });
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

            {/* Run error banner — alert + Retry */}
            {runError && (
              <div className="mx-4 mb-3 bg-red-500/10 border border-ws-danger rounded-ws-md p-2.5 flex flex-col gap-2">
                <div className="flex items-start gap-2">
                  <AlertCircle size={12} className="text-red-500 shrink-0 mt-px" />
                  <span className="text-[10px] text-red-500 leading-[1.4] flex-1">{runError}</span>
                </div>
                <div className="flex gap-1.5 justify-end">
                  <button
                    type="button"
                    onClick={() => setRunError(null)}
                    className="press bg-transparent border-none text-ws-muted text-[10px] font-bold cursor-pointer px-2 py-1 rounded"
                  >
                    Dismiss
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setRunError(null);
                      // Retry the last attempted workflow if we can
                      // recover it from the still-loading state.
                      const last = studioWorkflows.find(w => w.id === isGenerating);
                      if (last) runStudioWorkflow(last);
                    }}
                    className="press bg-red-500/20 border border-red-500/40 text-red-500 text-[10px] font-bold cursor-pointer px-2 py-1 rounded flex items-center gap-1"
                  >
                    <RefreshCw size={9} />
                    Retry
                  </button>
                </div>
              </div>
            )}

            {/* Generated History — backend-driven, filtered to this subject */}
            <div className="flex-1 flex flex-col min-h-0 border-t border-ws-edge-soft">
              <div className="px-4 pt-3 pb-2 flex items-center justify-between">
                <div className="text-[10px] font-bold text-ws-muted uppercase tracking-wider">
                  Generated History
                </div>
                {artifactsQuery.isFetching && (
                  <RefreshCw size={10} className="text-ws-muted animate-spin" />
                )}
              </div>
              <div className="flex-1 overflow-y-auto px-4 pb-4 scrollbar flex flex-col gap-1.5">
                {artifactsQuery.isError ? (
                  <div className="px-3 py-3 text-[10px] text-red-500 border border-dashed border-ws-danger rounded-ws-md">
                    Failed to load history.
                  </div>
                ) : artifactsQuery.isLoading ? (
                  <div className="px-3 py-3 text-[10px] text-ws-muted italic">
                    Loading…
                  </div>
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
                        <div className="text-[9px] text-ws-muted mt-0.5">{art.time} · {art.type}</div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Notes list */}
            {notes.length > 0 && (
              <div>
                <div className="text-[10px] font-bold text-ws-muted uppercase tracking-wider mb-2.5">
                  Personal Notes
                </div>
                <div className="flex flex-col gap-1.5">
                  {notes.map((note, index) => (
                    <div key={index} className="p-2.5 border border-ws-edge-soft rounded-ws-md bg-ws-bg text-[11px] text-ws-soft leading-[1.4]">
                      {note}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Floating Notes button */}
            <div className="mt-auto pt-3">
              {showNotesForm ? (
                <div className="bg-ws-bg border border-ws-edge rounded-ws-md p-2 flex flex-col gap-2 mb-2">
                  <textarea
                    value={newNoteText}
                    onChange={e => setNewNoteText(e.target.value)}
                    placeholder="Type note text..."
                    className="w-full min-h-[60px] p-1.5 bg-ws-bg border border-ws-edge-soft rounded-ws-sm text-ws-ink text-[11px] outline-none resize-y"
                    autoFocus
                  />
                  <div className="flex gap-1 justify-end">
                    <button type="button" onClick={handleAddNote} className="press px-2 py-[3px] bg-ws-accent text-ws-bg border-none rounded-[3px] text-[10px] font-bold cursor-pointer">
                      Add
                    </button>
                    <button type="button" onClick={() => setShowNotesForm(false)} className="press px-2 py-[3px] bg-transparent border border-ws-edge-soft text-ws-soft rounded-[3px] text-[10px] cursor-pointer">
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowNotesForm(true)}
                  className="press w-full px-3 py-2 bg-ws-accent border-none rounded-ws-md text-ws-bg font-bold text-[11px] flex items-center gap-1.5 justify-center cursor-pointer"
                >
                  <StickyNote size={12} /> Add note
                </button>
              )}
            </div>

          </div>
        )}
      </div>

      {/* Center aligned subtle Ingestion Overlay Modal */}
      {showAddSources && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center fade-in"
          onClick={() => setShowAddSources(false)}
        >
          <div
            className="scale-in bg-ws-bg border border-ws-edge rounded-2xl w-full max-w-[560px] shadow-[0_25px_50px_-12px_rgba(0,0,0,0.6)] overflow-hidden text-ws-ink flex flex-col m-4 relative"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-6 pt-5 pb-4 border-b border-ws-edge-soft flex items-start justify-between">
              <div>
                <h2 className="text-base font-bold text-ws-ink m-0 mb-1">Add sources to Subject</h2>
                <p className="text-[11px] text-ws-muted m-0">Ingest PDFs, websites, GitHub repositories, or copied text directly to subject context.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddSources(false)}
                className="press bg-transparent border-none text-ws-muted cursor-pointer flex p-1.5 rounded hover:bg-ws-surface-2 transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* Content Tabs / Forms */}
            <div className="p-6 flex flex-col gap-5">
              
              {/* Type Select Row */}
              <div className="flex gap-1.5 flex-wrap">
                {[
                  { id: 'upload', label: 'Upload Files', icon: Upload },
                  { id: 'github', label: 'GitHub Repo', icon: GithubIcon },
                  { id: 'web', label: 'Websites', icon: Globe },
                  { id: 'drive', label: 'Google Drive', icon: Cloud },
                  { id: 'text', label: 'Copied Text', icon: Clipboard }
                ].map(tab => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => {
                      setIngestType(tab.id as any);
                      setIngestUrl('');
                      setIngestText('');
                      setIngestName('');
                    }}
                    className={`press flex items-center gap-1.5 px-3 py-2 border rounded-ws-lg text-[11px] font-semibold cursor-pointer transition-all duration-[120ms] ease-emil-out ${
                      ingestType === tab.id
                        ? 'bg-ws-accent/10 border-ws-accent text-ws-accent'
                        : 'bg-ws-bg border-ws-line text-ws-soft h-bd-muted'
                    }`}
                  >
                    <tab.icon size={12} />
                    <span>{tab.label}</span>
                  </button>
                ))}
              </div>

              {/* Dynamic Ingest Form Panels */}
              {ingestType === 'upload' && (
                <div className="flex flex-col gap-3">
                  <div
                    className="press border-2 border-dashed border-ws-edge rounded-[12px] px-4 py-8 text-center bg-ws-bg flex flex-col items-center justify-center gap-2.5 cursor-pointer transition-colors duration-150 h-bd-accent"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload size={28} className="text-ws-accent" />
                    <div>
                      <div className="text-xs font-bold text-ws-ink">or drop your files here</div>
                      <div className="text-[10px] text-ws-muted mt-1">PDF, MD, Markdown, or TXT up to 10MB</div>
                    </div>
                    <button
                      type="button"
                      className="press px-3.5 py-1.5 bg-ws-accent text-ws-bg border-none rounded-ws-md text-[11px] font-bold cursor-pointer"
                    >
                      Upload files
                    </button>
                    <input
                      type="file"
                      ref={fileInputRef}
                      multiple
                      onChange={handleLocalFileUpload}
                      className="hidden"
                    />
                  </div>
                </div>
              )}

              {ingestType === 'github' && (
                <div className="flex flex-col gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11.5px] font-semibold text-ws-soft">GitHub Repository URL</label>
                    <input
                      type="url"
                      placeholder="e.g., https://github.com/username/project"
                      value={ingestUrl}
                      onChange={e => setIngestUrl(e.target.value)}
                      className="w-full px-3 py-2.5 bg-ws-bg border border-ws-edge rounded-ws-lg text-ws-ink text-xs outline-none"
                    />
                  </div>
                  <div className="text-[10px] text-ws-muted leading-[1.45]">
                    💡 We will parse the repository structure, ingest markdown files (README, docs, architecture guides), and build conceptual references directly inside the notebook.
                  </div>
                </div>
              )}

              {ingestType === 'web' && (
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-2 px-3 py-2 bg-ws-bg border border-ws-edge rounded-ws-lg">
                    <Globe size={13} className="text-ws-muted" />
                    <CustomSelect
                      value={ingestFilter}
                      onChange={val => setIngestFilter(val as any)}
                      options={[
                        { value: 'web', label: 'Web' },
                        { value: 'github', label: 'GitHub' }
                      ]}
                      style={{
                        background: 'none', border: 'none', color: "var(--ws-muted)",
                        fontSize: 11, fontWeight: 600
                      }}
                    />
                    <span className="w-px h-3.5 bg-ws-surface-2 self-stretch" />
                    <input
                      type="text"
                      placeholder="Search the web for new sources or paste URL..."
                      value={ingestUrl}
                      onChange={e => setIngestUrl(e.target.value)}
                      className="flex-1 bg-transparent border-none text-ws-ink text-xs outline-none"
                    />
                  </div>
                  <div className="text-[10px] text-ws-muted leading-[1.45]">
                    💡 Enter a search query to research concepts via web search summaries, or paste any direct URL page to ingest its full textbook text content.
                  </div>
                </div>
              )}

              {ingestType === 'drive' && (
                <div className="flex flex-col gap-3 items-center py-5">
                  <div className="w-11 h-11 rounded-full bg-ws-surface-2 flex items-center justify-center text-ws-accent mb-2">
                    <Cloud size={20} />
                  </div>
                  <div className="text-[13px] font-bold text-ws-ink text-center">Google Drive Integration</div>
                  <p className="text-[11px] text-ws-muted text-center max-w-[360px] m-0 mb-3 leading-[1.45]">
                    Seamlessly connect your Google Drive account to import study guides, slide decks, papers, or homework sheets.
                  </p>
                  <button
                    type="button"
                    onClick={handleDriveConnectMock}
                    className="press px-4 py-2 bg-ws-accent text-ws-bg border-none rounded-ws-lg text-[11px] font-bold cursor-pointer"
                  >
                    Connect Google Drive
                  </button>
                </div>
              )}

              {ingestType === 'text' && (
                <div className="flex flex-col gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11.5px] font-semibold text-ws-soft">Source Name</label>
                    <input
                      type="text"
                      placeholder="Name this study note (e.g. Lecture 4 derivation notes)"
                      value={ingestName}
                      onChange={e => setIngestName(e.target.value)}
                      className="w-full px-3 py-2.5 bg-ws-bg border border-ws-edge rounded-ws-lg text-ws-ink text-xs outline-none"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11.5px] font-semibold text-ws-soft">Copied Text Context</label>
                    <textarea
                      placeholder="Paste your copied textbook text, definitions, formulas, or homework descriptions..."
                      value={ingestText}
                      onChange={e => setIngestText(e.target.value)}
                      className="w-full min-h-[90px] px-3 py-2.5 bg-ws-bg border border-ws-edge rounded-ws-lg text-ws-ink text-xs outline-none resize-y font-[inherit]"
                    />
                  </div>
                </div>
              )}

              {/* Progress bar at the bottom */}
              <div className="border-t border-ws-edge-soft pt-4 flex flex-col gap-1.5">
                <div className="flex justify-between text-[10.5px] text-ws-muted">
                  <span>Reference Source Capacity</span>
                  <span>{sources.length} / 100 loaded</span>
                </div>
                <div className="w-full h-1.5 bg-ws-bg rounded-[3px] overflow-hidden">
                  <div style={{ width: `${Math.min(sources.length, 100)}%` }} className="h-full bg-ws-accent rounded-[3px]" />
                </div>
              </div>

            </div>

            {/* Footer */}
            <div className="px-6 py-3 bg-ws-surface-2 border-t border-ws-edge-soft flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setShowAddSources(false)}
                className="press px-3.5 py-2 bg-transparent border border-ws-edge-soft text-ws-soft rounded-ws-lg cursor-pointer text-[11.5px] font-semibold"
              >
                Cancel
              </button>
              
              {ingestType !== 'upload' && ingestType !== 'drive' && (
                <button
                  type="button"
                  onClick={handleIngestSubmit}
                  disabled={isIngesting || (!ingestUrl.trim() && !ingestText.trim())}
                  className={`px-4 py-2 border-none rounded-ws-lg text-[11.5px] font-bold flex items-center gap-1.5 transition-colors duration-150 ${
                    isIngesting ? 'bg-ws-surface-2 text-ws-muted' : 'bg-ws-accent text-ws-bg'
                  } ${(isIngesting || (!ingestUrl.trim() && !ingestText.trim())) ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  {isIngesting ? 'Ingesting...' : 'Ingest Source'}
                </button>
              )}
            </div>

          </div>
        </div>
      )}

    </div>
  );
}

export default SourceNotebookScreen;
