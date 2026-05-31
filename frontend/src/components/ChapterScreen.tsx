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
    <div style={{display: 'flex', height: '100%', overflow: 'hidden'}}>
      {/* Left column — topics */}
      <div style={{flex: '1 1 60%', display: 'flex', flexDirection: 'column', overflow: 'hidden', borderRight: '1px solid var(--ws-edge-soft)'}}>
        {/* Header */}
        <div style={{padding: '20px 24px 16px'}}>
          <Link
            to="/subject/$domainId/$subjectId"
            params={{ domainId: domain.id, subjectId: subject.id }}
            style={{
              textDecoration: 'none',
              display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none',
              color: "var(--ws-muted)", fontSize: 12, cursor: 'pointer', padding: 0, marginBottom: 12,
            }}
          >
            <ArrowLeft size={14} /> Back to {subject.name}
          </Link>

          <div style={{display: 'flex', alignItems: 'center', gap: 12}}>
            <h1 style={{fontSize: 22, fontWeight: 700, color: "var(--ws-ink)", margin: 0, flex: 1}}>{chapter.name}</h1>
            <button
              type="button"
              onClick={() => setStarred(!starred)}
              style={{background: 'none', border: 'none', cursor: 'pointer', color: starred ? "var(--ws-accent)" : "var(--ws-muted)", display: 'flex'}}
            >
              <Star size={18} fill={starred ? 'currentColor' : 'none'} />
            </button>
          </div>

          <p style={{color: "var(--ws-soft)", fontSize: 13, marginTop: 6, lineHeight: 1.5}}>
            {chapter.description || `Explore learning modules and practice exercises for ${chapter.name}.`}
          </p>
        </div>

        {/* Topics list */}
        <div style={{flex: 1, overflowY: 'auto', padding: '0 24px'}}>
          <div style={{
            fontSize: 10, fontWeight: 700, color: "var(--ws-muted)",
            textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10
          }}>
            Topics & Concepts
          </div>
          
          <div style={{display: 'flex', flexDirection: 'column', gap: 2}}>
            {chapter.topics.map(topic => (
              <Link
                key={topic.id}
                to="/topic/$domainId/$subjectId/$chapterId/$topicId"
                params={{ domainId: domain.id, subjectId: subject.id, chapterId: chapter.id, topicId: topic.id }}
                style={{
                  textDecoration: 'none',
                  display: 'flex', flexDirection: 'column', gap: 2, width: '100%',
                  padding: '12px 14px', background: "var(--ws-bg)", border: '1px solid var(--ws-edge-soft)',
                  borderRadius: "6px", textAlign: 'left', cursor: 'pointer', color: "var(--ws-ink)",
                  transition: 'all 150ms ease',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--ws-accent)"; e.currentTarget.style.background = "var(--ws-surface-2)"; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--ws-line)"; e.currentTarget.style.background = "var(--ws-bg)"; }}
              >
                <span style={{fontSize: 14, fontWeight: 600}}>{topic.name}</span>
                {topic.lastMessage && (
                  <span style={{fontSize: 11, color: "var(--ws-muted)"}}>{topic.lastMessage}</span>
                )}
              </Link>
            ))}

            {/* + New Topic (available inside Chapter view as well) */}
            <Link
              to="/notebook/$domainId/$subjectId"
              params={{ domainId: domain.id, subjectId: subject.id }}
              style={{
                textDecoration: 'none',
                display: 'flex', alignItems: 'center', gap: 6, width: '100%',
                padding: '12px', background: 'none', border: '1px dashed var(--ws-edge)',
                borderRadius: "6px", color: "var(--ws-accent)", cursor: 'pointer',
                fontSize: 13, fontWeight: 500, marginTop: 8, marginBottom: 16,
                transition: 'all 150ms ease',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--ws-accent)"; e.currentTarget.style.background = "rgba(16,185,129,0.1)"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--ws-surface-2)"; e.currentTarget.style.background = 'none'; }}
            >
              <Plus size={14} /> New Topic / Concept
            </Link>
          </div>
        </div>
      </div>

      {/* Right column — metadata + files */}
      <div style={{flex: '1 1 40%', overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 16}}>
        {/* Memory card */}
        <div style={{
          background: "var(--ws-bg)", border: '1px solid var(--ws-edge-soft)',
          borderRadius: 'var(--ws-r-lg)', padding: 16,
        }}>
          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10}}>
            <div style={{display: 'flex', alignItems: 'center', gap: 6}}>
              <span style={{fontWeight: 600, color: "var(--ws-ink)", fontSize: 13}}>Chapter Memory</span>
              <span style={{
                fontSize: 10, color: "var(--ws-muted)", background: "var(--ws-bg)",
                border: '1px solid var(--ws-edge-soft)', padding: '1px 6px', borderRadius: "4px",
                display: 'flex', alignItems: 'center', gap: 3
              }}>
                <Lock size={10} /> Only you
              </span>
            </div>
            {!isEditingMemory && (
              <button
                type="button"
                onClick={() => setIsEditingMemory(true)}
                style={{background: 'none', border: 'none', cursor: 'pointer', color: "var(--ws-muted)", display: 'flex', padding: 2}}
                title="Edit Chapter Memory"
              >
                <Pencil size={13} />
              </button>
            )}
          </div>
          
          {isEditingMemory ? (
            <div style={{display: 'flex', flexDirection: 'column', gap: 8}}>
              <textarea
                value={memoryText}
                onChange={e => setMemoryText(e.target.value)}
                style={{
                  width: '100%', minHeight: 80, padding: 8, background: "var(--ws-bg)",
                  border: '1px solid var(--ws-glow)', borderRadius: "6px",
                  color: "var(--ws-ink)", fontSize: 12, outline: 'none', fontFamily: 'inherit',
                  resize: 'vertical'
                }}
                autoFocus
              />
              <div style={{display: 'flex', gap: 6, justifyContent: 'flex-end'}}>
                <button
                  type="button"
                  onClick={handleSaveMemory}
                  style={{
                    padding: '4px 10px', background: "var(--ws-accent)", color: "var(--ws-bg)",
                    fontWeight: 600, border: 'none', borderRadius: "4px", cursor: 'pointer',
                    fontSize: 11, display: 'flex', alignItems: 'center', gap: 4
                  }}
                >
                  <Save size={10} /> Save
                </button>
                <button
                  type="button"
                  onClick={() => { setMemoryText(chapter.memory || ''); setIsEditingMemory(false); }}
                  style={{
                    padding: '4px 10px', background: 'none', border: '1px solid var(--ws-edge-soft)',
                    color: "var(--ws-soft)", borderRadius: "4px", cursor: 'pointer',
                    fontSize: 11, display: 'flex', alignItems: 'center', gap: 4
                  }}
                >
                  <X size={10} /> Cancel
                </button>
              </div>
            </div>
          ) : (
            <p style={{fontSize: 12, color: "var(--ws-soft)", lineHeight: 1.5, margin: 0, whiteSpace: 'pre-wrap'}}>
              {chapter.memory || 'Record chapter concepts and formulas for targeted problem evaluation.'}
            </p>
          )}
        </div>

        {/* Instructions card */}
        <div style={{
          background: "var(--ws-bg)", border: '1px solid var(--ws-edge-soft)',
          borderRadius: 'var(--ws-r-lg)', padding: 16,
        }}>
          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10}}>
            <span style={{fontWeight: 600, color: "var(--ws-ink)", fontSize: 13}}>Chapter Instructions</span>
            {!isEditingInst && (
              <button
                type="button"
                onClick={() => setIsEditingInst(true)}
                style={{background: 'none', border: 'none', cursor: 'pointer', color: "var(--ws-muted)", display: 'flex', padding: 2}}
                title="Edit Chapter Instructions"
              >
                <Pencil size={13} />
              </button>
            )}
          </div>
          
          {isEditingInst ? (
            <div style={{display: 'flex', flexDirection: 'column', gap: 8}}>
              <textarea
                value={instText}
                onChange={e => setInstText(e.target.value)}
                style={{
                  width: '100%', minHeight: 80, padding: 8, background: "var(--ws-bg)",
                  border: '1px solid var(--ws-glow)', borderRadius: "6px",
                  color: "var(--ws-ink)", fontSize: 12, outline: 'none', fontFamily: 'inherit',
                  resize: 'vertical'
                }}
                autoFocus
              />
              <div style={{display: 'flex', gap: 6, justifyContent: 'flex-end'}}>
                <button
                  type="button"
                  onClick={handleSaveInst}
                  style={{
                    padding: '4px 10px', background: "var(--ws-accent)", color: "var(--ws-bg)",
                    fontWeight: 600, border: 'none', borderRadius: "4px", cursor: 'pointer',
                    fontSize: 11, display: 'flex', alignItems: 'center', gap: 4
                  }}
                >
                  <Save size={10} /> Save
                </button>
                <button
                  type="button"
                  onClick={() => { setInstText(chapter.instructions || ''); setIsEditingInst(false); }}
                  style={{
                    padding: '4px 10px', background: 'none', border: '1px solid var(--ws-edge-soft)',
                    color: "var(--ws-soft)", borderRadius: "4px", cursor: 'pointer',
                    fontSize: 11, display: 'flex', alignItems: 'center', gap: 4
                  }}
                >
                  <X size={10} /> Cancel
                </button>
              </div>
            </div>
          ) : (
            <p style={{fontSize: 12, color: "var(--ws-soft)", lineHeight: 1.5, margin: 0, whiteSpace: 'pre-wrap'}}>
              {chapter.instructions || 'Set custom chapter-level prompt variables here.'}
            </p>
          )}
        </div>

        {/* References list */}
        <div>
          <div style={{fontWeight: 600, color: "var(--ws-ink)", marginBottom: 12}}>
            Subject References
          </div>
          <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 8}}>
            {subject.resources.map(res => (
              <ResourceCard key={res.id} resource={res} onRemove={() => onRemoveResource(domain.id, subject.id, res.id)} />
            ))}
            {subject.resources.length === 0 && (
              <div style={{gridColumn: '1 / -1', padding: 24, textAlign: 'center', color: "var(--ws-muted)", fontSize: 12}}>
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
    <div style={{
      background: "var(--ws-bg)", border: '1px solid var(--ws-edge-soft)',
      borderRadius: "6px", padding: 12,
      display: 'flex', flexDirection: 'column', gap: 6,
      position: 'relative', transition: 'border-color 150ms ease',
    }}
    >
      <button
        type="button"
        onClick={e => { e.stopPropagation(); onRemove(); }}
        style={{
          position: 'absolute', top: 4, right: 4, background: 'none', border: 'none',
          color: "var(--ws-muted)", cursor: 'pointer', display: 'flex', padding: 2,
          transition: 'color 100ms ease'
        }}
        onMouseEnter={e => e.currentTarget.style.color = "#ef4444"}
        onMouseLeave={e => e.currentTarget.style.color = "var(--ws-muted)"}
        title="Remove resource"
      >
        <X size={11} />
      </button>

      <div style={{fontSize: 12, fontWeight: 500, color: "var(--ws-ink)", wordBreak: 'break-all', lineHeight: 1.3, paddingRight: 12}}>
        {resource.name}
      </div>
      <div style={{fontSize: 10, color: "var(--ws-muted)"}}>
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
