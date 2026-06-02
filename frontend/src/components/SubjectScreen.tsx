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
    <div className="flex h-full overflow-hidden">
      {/* Left column — topics */}
      <div className="flex-[1_1_60%] flex flex-col overflow-hidden border-r border-ws-edge-soft border-solid">
        {/* Header */}
        <div className="screen-header px-6 pt-5 pb-4">
          <Link
            to="/"
            className="no-underline flex items-center gap-1.5 bg-transparent border-0 text-ws-muted text-xs cursor-pointer p-0 mb-3"
          >
            <ArrowLeft size={14} /> All Domains
          </Link>

          <div className="flex items-center gap-3">
            <h1 className="text-[22px] font-bold text-ws-ink m-0 flex-1">{subject.name}</h1>
            <button
              type="button"
              onClick={() => setStarred(!starred)}
              className={`bg-transparent border-0 cursor-pointer flex ${starred ? 'text-ws-accent' : 'text-ws-muted'}`}
            >
              <Star size={18} fill={starred ? 'currentColor' : 'none'} />
            </button>
            <button
              type="button"
              className="bg-transparent border-0 cursor-pointer text-ws-muted flex"
            >
              <MoreHorizontal size={18} />
            </button>
          </div>

          {subject.description && (
            <p className="text-ws-soft text-[13px] mt-1.5 leading-normal">{subject.description}</p>
          )}
        </div>

        {/* Chat input placeholder */}
        <div className="px-6 pb-4">
          <div className="bg-ws-bg border border-ws-edge rounded-ws-lg px-4 py-3 flex items-center gap-2">
            <MessageCircle size={16} className="text-ws-muted shrink-0" />
            <span className="text-ws-muted text-[13px]">How can I help you today?</span>
          </div>
        </div>

        {/* Topics list */}
        <div className="flex-1 overflow-y-auto px-6">
          <div className="flex justify-between items-center px-3 pt-1 pb-2.5 border-b border-ws-edge-soft border-solid mb-3">
            <span className="text-[11px] font-bold text-ws-muted uppercase tracking-wider">Chapters</span>
            <button
              type="button"
              onClick={() => onOpenCreateModal('chapter', domain.id, subject.id)}
              className="bg-transparent border-0 cursor-pointer text-ws-accent text-[11px] font-semibold flex items-center gap-1 px-1.5 py-0.5 rounded-ws-sm transition-colors duration-100 h-accent-tint"
            >
              <Plus size={12} /> New Chapter
            </button>
          </div>

          {subject.chapters.map((ch, idx) => {
            return (
              <div
                key={ch.id}
                className="bg-ws-bg border border-ws-edge-soft border-solid rounded-ws-lg mb-5 overflow-hidden transition-colors duration-150 h-bd-surface-2"
              >
                {/* Chapter Header */}
                <div className="bg-ws-surface-2 px-4 py-3.5 border-b border-ws-edge-soft border-solid flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1 flex gap-2.5 items-center">
                    <div className="w-7 h-7 rounded-full bg-ws-bg border border-ws-edge-soft border-solid text-ws-ink flex items-center justify-center text-[11px] font-bold shrink-0">
                      {idx + 1}
                    </div>

                    <div className="min-w-0 flex-1">
                      <Link
                        to="/chapter/$domainId/$subjectId/$chapterId"
                        params={{ domainId: domain.id, subjectId: subject.id, chapterId: ch.id }}
                        className="no-underline text-sm font-bold text-ws-ink cursor-pointer inline-flex items-center gap-1.5 transition-colors duration-150 h-cl-accent"
                      >
                        {ch.name}
                      </Link>
                      {ch.description && (
                        <div className="text-[11px] text-ws-muted mt-0.5 leading-[1.4]">
                          {ch.description}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => onOpenCreateModal('topic', domain.id, subject.id, ch.id)}
                      title="Add new topic or concept inside this chapter"
                      className="bg-transparent border border-ws-edge-soft border-solid rounded-ws-sm text-ws-accent text-[11px] font-semibold px-2 py-1 cursor-pointer flex items-center gap-1 transition-all duration-150 h-bd-accent h-accent-tint"
                    >
                      <Plus size={11} /> Topic
                    </button>
                    <Link
                      to="/chapter/$domainId/$subjectId/$chapterId"
                      params={{ domainId: domain.id, subjectId: subject.id, chapterId: ch.id }}
                      className="no-underline bg-transparent border border-ws-edge-soft border-solid rounded-ws-sm text-ws-soft text-[11px] font-semibold px-2 py-1 cursor-pointer transition-all duration-150 h-surface-2"
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
                      className={`no-underline flex items-center gap-2.5 w-full px-4 py-3 bg-transparent border-0 text-left cursor-pointer text-ws-ink transition-colors duration-100 h-surface-2 ${tIdx < ch.topics.length - 1 ? 'border-b border-ws-edge-soft border-solid' : ''}`}
                    >
                      <div className="w-5 h-5 rounded-ws-sm bg-ws-bg border border-ws-edge-soft border-solid flex items-center justify-center text-ws-muted shrink-0">
                        <FileCode size={12} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] font-medium text-ws-ink">{topic.name}</div>
                        {topic.lastMessage && (
                          <div className="text-[10px] text-ws-muted mt-0.5">{topic.lastMessage}</div>
                        )}
                      </div>
                      <span className="text-[10px] px-1.5 py-0.5 bg-ws-bg text-ws-muted border border-ws-edge-soft border-solid rounded-[3px] font-medium">
                        Open Exercise
                      </span>
                    </Link>
                  ))}
                  {ch.topics.length === 0 && (
                    <div className="px-4 py-6 text-center text-ws-muted text-xs italic">
                      No topics inside this chapter yet. Click &quot;+ Topic&quot; to add one!
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* + New Chapter (Subject root link) */}
          <button
            type="button"
            onClick={() => onOpenCreateModal('chapter', domain.id, subject.id)}
            className="flex items-center justify-center gap-2 w-full p-3.5 bg-transparent border border-dashed border-ws-edge border-solid rounded-ws-lg text-ws-accent cursor-pointer text-[13px] font-semibold mt-2 mb-6 transition-all duration-150 h-bd-accent h-accent-tint"
          >
            <Plus size={14} /> Add New Chapter
          </button>
        </div>
      </div>

      {/* Right column — metadata + files */}
      <div className="flex-[1_1_40%] overflow-y-auto p-5 flex flex-col gap-4">
        {/* Memory card */}
        <div className="screen-section">
          <div className="bg-ws-bg border border-ws-edge-soft border-solid rounded-ws-lg p-4">
            <div className="flex justify-between items-center mb-2.5">
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-ws-ink text-[13px]">Memory</span>
                <span className="text-[10px] text-ws-muted bg-ws-bg border border-ws-edge-soft border-solid px-1.5 py-[1px] rounded-ws-sm flex items-center gap-[3px]">
                  <Lock size={10} /> Only you
                </span>
              </div>
              {!isEditingMemory && (
              <button
                  type="button"
                  onClick={() => setIsEditingMemory(true)}
                  className="bg-transparent border-0 cursor-pointer text-ws-muted flex p-0.5"
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
                  className="w-full min-h-20 p-2 bg-ws-bg border border-[var(--ws-glow)] rounded-ws-md text-ws-ink text-xs outline-none resize-y"
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
                    onClick={() => { setMemoryText(subject.memory || ''); setIsEditingMemory(false); }}
                    className="px-2.5 py-1 bg-transparent border border-ws-edge-soft border-solid text-ws-soft rounded-ws-sm cursor-pointer text-[11px] flex items-center gap-1"
                  >
                    <X size={10} /> Cancel
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-xs text-ws-soft leading-normal m-0 whitespace-pre-wrap">
                {subject.memory || 'No memory recorded. Click the pencil icon to align the learning tutor.'}
              </p>
            )}
          </div>
        </div>

        {/* Instructions card */}
        <div className="screen-section">
          <div className="bg-ws-bg border border-ws-edge-soft border-solid rounded-ws-lg p-4">
            <div className="flex justify-between items-center mb-2.5">
              <span className="font-semibold text-ws-ink text-[13px]">Instructions</span>
              {!isEditingInst && (
                <button
                  type="button"
                  onClick={() => setIsEditingInst(true)}
                  className="bg-transparent border-0 cursor-pointer text-ws-muted flex p-0.5"
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
                  className="w-full min-h-20 p-2 bg-ws-bg border border-[var(--ws-glow)] rounded-ws-md text-ws-ink text-xs outline-none resize-y"
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
                    onClick={() => { setInstText(subject.instructions || ''); setIsEditingInst(false); }}
                    className="px-2.5 py-1 bg-transparent border border-ws-edge-soft border-solid text-ws-soft rounded-ws-sm cursor-pointer text-[11px] flex items-center gap-1"
                  >
                    <X size={10} /> Cancel
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-xs text-ws-soft leading-normal m-0 whitespace-pre-wrap">
                {subject.instructions || 'Define study focus and workspace constraints here.'}
              </p>
            )}
          </div>
        </div>

        {/* Files grid */}
        <div className="screen-section">
          <div className="flex justify-between items-center mb-3">
            <span className="font-semibold text-ws-ink">Files</span>
            <Link
              to="/notebook/$domainId/$subjectId"
              params={{ domainId: domain.id, subjectId: subject.id }}
              className="bg-transparent border-0 cursor-pointer text-ws-muted flex"
              title="Add files"
            >
              <Plus size={16} />
            </Link>
          </div>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-2">
            {subject.resources.map(res => (
              <ResourceCard key={res.id} resource={res} onRemove={() => onRemoveResource(domain.id, subject.id, res.id)} />
            ))}
            {subject.resources.length === 0 && (
              <div className="col-span-full p-6 text-center text-ws-muted text-xs">
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
    <div className="bg-ws-bg border border-ws-edge-soft border-solid rounded-ws-md p-3 flex flex-col gap-1.5 relative transition-colors duration-150">
      <button
        type="button"
        onClick={e => { e.stopPropagation(); onRemove(); }}
        className="absolute top-1 right-1 bg-transparent border-0 text-ws-muted cursor-pointer flex p-0.5 transition-colors duration-100 h-cl-danger"
        title="Remove resource"
      >
        <X size={11} />
      </button>

      <div className="text-xs font-medium text-ws-ink break-all leading-[1.3] pr-3">
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

export default SubjectScreen;
