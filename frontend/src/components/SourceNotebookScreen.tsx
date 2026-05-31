import {Sparkles, Send, FileOutput, ArrowLeft, Plus, Headphones, Presentation, Video, Network, TrendingUp, CreditCard, HelpCircle, BarChart4, Table, StickyNote, Globe, Check, Columns, X, Upload, Clipboard, Cloud} from 'lucide-react';
import {useState, useRef, useEffect, useMemo} from 'react';
import type {Domain, Subject, Artifact, NavLocation} from '../workspaceTypes';
import { CustomSelect } from './ui/CustomSelect';
import { useWorkspaceStore } from '../stores/workspaceStore';

const GithubIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }} {...props}>
    <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
  </svg>
);

type Message = { id: string; role: 'user' | 'assistant'; content: string };

type Props = {
  domain: Domain;
  subject: Subject;
  onNavigate: (loc: NavLocation) => void;
  onAddTopic: (domainId: string, subjectId: string, chapterId: string, topicName: string) => void;
  onAddArtifact: (art: Omit<Artifact, 'id' | 'time'>) => void;
  onAddResource?: (domainId: string, subjectId: string, name: string, fileType: string, linesCount: number) => void;
};

function SourceNotebookScreen({domain, subject, onNavigate, onAddTopic, onAddArtifact, onAddResource}: Props) {
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
  const globalArtifacts = useWorkspaceStore(s => s.artifacts);
  const artifacts = useMemo(() => {
    const list = globalArtifacts.filter(art => art.domainId === domain.id && art.subjectId === subject.id);
    const hasWorkbook = list.some(art => art.type === 'Workbook');
    if (!hasWorkbook) {
      return [
        {
          id: 'art-init',
          name: `Initial ${subject.name} Workbook`,
          type: 'Workbook',
          status: 'approved' as const,
          domainId: domain.id,
          subjectId: subject.id,
          time: '2 hours ago'
        },
        ...list
      ];
    }
    return list;
  }, [globalArtifacts, domain.id, subject.id, subject.name]);
  const [isGenerating, setIsGenerating] = useState<string | null>(null);
  const [alertMsg, setAlertMsg] = useState<string | null>(null);
  const [notes, setNotes] = useState<string[]>([]);
  const [showNotesForm, setShowNotesForm] = useState(false);
  const [newNoteText, setNewNoteText] = useState('');

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

  const triggerStudioWorkflow = (wfName: string, targetType: string) => {
    setIsGenerating(wfName);
    setAlertMsg(null);
    const selectedCount = sources.filter(s => s.selected).length;

    if (selectedCount === 0) {
      setTimeout(() => {
        setAlertMsg(`Generation failed. Please select at least one reference source in the left column first.`);
        setIsGenerating(null);
      }, 1000);
      return;
    }

    setTimeout(() => {
      const uniqueId = Date.now().toString();
      const topicName = `${wfName} Concept Extraction`;
      const chapterId = subject.chapters[0]?.id || 'ch-gen';

      // 1. Add topic
      onAddTopic(domain.id, subject.id, chapterId, topicName);

      // 2. Add workspace artifact
      onAddArtifact({
        name: `Generated ${targetType} for ${subject.name}`,
        type: targetType,
        status: 'draft',
        domainId: domain.id,
        subjectId: subject.id,
        chapterId: chapterId,
        topicId: uniqueId
      });



      // 4. Append chat completion
      setMessages(prev => [
        ...prev,
        {
          id: uniqueId + '-ai',
          role: 'assistant',
          content: `⚡ **Notebook Studio Workflow Triggered!**\n\nI have successfully executed the **${wfName}** workspace loop over **${selectedCount} files**.\n\n- **Generated Topic**: "${topicName}" added under your first chapter.\n- **New Artifact**: A premium draft **${targetType}** study reference is now persistently stored.`
        }
      ]);

      setIsGenerating(null);
    }, 1800);
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
    <div className="flex w-full h-full bg-ws-floor overflow-hidden p-4 gap-4 text-ws-ink relative">
      
      {/* 1. Left Column: Sources panel */}
      <div 
        className="bg-ws-bench border border-ws-line rounded-xl shadow-md flex flex-col overflow-hidden shrink-0 transition-[width] duration-200"
        style={{ width: sourcesCollapsed ? 50 : 280 }}
      >
        <div className="p-4 border-b border-ws-line flex items-center justify-between shrink-0 bg-ws-bench/50 h-11">
          {!sourcesCollapsed && (
            <div className="flex flex-col gap-0.5">
              <span className="text-[13px] font-extrabold text-ws-ink tracking-tight">Sources</span>
              <span className="text-[10px] text-ws-muted">{sources.length} total sources loaded</span>
            </div>
          )}
          <button 
            type="button" 
            onClick={() => setSourcesCollapsed(!sourcesCollapsed)}
            className="background-none border-none text-ws-muted hover:text-ws-ink cursor-pointer p-1 rounded"
            title={sourcesCollapsed ? "Expand Sources" : "Collapse Sources"}
          >
            <Columns size={14} />
          </button>
        </div>

        {!sourcesCollapsed && (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Search web inputs */}
            <div className="p-3.5 flex flex-col gap-2 border-b border-ws-line bg-ws-bench/30 shrink-0">
              <button 
                type="button"
                onClick={() => setShowAddSources(true)}
                className="w-full py-2 bg-ws-bg border border-dashed border-ws-line rounded-md text-ws-glow font-bold text-xs flex items-center gap-1.5 justify-center cursor-pointer transition-all hover:border-ws-glow hover:bg-ws-glow/5"
              >
                <Plus size={12} /> Add sources
              </button>

              <div className="flex gap-2 items-center pl-1">
                <Globe size={11} className="text-ws-muted" />
                <span className="text-[10px] text-ws-muted">Search the web for new sources</span>
              </div>
            </div>

            {/* Selector list header */}
            <div className="p-3 border-b border-ws-line flex justify-between items-center bg-ws-bench/20 shrink-0">
              <span className="text-[11px] text-ws-muted font-bold">{totalChunks} chunks active</span>
              <button 
                type="button" 
                onClick={handleSelectAll}
                className="bg-transparent border-none text-ws-glow text-[10px] font-bold cursor-pointer flex items-center gap-1.5 hover:underline"
              >
                <Check size={11} /> {allChecked ? 'Deselect all' : 'Select all'}
              </button>
            </div>

            {/* Checklist: Scrollable internally */}
            <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-1.5 scrollbar">
              {sources.map(s => (
                <div 
                  key={s.id}
                  onClick={() => toggleSource(s.id)}
                  className={`flex items-start gap-2.5 p-2.5 rounded-lg cursor-pointer border transition-all duration-150 ${s.selected ? "bg-ws-bg border-ws-line shadow-sm" : "border-transparent hover:bg-ws-bg/30"}`}
                >
                  <input 
                    type="checkbox" 
                    checked={s.selected}
                    onChange={() => {}}
                    className="accent-ws-glow mt-0.5 cursor-pointer w-3.5 h-3.5" 
                  />
                  <div className="min-w-0 flex-1">
                    <div className={`text-xs ${s.selected ? "text-ws-ink font-bold" : "text-ws-muted"} truncate`}>
                      {s.name}
                    </div>
                    <div className="text-[9px] text-ws-muted mt-0.5">{s.chunks} chunks loaded</div>
                  </div>
                </div>
              ))}
              {sources.length === 0 && (
                <div className="p-6 text-center text-ws-muted text-xs italic">
                  No reference files linked to subject.
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 2. Middle Column: Analysis Chat panel */}
      <div className="flex-1 bg-ws-bench border border-ws-line rounded-xl shadow-md flex flex-col overflow-hidden shrink-0">
        <div className="p-4 border-b border-ws-line flex items-center gap-3 shrink-0 bg-ws-bench/50 h-11">
          <button 
            type="button"
            onClick={() => onNavigate({level: 'subject', domainId: domain.id, subjectId: subject.id})}
            className="bg-transparent border-none text-ws-muted hover:text-ws-ink flex cursor-pointer p-1 rounded"
            title="Back to subject"
          >
            <ArrowLeft size={16} />
          </button>
          <div>
            <h2 className="text-[13px] font-extrabold text-ws-ink m-0 tracking-tight">{subject.name} Notebook</h2>
            <div className="text-[10px] text-ws-muted mt-0.5">{sources.filter(s => s.selected).length} sources selected</div>
          </div>
        </div>

        {/* Dynamic Chat log: Scrollable internally */}
        <div className="flex-1 overflow-y-auto p-6 scrollbar">
          {/* Avatar Robot Header Card */}
          <div className="flex flex-col items-center text-center bg-ws-bg border border-ws-line rounded-xl p-6 mb-6 relative overflow-hidden shadow-sm">
            <div className="w-12 h-12 rounded-full bg-ws-bench border border-ws-line flex items-center justify-center mb-3 shadow-inner">
              <Sparkles size={20} className="text-ws-glow animate-pulse" />
            </div>
            
            <h1 className="text-lg font-extrabold text-ws-ink m-0 mb-1 tracking-tight leading-tight">
              {subject.name} Admissions & Study Roadmap
            </h1>
            <p className="text-xs text-ws-muted m-0">
              {sources.length} sources · Ingested context available for compilation
            </p>

            <div className="mt-3.5 px-3 py-1 bg-ws-bench border border-ws-line rounded-md text-[10px] text-ws-muted font-bold">
              💡 Add a cover image and custom note to personalize your notebook!
            </div>
          </div>

          {/* Chat Messages */}
          <div className="flex flex-col gap-4">
            {messages.map(m => (
              <div key={m.id} className={`flex gap-3 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {m.role === 'assistant' && (
                  <div className="w-7 h-7 rounded-full bg-ws-bench border border-ws-line flex items-center justify-center shrink-0 shadow-sm">
                    <Sparkles size={13} className="text-ws-glow" />
                  </div>
                )}
                <div 
                  className={`max-w-[80%] p-3.5 rounded-lg text-xs leading-relaxed whitespace-pre-line ${m.role === 'assistant' ? "bg-ws-bg border border-ws-line text-ws-ink shadow-sm" : "bg-ws-glow text-ws-floor font-medium shadow-md"}`}
                >
                  {m.content}
                </div>
              </div>
            ))}
            {isTyping && (
              <div className="flex gap-3">
                <div className="w-7 h-7 rounded-full bg-ws-bench border border-ws-line flex items-center justify-center shrink-0 shadow-sm">
                  <Sparkles size={13} className="text-ws-glow animate-pulse" />
                </div>
                <div className="bg-ws-bg border border-ws-line rounded-lg p-3 text-xs text-ws-muted italic shadow-sm">
                  Synthesizing selected chunks...
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Large Chat Input Prompt bar */}
        <div className="p-4 border-t border-ws-line shrink-0 bg-ws-bench/20">
          <div className="relative flex items-center w-full">
            <input 
              type="text"
              placeholder="Ask a question or create something..."
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleSend(); }}
              className="w-full pl-4 pr-24 py-3 bg-ws-bg border border-ws-line rounded-lg text-ws-ink outline-none text-xs focus:border-ws-glow transition-all"
            />
            <div className="absolute right-11 text-[10px] text-ws-muted user-select-none font-bold">
              {sources.filter(s => s.selected).length} sources
            </div>
            <button 
              type="button"
              onClick={handleSend}
              disabled={!input.trim()}
              className={`absolute right-2 w-7 h-7 rounded-full flex items-center justify-center border-none transition-all duration-150 ${input.trim() ? "bg-ws-glow text-ws-floor cursor-pointer shadow-sm" : "bg-ws-bench text-ws-muted cursor-not-allowed"}`}
            >
              <Send size={12} />
            </button>
          </div>
        </div>
      </div>

      {/* 3. Right Column: Studio action panel */}
      <div 
        className="bg-ws-bench border border-ws-line rounded-xl shadow-md flex flex-col overflow-hidden shrink-0 transition-[width] duration-200"
        style={{ width: studioCollapsed ? 50 : 340 }}
      >
        <div className="p-4 border-b border-ws-line flex items-center justify-between shrink-0 bg-ws-bench/50 h-11">
          {!studioCollapsed && (
            <span className="text-[13px] font-extrabold text-ws-ink tracking-tight">Notebook Studio</span>
          )}
          <button 
            type="button" 
            onClick={() => setStudioCollapsed(!studioCollapsed)}
            className="bg-transparent border-none text-ws-muted hover:text-ws-ink cursor-pointer p-1 rounded"
            title={studioCollapsed ? "Expand Studio" : "Collapse Studio"}
          >
            <Columns size={14} />
          </button>
        </div>

        {!studioCollapsed && (
          <div className="flex-1 flex flex-col overflow-y-auto p-4 gap-4 scrollbar">
            
            {/* Create overview wrapper */}
            <div className="bg-ws-bg border border-ws-line rounded-xl p-4 shadow-sm">
              <div className="text-xs font-bold text-ws-ink mb-1 tracking-tight">Compile Audio Overview</div>
              <p className="text-[10px] text-ws-muted leading-relaxed margin-0">
                Create an Audio Overview to synthesize and explain core equations, coordinate derivations, and lessons.
              </p>
            </div>

            {/* Target actions grid */}
            <div className="flex flex-col gap-2.5">
              <div className="text-[10px] font-bold text-ws-muted uppercase tracking-wider px-1">
                Create Overviews & Guides
              </div>
              
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: 'Audio Overview', type: 'Podcast', icon: Headphones },
                  { label: 'Slide Deck', type: 'Presentation', icon: Presentation },
                  { label: 'Video Overview', type: 'Video Summary', icon: Video },
                  { label: 'Mind Map', type: 'Concept Graph', icon: Network },
                  { label: 'Reports', type: 'Summary', icon: TrendingUp },
                  { label: 'Flashcards', type: 'Flashcard deck', icon: CreditCard },
                  { label: 'Quiz', type: 'Quiz', icon: HelpCircle },
                  { label: 'Infographic', type: 'Poster guide', icon: BarChart4 },
                  { label: 'Data Table', type: 'Spreadsheet', icon: Table }
                ].map(action => {
                  const Icon = action.icon;
                  return (
                    <button
                      key={action.label}
                      type="button"
                      onClick={() => triggerStudioWorkflow(action.label, action.type)}
                      disabled={!!isGenerating}
                      className="p-3 bg-ws-bg border border-ws-line rounded-lg flex flex-col gap-2.5 items-flex-start cursor-pointer text-left transition-all hover:border-ws-glow hover:bg-ws-bench shadow-sm"
                    >
                      <div className="w-6 h-6 rounded bg-ws-bench border border-ws-line flex items-center justify-center text-ws-glow shrink-0 shadow-sm">
                        <Icon size={12} />
                      </div>
                      <div>
                        <div className="text-[11px] font-extrabold text-ws-ink leading-tight truncate">{action.label}</div>
                        <div className="text-[9px] text-ws-muted mt-0.5 truncate">{action.type}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Alert boxes */}
            {alertMsg && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 flex items-center justify-between gap-3 shrink-0 shadow-sm">
                <span className="text-[10px] text-red-400 leading-normal">{alertMsg}</span>
                <button type="button" onClick={() => setAlertMsg(null)} className="bg-transparent border-none text-red-400 text-[10px] font-bold cursor-pointer hover:underline">
                  Dismiss
                </button>
              </div>
            )}

            {/* Recents generated */}
            <div className="flex flex-col gap-2.5">
              <div className="text-[10px] font-bold text-ws-muted uppercase tracking-wider px-1">
                Generated History
              </div>
              <div className="flex flex-col gap-2">
                {artifacts.map(art => (
                  <div key={art.id} className="p-3 border border-ws-line rounded-lg bg-ws-bg flex items-center gap-3 transition-colors hover:border-ws-glow/50 shadow-sm">
                    <FileOutput size={13} className="text-ws-glow shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold text-ws-ink truncate">
                        {art.name}
                      </div>
                      <div className="text-[9px] text-ws-muted mt-0.5">{art.time} · {art.type}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Notes list */}
            {notes.length > 0 && (
              <div className="flex flex-col gap-2.5">
                <div className="text-[10px] font-bold text-ws-muted uppercase tracking-wider px-1">
                  Personal Notes
                </div>
                <div className="flex flex-col gap-2">
                  {notes.map((note, index) => (
                    <div key={index} className="p-3 border border-ws-line rounded-lg bg-ws-bg text-xs text-ws-ink leading-relaxed shadow-sm">
                      {note}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Floating Notes button */}
            <div className="mt-auto pt-3">
              {showNotesForm ? (
                <div className="bg-ws-bg border border-ws-line rounded-lg p-2.5 flex flex-col gap-2.5 shadow-sm">
                  <textarea 
                    value={newNoteText}
                    onChange={e => setNewNoteText(e.target.value)}
                    placeholder="Type note text..."
                    className="w-full min-h-[60px] p-2 bg-ws-bg border border-ws-line rounded text-xs text-ws-ink outline-none resize-y"
                    autoFocus
                  />
                  <div className="flex gap-1.5 justify-end">
                    <button type="button" onClick={handleAddNote} className="px-2.5 py-1 bg-ws-glow text-ws-floor font-bold border-none rounded text-[10px] cursor-pointer shadow-sm">
                      Add
                    </button>
                    <button type="button" onClick={() => setShowNotesForm(false)} className="px-2.5 py-1 bg-transparent border border-ws-line text-ws-muted rounded text-[10px] cursor-pointer">
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button 
                  type="button"
                  onClick={() => setShowNotesForm(true)}
                  className="w-full py-2 bg-ws-glow border-none rounded-md text-ws-floor font-bold text-xs flex items-center gap-1.5 justify-center cursor-pointer shadow-md transition-all hover:brightness-110"
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
          className="absolute inset-0 bg-black/60 z-[9999] flex items-center justify-center p-4"
          onClick={() => setShowAddSources(false)}
        >
          <div 
            style={{
              background: "var(--ws-bg)", 
              border: '1px solid var(--ws-edge)',
              borderRadius: 16, 
              width: '100%', 
              maxWidth: '560px',
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.6)', 
              overflow: 'hidden',
              color: "var(--ws-ink)", 
              display: 'flex', 
              flexDirection: 'column',
              margin: 16, 
              position: 'relative'
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{padding: '20px 24px 16px', borderBottom: '1px solid var(--ws-edge-soft)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between'}}>
              <div>
                <h2 style={{fontSize: 16, fontWeight: 700, color: "var(--ws-ink)", margin: '0 0 4px'}}>Add sources to Subject</h2>
                <p style={{fontSize: 11, color: "var(--ws-muted)", margin: 0}}>Ingest PDFs, websites, GitHub repositories, or copied text directly to subject context.</p>
              </div>
              <button 
                type="button" 
                onClick={() => setShowAddSources(false)}
                style={{background: 'none', border: 'none', color: "var(--ws-muted)", cursor: 'pointer', display: 'flex', padding: 4}}
              >
                <X size={16} />
              </button>
            </div>

            {/* Content Tabs / Forms */}
            <div style={{padding: 24, display: 'flex', flexDirection: 'column', gap: 20}}>
              
              {/* Type Select Row */}
              <div style={{display: 'flex', gap: 6, flexWrap: 'wrap'}}>
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
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px',
                      background: ingestType === tab.id ? "rgba(16,185,129,0.1)" : "var(--ws-bg)",
                      border: '1px solid',
                      borderColor: ingestType === tab.id ? "var(--ws-accent)" : "var(--ws-line)",
                      borderRadius: 8, color: ingestType === tab.id ? "var(--ws-accent)" : "var(--ws-soft)",
                      fontSize: 11, fontWeight: 600, cursor: 'pointer', transition: 'all 120ms ease'
                    }}
                    onMouseEnter={e => { if (ingestType !== tab.id) e.currentTarget.style.borderColor = "var(--ws-muted)"; }}
                    onMouseLeave={e => { if (ingestType !== tab.id) e.currentTarget.style.borderColor = "var(--ws-line)"; }}
                  >
                    <tab.icon size={12} />
                    <span>{tab.label}</span>
                  </button>
                ))}
              </div>

              {/* Dynamic Ingest Form Panels */}
              {ingestType === 'upload' && (
                <div style={{display: 'flex', flexDirection: 'column', gap: 12}}>
                  <div 
                    style={{
                      border: '2px dashed var(--ws-edge)', borderRadius: 12, padding: '32px 16px',
                      textAlign: 'center', background: "var(--ws-bg)", display: 'flex', flexDirection: 'column',
                      alignItems: 'center', justifyContent: 'center', gap: 10, cursor: 'pointer',
                      transition: 'border-color 150ms ease'
                    }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = "var(--ws-accent)"}
                    onMouseLeave={e => e.currentTarget.style.borderColor = "var(--ws-surface-2)"}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload size={28} style={{color: "var(--ws-accent)"}} />
                    <div>
                      <div style={{fontSize: 12, fontWeight: 700, color: "var(--ws-ink)"}}>or drop your files here</div>
                      <div style={{fontSize: 10, color: "var(--ws-muted)", marginTop: 4}}>PDF, MD, Markdown, or TXT up to 10MB</div>
                    </div>
                    <button 
                      type="button" 
                      style={{
                        padding: '6px 14px', background: "var(--ws-accent)", color: "var(--ws-bg)",
                        border: 'none', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer'
                      }}
                    >
                      Upload files
                    </button>
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      multiple 
                      onChange={handleLocalFileUpload} 
                      style={{display: 'none'}} 
                    />
                  </div>
                </div>
              )}

              {ingestType === 'github' && (
                <div style={{display: 'flex', flexDirection: 'column', gap: 12}}>
                  <div style={{display: 'flex', flexDirection: 'column', gap: 6}}>
                    <label style={{fontSize: 11.5, fontWeight: 600, color: "var(--ws-soft)"}}>GitHub Repository URL</label>
                    <input 
                      type="url"
                      placeholder="e.g., https://github.com/username/project"
                      value={ingestUrl}
                      onChange={e => setIngestUrl(e.target.value)}
                      style={{
                        width: '100%', padding: '10px 12px', background: "var(--ws-bg)",
                        border: '1px solid var(--ws-edge)', borderRadius: 8,
                        color: "var(--ws-ink)", fontSize: 12, outline: 'none'
                      }}
                    />
                  </div>
                  <div style={{fontSize: 10, color: "var(--ws-muted)", lineHeight: 1.45}}>
                    💡 We will parse the repository structure, ingest markdown files (README, docs, architecture guides), and build conceptual references directly inside the notebook.
                  </div>
                </div>
              )}

              {ingestType === 'web' && (
                <div style={{display: 'flex', flexDirection: 'column', gap: 12}}>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px',
                    background: "var(--ws-bg)", border: '1px solid var(--ws-edge)', borderRadius: 8
                  }}>
                    <Globe size={13} style={{color: "var(--ws-muted)"}} />
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
                    <span style={{color: "var(--ws-line)", width: 1, height: 14, background: "var(--ws-surface-2)", alignSelf: 'stretch'}} />
                    <input 
                      type="text" 
                      placeholder="Search the web for new sources or paste URL..."
                      value={ingestUrl}
                      onChange={e => setIngestUrl(e.target.value)}
                      style={{flex: 1, background: 'none', border: 'none', color: "var(--ws-ink)", fontSize: 12, outline: 'none'}}
                    />
                  </div>
                  <div style={{fontSize: 10, color: "var(--ws-muted)", lineHeight: 1.45}}>
                    💡 Enter a search query to research concepts via web search summaries, or paste any direct URL page to ingest its full textbook text content.
                  </div>
                </div>
              )}

              {ingestType === 'drive' && (
                <div style={{display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center', padding: '20px 0'}}>
                  <div style={{
                    width: 44, height: 44, borderRadius: '50%', background: "var(--ws-surface-2)",
                    display: 'flex', alignItems: 'center', justifyContent: 'center', color: "var(--ws-accent)", marginBottom: 8
                  }}>
                    <Cloud size={20} />
                  </div>
                  <div style={{fontSize: 13, fontWeight: 700, color: "var(--ws-ink)", textAlign: 'center'}}>Google Drive Integration</div>
                  <p style={{fontSize: 11, color: "var(--ws-muted)", textAlign: 'center', maxWidth: 360, margin: '0 0 12px', lineHeight: 1.45}}>
                    Seamlessly connect your Google Drive account to import study guides, slide decks, papers, or homework sheets.
                  </p>
                  <button 
                    type="button"
                    onClick={handleDriveConnectMock}
                    style={{
                      padding: '8px 16px', background: "var(--ws-accent)", color: "var(--ws-bg)",
                      border: 'none', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer'
                    }}
                  >
                    Connect Google Drive
                  </button>
                </div>
              )}

              {ingestType === 'text' && (
                <div style={{display: 'flex', flexDirection: 'column', gap: 12}}>
                  <div style={{display: 'flex', flexDirection: 'column', gap: 6}}>
                    <label style={{fontSize: 11.5, fontWeight: 600, color: "var(--ws-soft)"}}>Source Name</label>
                    <input 
                      type="text"
                      placeholder="Name this study note (e.g. Lecture 4 derivation notes)"
                      value={ingestName}
                      onChange={e => setIngestName(e.target.value)}
                      style={{
                        width: '100%', padding: '10px 12px', background: "var(--ws-bg)",
                        border: '1px solid var(--ws-edge)', borderRadius: 8,
                        color: "var(--ws-ink)", fontSize: 12, outline: 'none'
                      }}
                    />
                  </div>
                  <div style={{display: 'flex', flexDirection: 'column', gap: 6}}>
                    <label style={{fontSize: 11.5, fontWeight: 600, color: "var(--ws-soft)"}}>Copied Text Context</label>
                    <textarea 
                      placeholder="Paste your copied textbook text, definitions, formulas, or homework descriptions..."
                      value={ingestText}
                      onChange={e => setIngestText(e.target.value)}
                      style={{
                        width: '100%', minHeight: 90, padding: '10px 12px', background: "var(--ws-bg)",
                        border: '1px solid var(--ws-edge)', borderRadius: 8,
                        color: "var(--ws-ink)", fontSize: 12, outline: 'none', resize: 'vertical',
                        fontFamily: 'inherit'
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Progress bar at the bottom */}
              <div style={{borderTop: '1px solid var(--ws-edge-soft)', paddingTop: 16, display: 'flex', flexDirection: 'column', gap: 6}}>
                <div style={{display: 'flex', justifyContent: 'space-between', fontSize: 10.5, color: "var(--ws-muted)"}}>
                  <span>Reference Source Capacity</span>
                  <span>{sources.length} / 100 loaded</span>
                </div>
                <div style={{width: '100%', height: 6, background: "var(--ws-bg)", borderRadius: 3, overflow: 'hidden'}}>
                  <div style={{width: `${Math.min(sources.length, 100)}%`, height: '100%', background: "var(--ws-accent)", borderRadius: 3}} />
                </div>
              </div>

            </div>

            {/* Footer */}
            <div style={{padding: '12px 24px', background: "var(--ws-surface-2)", borderTop: '1px solid var(--ws-edge-soft)', display: 'flex', gap: 8, justifyContent: 'flex-end'}}>
              <button 
                type="button" 
                onClick={() => setShowAddSources(false)}
                style={{
                  padding: '8px 14px', background: 'none', border: '1px solid var(--ws-edge-soft)',
                  color: "var(--ws-soft)", borderRadius: 8, cursor: 'pointer', fontSize: 11.5, fontWeight: 600
                }}
              >
                Cancel
              </button>
              
              {ingestType !== 'upload' && ingestType !== 'drive' && (
                <button 
                  type="button" 
                  onClick={handleIngestSubmit}
                  disabled={isIngesting || (!ingestUrl.trim() && !ingestText.trim())}
                  style={{
                    padding: '8px 16px', background: isIngesting ? "var(--ws-surface-2)" : "var(--ws-accent)", 
                    color: isIngesting ? "var(--ws-muted)" : "var(--ws-bg)",
                    border: 'none', borderRadius: 8, fontSize: 11.5, fontWeight: 700, 
                    cursor: (isIngesting || (!ingestUrl.trim() && !ingestText.trim())) ? 'not-allowed' : 'pointer',
                    display: 'flex', alignItems: 'center', gap: 6
                  }}
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
