import {ArrowLeft, MoreHorizontal, Star, Plus, MessageCircle, Pencil, Lock, Save, X, FileCode} from 'lucide-react';
import {useState, useEffect} from 'react';
import { Link } from '@tanstack/react-router';
import type {Subject, Domain, NavLocation, Resource} from '../workspaceTypes';

type Props = {
  domain: Domain;
  subject: Subject;
  onNavigate: (loc: NavLocation) => void;
  onUpdateSubject: (domainId: string, subjectId: string, fields: Partial<Subject>) => void;
  onRemoveResource: (domainId: string, subjectId: string, resourceId: string) => void;
  onOpenCreateModal: (type: 'domain' | 'subject' | 'chapter' | 'topic', domainId?: string, subjectId?: string, chapterId?: string) => void;
};

function SubjectScreen({domain, subject, onNavigate: _onNavigate, onUpdateSubject, onRemoveResource, onOpenCreateModal}: Props) {
  const [starred, setStarred] = useState(false);

  const [isEditingMemory, setIsEditingMemory] = useState(false);
  const [memoryText, setMemoryText] = useState(subject.memory || '');

  const [isEditingInst, setIsEditingInst] = useState(false);
  const [instText, setInstText] = useState(subject.instructions || '');

  // Keep state in sync with prop updates
  useEffect(() => {
    setMemoryText(subject.memory || '');
    setInstText(subject.instructions || '');
  }, [subject]);

  const handleSaveMemory = () => {
    onUpdateSubject(domain.id, subject.id, { memory: memoryText.trim() });
    setIsEditingMemory(false);
  };

  const handleSaveInst = () => {
    onUpdateSubject(domain.id, subject.id, { instructions: instText.trim() });
    setIsEditingInst(false);
  };

  return (
    <div className="flex h-full overflow-hidden bg-ws-floor text-ws-ink p-4 gap-4">
      {/* Left column — topics panel */}
      <div className="flex-[1_1_65%] flex flex-col overflow-hidden bg-ws-bench border border-ws-line rounded-xl shadow-md">
        {/* Header */}
        <div className="px-6 py-5 border-b border-ws-line bg-ws-bench/50 shrink-0">
          <Link
            to="/"
            className="no-underline flex items-center gap-1.5 bg-transparent border-none text-ws-muted hover:text-ws-ink text-xs cursor-pointer p-0 mb-3 transition-colors"
          >
            <ArrowLeft size={14} /> All Domains
          </Link>
 
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-extrabold text-ws-ink m-0 flex-1 tracking-tight">{subject.name}</h1>
            <button
              type="button"
              onClick={() => setStarred(!starred)}
              className={`bg-transparent border-none cursor-pointer flex transition-colors ${starred ? 'text-ws-glow' : 'text-ws-muted hover:text-ws-ink'}`}
            >
              <Star size={16} fill={starred ? 'currentColor' : 'none'} />
            </button>
            <button
              type="button"
              className="bg-transparent border-none cursor-pointer text-ws-muted hover:text-ws-ink flex transition-colors"
            >
              <MoreHorizontal size={16} />
            </button>
          </div>
 
          {subject.description && (
            <p className="text-ws-muted text-[13px] mt-2 leading-relaxed">{subject.description}</p>
          )}
        </div>
 
        {/* Chat input placeholder */}
        <div className="px-6 py-3 border-b border-ws-line bg-ws-bench/30 shrink-0">
          <div className="bg-ws-bg border border-ws-line rounded-lg px-4 py-2.5 flex items-center gap-2">
            <MessageCircle size={14} className="text-ws-muted" />
            <span className="text-ws-muted text-[13px]">How can I help you today?</span>
          </div>
        </div>
 
        {/* Topics list */}
        <div className="flex-1 overflow-y-auto p-4 scrollbar">
          <div className="flex justify-between items-center px-2 pt-1 pb-3 mb-3">
            <span className="text-[10px] font-bold text-ws-muted uppercase tracking-wider">Chapters</span>
            <button
              type="button"
              onClick={() => onOpenCreateModal('chapter', domain.id, subject.id)}
              className="bg-transparent border-none cursor-pointer text-ws-glow hover:bg-ws-glow/10 text-[11px] font-bold flex items-center gap-1 px-2 py-1 rounded transition-colors"
            >
              <Plus size={12} /> New Chapter
            </button>
          </div>
 
          <div className="flex flex-col gap-4">
            {subject.chapters.map((ch, idx) => {
              return (
                <div
                  key={ch.id}
                  className="bg-ws-bg border border-ws-line rounded-lg overflow-hidden transition-all hover:border-ws-line-strong duration-150 shadow-sm"
                >
                  {/* Chapter Header */}
                  <div
                    className="bg-ws-bench px-4 py-3 border-b border-ws-line flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0 flex-1 flex gap-2.5 items-center">
                      {/* Visual Badge representing Chapter Index */}
                      <div
                        className="w-6 h-6 rounded-full bg-ws-floor border border-ws-line text-ws-ink flex items-center justify-center text-[10px] font-bold shrink-0"
                      >
                        {idx + 1}
                      </div>
                      <div className="min-w-0 flex-1">
                        <Link
                          to="/chapter/$domainId/$subjectId/$chapterId"
                          params={{ domainId: domain.id, subjectId: subject.id, chapterId: ch.id }}
                          className="no-underline text-[13px] font-bold text-ws-ink hover:text-ws-glow cursor-pointer inline-flex items-center gap-1.5 transition-colors"
                        >
                          {ch.name}
                        </Link>
                        {ch.description && (
                          <div className="text-[11px] text-ws-muted mt-0.5 leading-normal">
                            {ch.description}
                          </div>
                        )}
                      </div>
                    </div>
 
                    <div className="flex gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => onOpenCreateModal('topic', domain.id, subject.id, ch.id)}
                        title="Add new topic inside this chapter"
                        className="flex items-center gap-1 bg-transparent border border-ws-line rounded text-[11px] font-semibold text-ws-glow px-2 py-1 cursor-pointer transition-all hover:border-ws-glow/50 hover:bg-ws-glow/5"
                      >
                        <Plus size={11} /> Topic
                      </button>
                      <Link
                        to="/chapter/$domainId/$subjectId/$chapterId"
                        params={{ domainId: domain.id, subjectId: subject.id, chapterId: ch.id }}
                        className="no-underline bg-transparent border border-ws-line rounded text-[11px] font-semibold text-ws-muted px-2 py-1 cursor-pointer transition-all hover:bg-ws-surface-2"
                      >
                        Open Chapter
                      </Link>
                    </div>
                  </div>
 
                  {/* Topics list inside the card */}
                  <div className="flex flex-col">
                    {ch.topics.map((topic, tIdx) => (
                      <Link
                        key={topic.id}
                        to="/topic/$domainId/$subjectId/$chapterId/$topicId"
                        params={{ domainId: domain.id, subjectId: subject.id, chapterId: ch.id, topicId: topic.id }}
                        className={`no-underline flex items-center gap-2.5 w-full px-4 py-3 bg-transparent hover:bg-ws-bench cursor-pointer text-left text-ws-ink transition-colors ${tIdx < ch.topics.length - 1 ? 'border-b border-ws-line' : ''}`}
                      >
                        <div
                          className="w-5 h-5 rounded bg-ws-floor border border-ws-line flex items-center justify-center text-ws-muted shrink-0"
                        >
                          <FileCode size={12} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-[13px] font-medium text-ws-ink">{topic.name}</div>
                          {topic.lastMessage && (
                            <div className="text-[10px] text-ws-muted mt-0.5">{topic.lastMessage}</div>
                          )}
                        </div>
                        <span className="text-[10px] px-1.5 py-0.5 bg-ws-floor text-ws-muted border border-ws-line rounded font-medium">
                          Open Exercise
                        </span>
                      </Link>
                    ))}
                    {ch.topics.length === 0 && (
                      <div className="px-4 py-6 text-center text-ws-muted text-xs italic bg-ws-bench/10">
                        No topics inside this chapter yet. Click "+ Topic" to add one!
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
 
          {/* + New Chapter (Subject root link) */}
          <button
            type="button"
            onClick={() => onOpenCreateModal('chapter', domain.id, subject.id)}
            className="flex items-center justify-center gap-2 w-full p-4 bg-transparent border border-dashed border-ws-line rounded-lg text-ws-glow hover:border-ws-glow hover:bg-ws-glow/5 cursor-pointer text-[13px] font-semibold mt-4 transition-all"
          >
            <Plus size={14} /> Add New Chapter
          </button>
        </div>
      </div>
 
      {/* Right column — metadata + files panel */}
      <div className="flex-[1_1_35%] flex flex-col gap-4 overflow-y-auto scrollbar">
        {/* Memory card */}
        <div className="bg-ws-bench border border-ws-line rounded-xl p-4 shadow-md flex flex-col">
          <div className="flex justify-between items-center mb-3">
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-ws-ink text-[13px] tracking-tight">Memory</span>
              <span className="text-[10px] text-ws-muted bg-ws-bg border border-ws-line px-1.5 py-0.5 rounded flex items-center gap-0.5">
                <Lock size={10} /> Only you
              </span>
            </div>
            {!isEditingMemory && (
              <button
                type="button"
                onClick={() => setIsEditingMemory(true)}
                className="bg-transparent border-none cursor-pointer text-ws-muted hover:text-ws-ink flex p-0.5 transition-colors"
                title="Edit Memory"
              >
                <Pencil size={13} />
              </button>
            )}
          </div>
          
          {isEditingMemory ? (
            <div className="flex flex-col gap-2">
              <textarea
                value={memoryText}
                onChange={e => setMemoryText(e.target.value)}
                className="w-full min-h-[90px] p-2.5 bg-ws-bg border border-ws-glow rounded-md text-ws-ink text-xs outline-none font-inherit resize-y focus:ring-1 focus:ring-ws-glow"
                autoFocus
              />
              <div className="flex gap-1.5 justify-end">
                <button
                  type="button"
                  onClick={handleSaveMemory}
                  className="px-2.5 py-1 bg-ws-glow text-ws-floor font-bold border-none rounded cursor-pointer text-[11px] flex items-center gap-1 transition-transform active:scale-[0.98]"
                >
                  <Save size={10} /> Save
                </button>
                <button
                  type="button"
                  onClick={() => { setMemoryText(subject.memory || ''); setIsEditingMemory(false); }}
                  className="px-2.5 py-1 bg-transparent border border-ws-line text-ws-muted rounded cursor-pointer text-[11px] flex items-center gap-1 hover:bg-ws-surface-2 transition-colors"
                >
                  <X size={10} /> Cancel
                </button>
              </div>
            </div>
          ) : (
            <p className="text-xs text-ws-muted leading-relaxed m-0 whitespace-pre-wrap">
              {subject.memory || 'No memory recorded. Click the pencil icon to align the learning tutor.'}
            </p>
          )}
        </div>
 
        {/* Instructions card */}
        <div className="bg-ws-bench border border-ws-line rounded-xl p-4 shadow-md flex flex-col">
          <div className="flex justify-between items-center mb-3">
            <span className="font-bold text-ws-ink text-[13px] tracking-tight">Instructions</span>
            {!isEditingInst && (
              <button
                type="button"
                onClick={() => setIsEditingInst(true)}
                className="bg-transparent border-none cursor-pointer text-ws-muted hover:text-ws-ink flex p-0.5 transition-colors"
                title="Edit Instructions"
              >
                <Pencil size={13} />
              </button>
            )}
          </div>
          
          {isEditingInst ? (
            <div className="flex flex-col gap-2">
              <textarea
                value={instText}
                onChange={e => setInstText(e.target.value)}
                className="w-full min-h-[90px] p-2.5 bg-ws-bg border border-ws-glow rounded-md text-ws-ink text-xs outline-none font-inherit resize-y focus:ring-1 focus:ring-ws-glow"
                autoFocus
              />
              <div className="flex gap-1.5 justify-end">
                <button
                  type="button"
                  onClick={handleSaveInst}
                  className="px-2.5 py-1 bg-ws-glow text-ws-floor font-bold border-none rounded cursor-pointer text-[11px] flex items-center gap-1 transition-transform active:scale-[0.98]"
                >
                  <Save size={10} /> Save
                </button>
                <button
                  type="button"
                  onClick={() => { setInstText(subject.instructions || ''); setIsEditingInst(false); }}
                  className="px-2.5 py-1 bg-transparent border border-ws-line text-ws-muted rounded cursor-pointer text-[11px] flex items-center gap-1 hover:bg-ws-surface-2 transition-colors"
                >
                  <X size={10} /> Cancel
                </button>
              </div>
            </div>
          ) : (
            <p className="text-xs text-ws-muted leading-relaxed m-0 whitespace-pre-wrap">
              {subject.instructions || 'Define study focus and workspace constraints here.'}
            </p>
          )}
        </div>
 
        {/* Files grid */}
        <div className="bg-ws-bench border border-ws-line rounded-xl p-4 shadow-md flex flex-col gap-3">
          <div className="flex justify-between items-center">
            <span className="font-bold text-ws-ink text-[13px] tracking-tight">Files</span>
            <Link
              to="/notebook/$domainId/$subjectId"
              params={{ domainId: domain.id, subjectId: subject.id }}
              className="bg-transparent border-none cursor-pointer text-ws-muted hover:text-ws-ink flex transition-colors"
              title="Add files"
            >
              <Plus size={16} />
            </Link>
          </div>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-2.5">
            {subject.resources.map(res => (
              <ResourceCard key={res.id} resource={res} onRemove={() => onRemoveResource(domain.id, subject.id, res.id)} />
            ))}
            {subject.resources.length === 0 && (
              <div className="col-span-full p-6 text-center text-ws-muted text-xs italic bg-ws-bg border border-dashed border-ws-line rounded-lg">
                No files yet. Click + to add resources.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ResourceCard({resource, onRemove}: {resource: Resource, onRemove: () => void}) {
  const typeColors: Record<string, string> = {
    PDF: 'hsl(0, 60%, 55%)',
    HTML: 'hsl(25, 80%, 55%)',
    JS: 'hsl(50, 75%, 50%)',
    MD: 'hsl(210, 50%, 55%)',
    TXT: "var(--ws-muted)",
  };
  const color = typeColors[resource.fileType] || "var(--ws-muted)";

  return (
    <div className="bg-ws-bench border border-ws-edge-soft rounded-md p-3 flex flex-col gap-1.5 relative transition-colors hover:border-ws-edge-strong">
      <button
        type="button"
        onClick={e => { e.stopPropagation(); onRemove(); }}
        className="absolute top-1 right-1 bg-transparent border-none text-ws-ink-3 hover:text-ws-fail cursor-pointer flex p-0.5 transition-colors"
        title="Remove resource"
      >
        <X size={11} />
      </button>

      <div className="text-xs font-semibold text-ws-ink break-all leading-tight pr-3">
        {resource.name}
      </div>
      <div className="text-[10px] text-ws-ink-3">
        {resource.lines.toLocaleString()} lines
      </div>
      <span 
        className="self-start px-1.5 py-0.5 text-[10px] font-bold rounded border transition-colors"
        style={{
          color,
          borderColor: color,
          backgroundColor: `color-mix(in srgb, ${color} 15%, transparent)`
        }}
      >
        {resource.fileType}
      </span>
    </div>
  );
}

export default SubjectScreen;
