import {Sparkles, Send, FileOutput, ArrowLeft, Plus, Headphones, Presentation, Video, Network, TrendingUp, CreditCard, HelpCircle, BarChart4, Table, StickyNote, Globe, Check, Columns, X, Upload, Clipboard, Cloud} from 'lucide-react';
import {useState, useRef, useEffect, useMemo} from 'react';
import type {Domain, Subject, Artifact, NavLocation} from '../workspaceTypes';
import { CustomSelect } from './ui/CustomSelect';

const GithubIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }} {...props}>
    <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
  </svg>
);

type Message = { id: string; role: 'user' | 'assistant'; content: string };
type GeneratedArtifact = { id: string; name: string; type: string; time: string };

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
  const [artifacts, setArtifacts] = useState<GeneratedArtifact[]>([
    {id: 'art-init', name: `Initial ${subject.name} Workbook`, type: 'Workbook', time: '2 hours ago'}
  ]);
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

      // 3. Update local list
      setArtifacts(prev => [
        { id: uniqueId, name: `Generated ${targetType}`, type: targetType, time: 'Just now' },
        ...prev
      ]);

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
    <div 
      style={{
        display: 'flex', 
        width: '100%', 
        height: '100%', 
        background: '#08080a', // Darkened spaces separating sections
        padding: 12,
        gap: 12,
        overflow: 'hidden', 
        position: 'relative'
      }}
    >
      
      {/* 1. Left Column: Sources */}
      <div 
        style={{
          width: sourcesCollapsed ? 50 : 280,
          border: '1px solid var(--ws-edge-soft)',
          borderRadius: 12,
          background: "var(--ws-bg)",
          display: 'flex',
          flexDirection: 'column',
          transition: 'width 200ms ease',
          overflow: 'hidden',
          height: '100%'
        }}
      >
        <div style={{padding: '16px 14px', borderBottom: '1px solid var(--ws-edge-soft)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0}}>
          {!sourcesCollapsed && (
            <div style={{display: 'flex', flexDirection: 'column', gap: 2}}>
              <span style={{fontSize: 13, fontWeight: 700, color: "var(--ws-ink)"}}>Sources</span>
              <span style={{fontSize: 10, color: "var(--ws-muted)"}}>{sources.length} total sources loaded</span>
            </div>
          )}
          <button 
            type="button" 
            onClick={() => setSourcesCollapsed(!sourcesCollapsed)}
            style={{background: 'none', border: 'none', color: "var(--ws-muted)", cursor: 'pointer', padding: 4}}
            title={sourcesCollapsed ? "Expand Sources" : "Collapse Sources"}
          >
            <Columns size={14} />
          </button>
        </div>

        {!sourcesCollapsed && (
          <div style={{flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden'}}>
            {/* Search web inputs */}
            <div style={{padding: 12, display: 'flex', flexDirection: 'column', gap: 8, borderBottom: '1px solid var(--ws-edge-soft)', flexShrink: 0}}>
              <button 
                type="button"
                onClick={() => setShowAddSources(true)}
                style={{
                  width: '100%', padding: '8px 12px', background: "var(--ws-bg)", border: '1px dashed var(--ws-edge)',
                  borderRadius: "6px", color: "var(--ws-accent)", fontWeight: 700, fontSize: 11,
                  display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center', cursor: 'pointer',
                  transition: 'all 150ms ease'
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--ws-accent)"; e.currentTarget.style.background = "rgba(16,185,129,0.1)"; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--ws-surface-2)"; e.currentTarget.style.background = "var(--ws-bg)"; }}
              >
                <Plus size={12} /> Add sources
              </button>

              <div style={{display: 'flex', gap: 4, alignItems: 'center', paddingLeft: 4}}>
                <Globe size={11} style={{color: "var(--ws-muted)"}} />
                <span style={{fontSize: 10, color: "var(--ws-muted)"}}>Search the web for new sources</span>
              </div>
            </div>

            {/* Selector list header */}
            <div style={{padding: '8px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--ws-edge-soft)', flexShrink: 0}}>
              <span style={{fontSize: 11, color: "var(--ws-muted)"}}>{totalChunks} chunks active</span>
              <button 
                type="button" 
                onClick={handleSelectAll}
                style={{background: 'none', border: 'none', color: "var(--ws-accent)", fontSize: 10, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4}}
              >
                <Check size={11} /> {allChecked ? 'Deselect all' : 'Select all'}
              </button>
            </div>

            {/* Checklist: Scrollable internally */}
            <div style={{flex: 1, overflowY: 'auto', padding: 8, display: 'flex', flexDirection: 'column', gap: 4}} className="scrollbar">
              {sources.map(s => (
                <div 
                  key={s.id}
                  onClick={() => toggleSource(s.id)}
                  style={{
                    display: 'flex', alignItems: 'flex-start', gap: 8, padding: 8,
                    borderRadius: "6px", background: s.selected ? "var(--ws-surface-2)" : 'transparent',
                    cursor: 'pointer', border: '1px solid transparent',
                    borderColor: s.selected ? "var(--ws-line)" : 'transparent',
                    transition: 'all 100ms ease'
                  }}
                >
                  <input 
                    type="checkbox" 
                    checked={s.selected}
                    onChange={() => {}}
                    className="accent-ws-glow mt-0.5 cursor-pointer" 
                    style={{width: 13, height: 13}} 
                  />
                  <div style={{minWidth: 0, flex: 1}}>
                    <div style={{fontSize: 11, fontWeight: s.selected ? 600 : 400, color: s.selected ? "var(--ws-ink)" : "var(--ws-soft)", overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}>
                      {s.name}
                    </div>
                    <div style={{fontSize: 9, color: "var(--ws-muted)", marginTop: 2}}>{s.chunks} chunks loaded</div>
                  </div>
                </div>
              ))}
              {sources.length === 0 && (
                <div style={{padding: 24, textAlign: 'center', color: "var(--ws-muted)", fontSize: 11, fontStyle: 'italic'}}>
                  No reference files linked to subject.
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 2. Middle Column: Analysis Chat */}
      <div 
        style={{
          flex: 1, 
          display: 'flex', 
          flexDirection: 'column', 
          overflow: 'hidden', 
          background: "var(--ws-bg)",
          border: '1px solid var(--ws-edge-soft)',
          borderRadius: 12,
          height: '100%'
        }}
      >
        <div style={{padding: '16px 24px', borderBottom: '1px solid var(--ws-edge-soft)', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0}}>
          <button 
            type="button"
            onClick={() => onNavigate({level: 'subject', domainId: domain.id, subjectId: subject.id})}
            style={{background: 'none', border: 'none', color: "var(--ws-muted)", display: 'flex', cursor: 'pointer', padding: 4}}
            title="Back to subject"
          >
            <ArrowLeft size={16} />
          </button>
          <div>
            <h2 style={{fontSize: 14, fontWeight: 700, color: "var(--ws-ink)", margin: 0}}>{subject.name} Notebook</h2>
            <div style={{fontSize: 10, color: "var(--ws-muted)", marginTop: 1}}>{sources.filter(s => s.selected).length} sources selected</div>
          </div>
        </div>

        {/* Dynamic Chat log: Scrollable internally */}
        <div style={{flex: 1, overflowY: 'auto', padding: '24px 32px'}} className="scrollbar">
          {/* Avatar Robot Header Card */}
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center',
            background: "var(--ws-bg)", border: '1px solid var(--ws-edge-soft)', borderRadius: 'var(--ws-r-lg)',
            padding: 24, marginBottom: 28, position: 'relative', overflow: 'hidden'
          }}>
            <div style={{
              width: 48, height: 48, borderRadius: '50%', background: "var(--ws-surface-2)",
              border: '1px solid var(--ws-edge-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              marginBottom: 12
            }}>
              <Sparkles size={22} style={{color: "var(--ws-soft)"}} />
            </div>
            
            <h1 style={{fontSize: 18, fontWeight: 800, color: "var(--ws-ink)", margin: '0 0 4px', letterSpacing: '-0.02em'}}>
              {subject.name} Admissions & Study Roadmap
            </h1>
            <p style={{fontSize: 12, color: "var(--ws-muted)", margin: 0}}>
              {sources.length} sources · Ingested context available for compilation
            </p>

            <div style={{
              marginTop: 12, padding: '4px 12px', background: "var(--ws-surface-2)", border: '1px solid var(--ws-edge)',
              borderRadius: "6px", fontSize: 10, color: "var(--ws-soft)"
            }}>
              💡 Add a cover image and custom note to personalize your notebook!
            </div>
          </div>

          {/* Chat Messages */}
          <div style={{display: 'flex', flexDirection: 'column', gap: 16}}>
            {messages.map(m => (
              <div key={m.id} style={{display: 'flex', gap: 12, justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start'}}>
                {m.role === 'assistant' && (
                  <div style={{
                    width: 28, height: 28, borderRadius: '50%', background: "var(--ws-surface-2)",
                    border: '1px solid var(--ws-edge)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    <Sparkles size={13} className="text-ws-glow" />
                  </div>
                )}
                <div 
                  style={{
                    maxWidth: '80%', padding: '12px 14px', borderRadius: "6px",
                    background: m.role === 'assistant' ? "var(--ws-bg)" : "var(--ws-accent)",
                    border: m.role === 'assistant' ? '1px solid var(--ws-edge-soft)' : 'none',
                    color: m.role === 'assistant' ? "var(--ws-ink)" : "var(--ws-bg)",
                    fontSize: 12, lineHeight: 1.5, whiteSpace: 'pre-line'
                  }}
                >
                  {m.content}
                </div>
              </div>
            ))}
            {isTyping && (
              <div style={{display: 'flex', gap: 12}}>
                <div style={{
                  width: 28, height: 28, borderRadius: '50%', background: "var(--ws-surface-2)",
                  border: '1px solid var(--ws-edge)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0
                }}>
                  <Sparkles size={13} className="text-ws-glow animate-pulse" />
                </div>
                <div style={{background: "var(--ws-bg)", border: '1px solid var(--ws-edge-soft)', borderRadius: "6px", padding: 12, fontSize: 12, color: "var(--ws-muted)", fontStyle: 'italic'}}>
                  Synthesizing selected chunks...
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Large Chat Input Prompt bar */}
        <div style={{padding: 16, borderTop: '1px solid var(--ws-edge-soft)', flexShrink: 0}}>
          <div style={{position: 'relative', display: 'flex', alignItems: 'center'}}>
            <input 
              type="text"
              placeholder="Ask a question or create something..."
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleSend(); }}
              style={{
                width: '100%', padding: '12px 90px 12px 16px', background: "var(--ws-bg)",
                border: '1px solid var(--ws-edge)', borderRadius: 'var(--ws-r-lg)',
                color: "var(--ws-ink)", fontSize: 12, outline: 'none'
              }}
            />
            <div style={{position: 'absolute', right: 42, fontSize: 10, color: "var(--ws-muted)", userSelect: 'none'}}>
              {sources.filter(s => s.selected).length} sources
            </div>
            <button 
              type="button"
              onClick={handleSend}
              disabled={!input.trim()}
              style={{
                position: 'absolute', right: 8, width: 28, height: 28, borderRadius: '50%',
                background: input.trim() ? "var(--ws-accent)" : "var(--ws-surface-2)",
                border: 'none', color: input.trim() ? "var(--ws-bg)" : "var(--ws-muted)",
                cursor: input.trim() ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 100ms ease'
              }}
            >
              <Send size={12} />
            </button>
          </div>
        </div>
      </div>

      {/* 3. Right Column: Studio action dashboard */}
      <div 
        style={{
          width: studioCollapsed ? 50 : 340,
          background: "var(--ws-bg)",
          border: '1px solid var(--ws-edge-soft)',
          borderRadius: 12,
          display: 'flex',
          flexDirection: 'column',
          transition: 'width 200ms ease',
          overflow: 'hidden',
          height: '100%'
        }}
      >
        <div style={{padding: '16px 14px', borderBottom: '1px solid var(--ws-edge-soft)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0}}>
          {!studioCollapsed && (
            <span style={{fontSize: 13, fontWeight: 700, color: "var(--ws-ink)"}}>Notebook Studio</span>
          )}
          <button 
            type="button" 
            onClick={() => setStudioCollapsed(!studioCollapsed)}
            style={{background: 'none', border: 'none', color: "var(--ws-muted)", cursor: 'pointer', padding: 4}}
            title={studioCollapsed ? "Expand Studio" : "Collapse Studio"}
          >
            <Columns size={14} />
          </button>
        </div>

        {!studioCollapsed && (
          <div style={{flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto', padding: 16, gap: 16}} className="scrollbar">
            
            {/* Create overview wrapper */}
            <div style={{
              background: "var(--ws-bg)",
              border: '1px solid var(--ws-edge-soft)', borderRadius: 'var(--ws-r-lg)', padding: 16
            }}>
              <div style={{fontSize: 12, fontWeight: 700, color: "var(--ws-ink)", marginBottom: 4}}>Compile Audio Overview</div>
              <p style={{fontSize: 10, color: "var(--ws-muted)", lineHeight: 1.4, margin: 0}}>
                Create an Audio Overview to synthesize and explain core equations, coordinate derivations, and lessons.
              </p>
            </div>

            {/* Target actions grid */}
            <div>
              <div style={{fontSize: 10, fontWeight: 700, color: "var(--ws-muted)", textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10}}>
                Create Overviews & Guides
              </div>
              
              <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6}}>
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
                      style={{
                        padding: '10px 8px', background: "var(--ws-bg)", border: '1px solid var(--ws-edge-soft)',
                        borderRadius: "6px", display: 'flex', flexDirection: 'column', gap: 6,
                        alignItems: 'flex-start', cursor: 'pointer', textAlign: 'left',
                        transition: 'all 150ms ease'
                      }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--ws-accent)"; e.currentTarget.style.background = "var(--ws-surface-2)"; }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--ws-line)"; e.currentTarget.style.background = "var(--ws-bg)"; }}
                    >
                      <div style={{
                        width: 24, height: 24, borderRadius: "4px", background: "var(--ws-bg)",
                        display: 'flex', alignItems: 'center', justifyContent: 'center', color: "var(--ws-accent)"
                      }}>
                        <Icon size={12} />
                      </div>
                      <div>
                        <div style={{fontSize: 11, fontWeight: 700, color: "var(--ws-ink)"}}>{action.label}</div>
                        <div style={{fontSize: 9, color: "var(--ws-muted)", marginTop: 1}}>{action.type}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Alert boxes */}
            {alertMsg && (
              <div style={{
                background: 'rgba(239,68,68,0.1)', border: '1px solid var(--ws-danger)',
                borderRadius: "6px", padding: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8
              }}>
                <span style={{fontSize: 10, color: "#ef4444", lineHeight: 1.4}}>{alertMsg}</span>
                <button type="button" onClick={() => setAlertMsg(null)} style={{background: 'none', border: 'none', color: "#ef4444", fontSize: 10, fontWeight: 700, cursor: 'pointer'}}>
                  Dismiss
                </button>
              </div>
            )}

            {/* Recents generated */}
            <div>
              <div style={{fontSize: 10, fontWeight: 700, color: "var(--ws-muted)", textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10}}>
                Generated History
              </div>
              <div style={{display: 'flex', flexDirection: 'column', gap: 6}}>
                {artifacts.map(art => (
                  <div key={art.id} style={{
                    padding: '8px 10px', border: '1px solid var(--ws-edge-soft)', borderRadius: "6px",
                    background: "var(--ws-bg)", display: 'flex', alignItems: 'center', gap: 8
                  }}>
                    <FileOutput size={13} style={{color: "var(--ws-accent)", flexShrink: 0}} />
                    <div style={{minWidth: 0, flex: 1}}>
                      <div style={{fontSize: 11, fontWeight: 600, color: "var(--ws-ink)", overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}>
                        {art.name}
                      </div>
                      <div style={{fontSize: 9, color: "var(--ws-muted)", marginTop: 2}}>{art.time} · {art.type}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Notes list */}
            {notes.length > 0 && (
              <div>
                <div style={{fontSize: 10, fontWeight: 700, color: "var(--ws-muted)", textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10}}>
                  Personal Notes
                </div>
                <div style={{display: 'flex', flexDirection: 'column', gap: 6}}>
                  {notes.map((note, index) => (
                    <div key={index} style={{
                      padding: 10, border: '1px solid var(--ws-edge-soft)', borderRadius: "6px",
                      background: "var(--ws-bg)", fontSize: 11, color: "var(--ws-soft)", lineHeight: 1.4
                    }}>
                      {note}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Floating Notes button */}
            <div style={{marginTop: 'auto', paddingTop: 12}}>
              {showNotesForm ? (
                <div style={{
                  background: "var(--ws-bg)", border: '1px solid var(--ws-edge)', borderRadius: "6px",
                  padding: 8, display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 8
                }}>
                  <textarea 
                    value={newNoteText}
                    onChange={e => setNewNoteText(e.target.value)}
                    placeholder="Type note text..."
                    style={{
                      width: '100%', minHeight: 60, padding: 6, background: "var(--ws-bg)",
                      border: '1px solid var(--ws-edge-soft)', borderRadius: "4px",
                      color: "var(--ws-ink)", fontSize: 11, outline: 'none', resize: 'vertical'
                    }}
                    autoFocus
                  />
                  <div style={{display: 'flex', gap: 4, justifyContent: 'flex-end'}}>
                    <button type="button" onClick={handleAddNote} style={{padding: '3px 8px', background: "var(--ws-accent)", color: "var(--ws-bg)", border: 'none', borderRadius: 3, fontSize: 10, fontWeight: 700, cursor: 'pointer'}}>
                      Add
                    </button>
                    <button type="button" onClick={() => setShowNotesForm(false)} style={{padding: '3px 8px', background: 'none', border: '1px solid var(--ws-edge-soft)', color: "var(--ws-soft)", borderRadius: 3, fontSize: 10, cursor: 'pointer'}}>
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button 
                  type="button"
                  onClick={() => setShowNotesForm(true)}
                  style={{
                    width: '100%', padding: '8px 12px', background: "var(--ws-accent)", border: 'none',
                    borderRadius: "6px", color: "var(--ws-bg)", fontWeight: 700, fontSize: 11,
                    display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center', cursor: 'pointer',
                    boxShadow: '0 4px 10px rgba(0,0,0,0.15)'
                  }}
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
          style={{
            position: 'absolute', 
            inset: 0, 
            background: 'rgba(0, 0, 0, 0.5)',
            zIndex: 9999, 
            display: 'flex',
            alignItems: 'center', 
            justifyContent: 'center'
          }}
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
