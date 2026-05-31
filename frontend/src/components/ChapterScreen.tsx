import {ArrowLeft, Star, Pencil, Lock, Save, X, Plus} from 'lucide-react';
import {useState, useEffect} from 'react';
import { Link } from '@tanstack/react-router';
import type {Subject, Domain, Chapter, NavLocation, Resource} from '../workspaceTypes';

type Props = {
  domain: Domain;
  subject: Subject;
  chapter: Chapter;
  onNavigate: (loc: NavLocation) => void;
  onUpdateChapter: (domainId: string, subjectId: string, chapterId: string, fields: Partial<Chapter>) => void;
  onRemoveResource: (domainId: string, subjectId: string, resourceId: string) => void;
};

function ChapterScreen({domain, subject, chapter, onNavigate: _onNavigate, onUpdateChapter, onRemoveResource}: Props) {
  const [starred, setStarred] = useState(false);

  const [isEditingMemory, setIsEditingMemory] = useState(false);
  const [memoryText, setMemoryText] = useState(chapter.memory || '');

  const [isEditingInst, setIsEditingInst] = useState(false);
  const [instText, setInstText] = useState(chapter.instructions || '');

  useEffect(() => {
    setMemoryText(chapter.memory || '');
    setInstText(chapter.instructions || '');
  }, [chapter]);

  const handleSaveMemory = () => {
    onUpdateChapter(domain.id, subject.id, chapter.id, { memory: memoryText.trim() });
    setIsEditingMemory(false);
  };

  const handleSaveInst = () => {
    onUpdateChapter(domain.id, subject.id, chapter.id, { instructions: instText.trim() });
    setIsEditingInst(false);
  };

  return (
    <div className="flex h-full overflow-hidden bg-ws-floor text-ws-ink p-4 gap-4">
      {/* Left column — topics panel */}
      <div className="flex-[1_1_65%] flex flex-col overflow-hidden bg-ws-bench border border-ws-line rounded-xl shadow-md">
        {/* Header */}
        <div className="px-6 py-5 border-b border-ws-line bg-ws-bench/50 shrink-0">
          <Link
            to="/subject/$domainId/$subjectId"
            params={{ domainId: domain.id, subjectId: subject.id }}
            className="no-underline flex items-center gap-1.5 bg-transparent border-none text-ws-muted hover:text-ws-ink text-xs cursor-pointer p-0 mb-3 transition-colors"
          >
            <ArrowLeft size={14} /> Back to {subject.name}
          </Link>

          <div className="flex items-center gap-3">
            <h1 className="text-xl font-extrabold text-ws-ink m-0 flex-1 tracking-tight">{chapter.name}</h1>
            <button
              type="button"
              onClick={() => setStarred(!starred)}
              className={`bg-transparent border-none cursor-pointer flex transition-colors ${starred ? 'text-ws-glow' : 'text-ws-muted hover:text-ws-ink'}`}
            >
              <Star size={16} fill={starred ? 'currentColor' : 'none'} />
            </button>
          </div>

          <p className="text-ws-muted text-[13px] mt-2 leading-relaxed">
            {chapter.description || `Explore learning modules and practice exercises for ${chapter.name}.`}
          </p>
        </div>

        {/* Topics list */}
        <div className="flex-1 overflow-y-auto p-5 scrollbar">
          <div className="text-[10px] font-bold text-ws-muted uppercase tracking-wider mb-3 px-1">
            Topics & Concepts
          </div>
          
          <div className="flex flex-col gap-2.5">
            {chapter.topics.map(topic => (
              <Link
                key={topic.id}
                to="/topic/$domainId/$subjectId/$chapterId/$topicId"
                params={{ domainId: domain.id, subjectId: subject.id, chapterId: chapter.id, topicId: topic.id }}
                className="no-underline flex flex-col gap-1 w-full px-4 py-3 bg-ws-bg border border-ws-line rounded-lg text-left cursor-pointer text-ws-ink transition-all hover:border-ws-line-strong hover:bg-ws-bench shadow-sm group"
              >
                <span className="text-[13px] font-semibold text-ws-ink group-hover:text-ws-glow transition-colors">{topic.name}</span>
                {topic.lastMessage && (
                  <span className="text-[11px] text-ws-muted">{topic.lastMessage}</span>
                )}
              </Link>
            ))}

            {/* + New Topic */}
            <Link
              to="/notebook/$domainId/$subjectId"
              params={{ domainId: domain.id, subjectId: subject.id }}
              className="no-underline flex items-center justify-center gap-2 w-full p-4 bg-transparent border border-dashed border-ws-line rounded-lg text-ws-glow hover:border-ws-glow hover:bg-ws-glow/5 cursor-pointer text-[13px] font-semibold mt-3 transition-all"
            >
              <Plus size={14} /> New Topic / Concept
            </Link>
          </div>
        </div>
      </div>

      {/* Right column — metadata + files panel */}
      <div className="flex-[1_1_35%] flex flex-col gap-4 overflow-y-auto scrollbar">
        {/* Memory card */}
        <div className="bg-ws-bench border border-ws-line rounded-xl p-4 shadow-md flex flex-col">
          <div className="flex justify-between items-center mb-3">
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-ws-ink text-[13px] tracking-tight">Chapter Memory</span>
              <span className="text-[10px] text-ws-muted bg-ws-bg border border-ws-line px-1.5 py-0.5 rounded flex items-center gap-0.5">
                <Lock size={10} /> Only you
              </span>
            </div>
            {!isEditingMemory && (
              <button
                type="button"
                onClick={() => setIsEditingMemory(true)}
                className="bg-transparent border-none cursor-pointer text-ws-muted hover:text-ws-ink flex p-0.5 transition-colors"
                title="Edit Chapter Memory"
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
                  onClick={() => { setMemoryText(chapter.memory || ''); setIsEditingMemory(false); }}
                  className="px-2.5 py-1 bg-transparent border border-ws-line text-ws-muted rounded cursor-pointer text-[11px] flex items-center gap-1 hover:bg-ws-surface-2 transition-colors"
                >
                  <X size={10} /> Cancel
                </button>
              </div>
            </div>
          ) : (
            <p className="text-xs text-ws-muted leading-relaxed m-0 whitespace-pre-wrap">
              {chapter.memory || 'Record chapter concepts and formulas for targeted problem evaluation.'}
            </p>
          )}
        </div>

        {/* Instructions card */}
        <div className="bg-ws-bench border border-ws-line rounded-xl p-4 shadow-md flex flex-col">
          <div className="flex justify-between items-center mb-3">
            <span className="font-bold text-ws-ink text-[13px] tracking-tight">Chapter Instructions</span>
            {!isEditingInst && (
              <button
                type="button"
                onClick={() => setIsEditingInst(true)}
                className="bg-transparent border-none cursor-pointer text-ws-muted hover:text-ws-ink flex p-0.5 transition-colors"
                title="Edit Chapter Instructions"
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
                  onClick={() => { setInstText(chapter.instructions || ''); setIsEditingInst(false); }}
                  className="px-2.5 py-1 bg-transparent border border-ws-line text-ws-muted rounded cursor-pointer text-[11px] flex items-center gap-1 hover:bg-ws-surface-2 transition-colors"
                >
                  <X size={10} /> Cancel
                </button>
              </div>
            </div>
          ) : (
            <p className="text-xs text-ws-muted leading-relaxed m-0 whitespace-pre-wrap">
              {chapter.instructions || 'Set custom chapter-level prompt variables here.'}
            </p>
          )}
        </div>

        {/* References list panel */}
        <div className="bg-ws-bench border border-ws-line rounded-xl p-4 shadow-md flex flex-col gap-3">
          <div className="font-bold text-ws-ink text-[13px] tracking-tight">
            Subject References
          </div>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-2.5">
            {subject.resources.map(res => (
              <ResourceCard key={res.id} resource={res} onRemove={() => onRemoveResource(domain.id, subject.id, res.id)} />
            ))}
            {subject.resources.length === 0 && (
              <div className="col-span-full p-6 text-center text-ws-muted text-xs italic bg-ws-bg border border-dashed border-ws-line rounded-lg">
                No reference files loaded.
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
    <div className="bg-ws-bench border border-ws-line rounded-md p-3 flex flex-col gap-1.5 relative transition-colors hover:border-ws-line-strong">
      <button
        type="button"
        onClick={e => { e.stopPropagation(); onRemove(); }}
        className="absolute top-1 right-1 bg-transparent border-none text-ws-muted hover:text-ws-fail cursor-pointer flex p-0.5 transition-colors"
        title="Remove resource"
      >
        <X size={11} />
      </button>

      <div className="text-xs font-semibold text-ws-ink break-all leading-tight pr-3">
        {resource.name}
      </div>
      <div className="text-[10px] text-ws-muted">
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

export default ChapterScreen;
