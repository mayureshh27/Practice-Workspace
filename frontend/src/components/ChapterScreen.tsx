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
    <div className="flex h-full overflow-hidden">
      {/* Left column — topics */}
      <div className="flex-[1_1_60%] flex-col overflow-hidden border-r border-ws-edge-soft flex">
        {/* Header */}
        <div className="px-6 pt-5 pb-4">
          <Link
            to="/subject/$domainId/$subjectId"
            params={{ domainId: domain.id, subjectId: subject.id }}
            className="no-underline flex items-center gap-1.5 bg-transparent border-0 text-ws-muted text-xs cursor-pointer p-0 mb-3"
          >
            <ArrowLeft size={14} /> Back to {subject.name}
          </Link>

          <div className="flex items-center gap-3">
            <h1 className="text-[22px] font-bold text-ws-ink m-0 flex-1">{chapter.name}</h1>
            <button
              type="button"
              onClick={() => setStarred(!starred)}
              className={`bg-transparent border-0 cursor-pointer flex ${starred ? 'text-ws-accent' : 'text-ws-muted'}`}
            >
              <Star size={18} fill={starred ? 'currentColor' : 'none'} />
            </button>
          </div>

          <p className="text-ws-soft text-[13px] mt-1.5 leading-normal">
            {chapter.description || `Explore learning modules and practice exercises for ${chapter.name}.`}
          </p>
        </div>

        {/* Topics list */}
        <div className="flex-1 overflow-y-auto px-6">
          <div className="screen-section-title">Topics & Concepts</div>

          <div className="flex flex-col gap-0.5">
            {chapter.topics.map(topic => (
              <Link
                key={topic.id}
                to="/topic/$domainId/$subjectId/$chapterId/$topicId"
                params={{ domainId: domain.id, subjectId: subject.id, chapterId: chapter.id, topicId: topic.id }}
                className="no-underline flex flex-col gap-0.5 w-full px-3.5 py-3 bg-ws-bg border border-ws-edge-soft rounded-ws-md text-left cursor-pointer text-ws-ink transition-colors duration-150 h-bd-accent h-surface-2"
              >
                <span className="text-sm font-semibold">{topic.name}</span>
                {topic.lastMessage && (
                  <span className="text-[11px] text-ws-muted">{topic.lastMessage}</span>
                )}
              </Link>
            ))}

            {/* + New Topic (available inside Chapter view as well) */}
            <Link
              to="/notebook/$domainId/$subjectId"
              params={{ domainId: domain.id, subjectId: subject.id }}
              className="no-underline flex items-center gap-1.5 w-full p-3 bg-transparent border border-dashed border-ws-edge rounded-ws-md text-ws-accent cursor-pointer text-[13px] font-medium mt-2 mb-4 transition-colors duration-150 h-bd-accent h-accent-tint"
            >
              <Plus size={14} /> New Topic / Concept
            </Link>
          </div>
        </div>
      </div>

      {/* Right column — metadata + files */}
      <div className="flex-[1_1_40%] overflow-y-auto p-5 flex flex-col gap-4">
        {/* Memory card */}
        <div className="bg-ws-bg border border-ws-edge-soft rounded-ws-lg p-4">
          <div className="flex justify-between items-center mb-2.5">
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-ws-ink text-[13px]">Chapter Memory</span>
              <span className="text-[10px] text-ws-muted bg-ws-bg border border-ws-edge-soft px-1.5 py-0.5 rounded-ws-sm flex items-center gap-[3px]">
                <Lock size={10} /> Only you
              </span>
            </div>
            {!isEditingMemory && (
              <button
                type="button"
                onClick={() => setIsEditingMemory(true)}
                className="bg-transparent border-0 cursor-pointer text-ws-muted flex p-0.5"
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
                className="w-full min-h-[80px] p-2 bg-ws-bg border border-[var(--ws-glow)] rounded-ws-md text-ws-ink text-xs outline-none font-sans resize-y"
                autoFocus
              />
              <div className="flex gap-1.5 justify-end">
                <button
                  type="button"
                  onClick={handleSaveMemory}
                  className="px-2.5 py-1 bg-ws-accent text-ws-bg font-semibold border-0 rounded-ws-sm cursor-pointer text-[11px] flex items-center gap-1"
                >
                  <Save size={10} /> Save
                </button>
                <button
                  type="button"
                  onClick={() => { setMemoryText(chapter.memory || ''); setIsEditingMemory(false); }}
                  className="px-2.5 py-1 bg-transparent border border-ws-edge-soft text-ws-soft rounded-ws-sm cursor-pointer text-[11px] flex items-center gap-1"
                >
                  <X size={10} /> Cancel
                </button>
              </div>
            </div>
          ) : (
            <p className="text-xs text-ws-soft leading-normal m-0 whitespace-pre-wrap">
              {chapter.memory || 'Record chapter concepts and formulas for targeted problem evaluation.'}
            </p>
          )}
        </div>

        {/* Instructions card */}
        <div className="bg-ws-bg border border-ws-edge-soft rounded-ws-lg p-4">
          <div className="flex justify-between items-center mb-2.5">
            <span className="font-semibold text-ws-ink text-[13px]">Chapter Instructions</span>
            {!isEditingInst && (
              <button
                type="button"
                onClick={() => setIsEditingInst(true)}
                className="bg-transparent border-0 cursor-pointer text-ws-muted flex p-0.5"
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
                className="w-full min-h-[80px] p-2 bg-ws-bg border border-[var(--ws-glow)] rounded-ws-md text-ws-ink text-xs outline-none font-sans resize-y"
                autoFocus
              />
              <div className="flex gap-1.5 justify-end">
                <button
                  type="button"
                  onClick={handleSaveInst}
                  className="px-2.5 py-1 bg-ws-accent text-ws-bg font-semibold border-0 rounded-ws-sm cursor-pointer text-[11px] flex items-center gap-1"
                >
                  <Save size={10} /> Save
                </button>
                <button
                  type="button"
                  onClick={() => { setInstText(chapter.instructions || ''); setIsEditingInst(false); }}
                  className="px-2.5 py-1 bg-transparent border border-ws-edge-soft text-ws-soft rounded-ws-sm cursor-pointer text-[11px] flex items-center gap-1"
                >
                  <X size={10} /> Cancel
                </button>
              </div>
            </div>
          ) : (
            <p className="text-xs text-ws-soft leading-normal m-0 whitespace-pre-wrap">
              {chapter.instructions || 'Set custom chapter-level prompt variables here.'}
            </p>
          )}
        </div>

        {/* References list */}
        <div>
          <div className="font-semibold text-ws-ink mb-3">
            Subject References
          </div>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-2">
            {subject.resources.map(res => (
              <ResourceCard key={res.id} resource={res} onRemove={() => onRemoveResource(domain.id, subject.id, res.id)} />
            ))}
            {subject.resources.length === 0 && (
              <div className="col-span-full p-6 text-center text-ws-muted text-xs">
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
    <div className="bg-ws-bg border border-ws-edge-soft rounded-ws-md p-3 flex flex-col gap-1.5 relative transition-colors duration-150">
      <button
        type="button"
        onClick={e => { e.stopPropagation(); onRemove(); }}
        className="absolute top-1 right-1 bg-transparent border-0 text-ws-muted cursor-pointer flex p-0.5 transition-colors duration-150 h-cl-danger"
        title="Remove resource"
      >
        <X size={11} />
      </button>

      <div className="text-xs font-medium text-ws-ink break-all leading-tight pr-3">
        {resource.name}
      </div>
      <div className="text-[10px] text-ws-muted">
        {resource.lines.toLocaleString()} lines
      </div>
      <span style={{
        alignSelf: 'flex-start', padding: '2px 6px', fontSize: 10, fontWeight: 700,
        color, background: `color-mix(in srgb, ${color} 15%, transparent)`,
        border: `1px solid ${color}`, borderRadius: "4px",
      }}>
        {resource.fileType}
      </span>
    </div>
  );
}

export default ChapterScreen;
