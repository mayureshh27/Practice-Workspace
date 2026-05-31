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
    <div style={{display: 'flex', height: '100%', overflow: 'hidden'}}>
      {/* Left column — topics */}
      <div style={{flex: '1 1 60%', display: 'flex', flexDirection: 'column', overflow: 'hidden', borderRight: '1px solid var(--ws-edge-soft)'}}>
        {/* Header */}
        <div style={{padding: '20px 24px 16px'}}>
          <Link
            to="/"
            style={{
              textDecoration: 'none',
              display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none',
              color: "var(--ws-muted)", fontSize: 12, cursor: 'pointer', padding: 0, marginBottom: 12,
            }}
          >
            <ArrowLeft size={14} /> All Domains
          </Link>

          <div style={{display: 'flex', alignItems: 'center', gap: 12}}>
            <h1 style={{fontSize: 22, fontWeight: 700, color: "var(--ws-ink)", margin: 0, flex: 1}}>{subject.name}</h1>
            <button
              type="button"
              onClick={() => setStarred(!starred)}
              style={{background: 'none', border: 'none', cursor: 'pointer', color: starred ? "var(--ws-accent)" : "var(--ws-muted)", display: 'flex'}}
            >
              <Star size={18} fill={starred ? 'currentColor' : 'none'} />
            </button>
            <button
              type="button"
              style={{background: 'none', border: 'none', cursor: 'pointer', color: "var(--ws-muted)", display: 'flex'}}
            >
              <MoreHorizontal size={18} />
            </button>
          </div>

          {subject.description && (
            <p style={{color: "var(--ws-soft)", fontSize: 13, marginTop: 6, lineHeight: 1.5}}>{subject.description}</p>
          )}
        </div>

        {/* Chat input placeholder */}
        <div style={{padding: '0 24px 16px'}}>
          <div style={{
            background: "var(--ws-bg)", border: '1px solid var(--ws-edge)',
            borderRadius: 'var(--ws-r-lg)', padding: '12px 16px',
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <MessageCircle size={16} style={{color: "var(--ws-muted)"}} />
            <span style={{color: "var(--ws-muted)", fontSize: 13}}>How can I help you today?</span>
          </div>
        </div>

        {/* Topics list */}
        <div style={{flex: 1, overflowY: 'auto', padding: '0 12px'}}>
          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 12px 10px', borderBottom: '1px solid var(--ws-edge-soft)', marginBottom: 12}}>
            <span style={{fontSize: 11, fontWeight: 700, color: "var(--ws-muted)", textTransform: 'uppercase', letterSpacing: '0.05em'}}>Chapters</span>
            <button
              type="button"
              onClick={() => onOpenCreateModal('chapter', domain.id, subject.id)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer', color: "var(--ws-accent)",
                fontSize: 11, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4, padding: '2px 6px',
                borderRadius: "4px", transition: 'background 100ms ease'
              }}
              onMouseEnter={e => e.currentTarget.style.background = "rgba(16,185,129,0.1)"}
              onMouseLeave={e => e.currentTarget.style.background = 'none'}
            >
              <Plus size={12} /> New Chapter
            </button>
          </div>

          {subject.chapters.map((ch, idx) => {
            return (
              <div
                key={ch.id}
                style={{
                  background: "var(--ws-bg)",
                  border: '1px solid var(--ws-edge-soft)',
                  borderRadius: 'var(--ws-r-lg)',
                  marginBottom: 20,
                  overflow: 'hidden',
                  transition: 'border-color 150ms ease, background-color 150ms ease',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = "var(--ws-surface-2)";
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = "var(--ws-line)";
                }}
              >
                {/* Chapter Header */}
                <div
                  style={{
                    background: "var(--ws-surface-2)",
                    padding: '14px 16px',
                    borderBottom: '1px solid var(--ws-edge-soft)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                  }}
                >
                  <div style={{minWidth: 0, flex: 1, display: 'flex', gap: 10, alignItems: 'center'}}>
                    {/* Visual Badge representing Chapter Index */}
                    <div
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: '50%',
                        background: "var(--ws-bg)",
                        border: '1px solid var(--ws-edge-soft)',
                        color: "var(--ws-ink)",
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 11,
                        fontWeight: 700,
                        flexShrink: 0
                      }}
                    >
                      {idx + 1}
                    </div>

                    <div style={{minWidth: 0, flex: 1}}>
                      <Link
                        to="/chapter/$domainId/$subjectId/$chapterId"
                        params={{ domainId: domain.id, subjectId: subject.id, chapterId: ch.id }}
                        style={{
                          textDecoration: 'none',
                          fontSize: 14,
                          fontWeight: 700,
                          color: "var(--ws-ink)",
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          transition: 'color 150ms ease'
                        }}
                        onMouseEnter={e => e.currentTarget.style.color = "var(--ws-accent)"}
                        onMouseLeave={e => e.currentTarget.style.color = "var(--ws-ink)"}
                      >
                        {ch.name}
                      </Link>
                      {ch.description && (
                        <div style={{fontSize: 11, color: "var(--ws-muted)", marginTop: 2, lineHeight: 1.4}}>
                          {ch.description}
                        </div>
                      )}
                    </div>
                  </div>

                  <div style={{display: 'flex', gap: 6, flexShrink: 0}}>
                    <button
                      type="button"
                      onClick={() => onOpenCreateModal('topic', domain.id, subject.id, ch.id)}
                      title="Add new topic or concept inside this chapter"
                      style={{
                        background: 'none',
                        border: '1px solid var(--ws-edge-soft)',
                        borderRadius: "4px",
                        color: "var(--ws-accent)",
                        fontSize: 11,
                        fontWeight: 600,
                        padding: '4px 8px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                        transition: 'all 150ms ease',
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.borderColor = "var(--ws-accent)";
                        e.currentTarget.style.background = "rgba(16,185,129,0.1)";
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.borderColor = "var(--ws-line)";
                        e.currentTarget.style.background = 'none';
                      }}
                    >
                      <Plus size={11} /> Topic
                    </button>
                    <Link
                      to="/chapter/$domainId/$subjectId/$chapterId"
                      params={{ domainId: domain.id, subjectId: subject.id, chapterId: ch.id }}
                      style={{
                        textDecoration: 'none',
                        background: 'none',
                        border: '1px solid var(--ws-edge-soft)',
                        borderRadius: "4px",
                        color: "var(--ws-soft)",
                        fontSize: 11,
                        fontWeight: 600,
                        padding: '4px 8px',
                        cursor: 'pointer',
                        transition: 'all 150ms ease',
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = "var(--ws-surface-2)"}
                      onMouseLeave={e => e.currentTarget.style.background = 'none'}
                    >
                      Open Chapter
                    </Link>
                  </div>
                </div>

                {/* Topics list inside the card */}
                <div style={{display: 'flex', flexDirection: 'column'}}>
                  {ch.topics.map((topic, tIdx) => (
                    <Link
                      key={topic.id}
                      to="/topic/$domainId/$subjectId/$chapterId/$topicId"
                      params={{ domainId: domain.id, subjectId: subject.id, chapterId: ch.id, topicId: topic.id }}
                      style={{
                        textDecoration: 'none',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        width: '100%',
                        padding: '12px 16px',
                        background: 'none',
                        border: 'none',
                        borderBottom: tIdx < ch.topics.length - 1 ? '1px solid var(--ws-edge-soft)' : 'none',
                        textAlign: 'left',
                        cursor: 'pointer',
                        color: "var(--ws-ink)",
                        transition: 'background 100ms ease',
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.background = "var(--ws-surface-2)";
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.background = 'none';
                      }}
                    >
                      <div
                        style={{
                          width: 20,
                          height: 20,
                          borderRadius: "4px",
                          background: "var(--ws-bg)",
                          border: '1px solid var(--ws-edge-soft)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: "var(--ws-muted)",
                          flexShrink: 0
                        }}
                      >
                        <FileCode size={12} />
                      </div>
                      <div style={{flex: 1, minWidth: 0}}>
                        <div style={{fontSize: 13, fontWeight: 500, color: "var(--ws-ink)"}}>{topic.name}</div>
                        {topic.lastMessage && (
                          <div style={{fontSize: 10, color: "var(--ws-muted)", marginTop: 2}}>{topic.lastMessage}</div>
                        )}
                      </div>
                      <span style={{
                        fontSize: 10,
                        padding: '2px 6px',
                        background: "var(--ws-bg)",
                        color: "var(--ws-muted)",
                        border: '1px solid var(--ws-edge-soft)',
                        borderRadius: 3,
                        fontWeight: 500
                      }}>
                        Open Exercise
                      </span>
                    </Link>
                  ))}
                  {ch.topics.length === 0 && (
                    <div style={{padding: '24px 16px', textAlign: 'center', color: "var(--ws-muted)", fontSize: 12, fontStyle: 'italic'}}>
                      No topics inside this chapter yet. Click "+ Topic" to add one!
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
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              width: '100%',
              padding: '14px',
              background: 'none',
              border: '1px dashed var(--ws-edge)',
              borderRadius: 'var(--ws-r-lg)',
              color: "var(--ws-accent)",
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 600,
              marginTop: 8,
              marginBottom: 24,
              transition: 'all 150ms ease',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = "var(--ws-accent)";
              e.currentTarget.style.background = "rgba(16,185,129,0.1)";
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = "var(--ws-surface-2)";
              e.currentTarget.style.background = 'none';
            }}
          >
            <Plus size={14} /> Add New Chapter
          </button>
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
              <span style={{fontWeight: 600, color: "var(--ws-ink)", fontSize: 13}}>Memory</span>
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
                title="Edit Memory"
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
                  onClick={() => { setMemoryText(subject.memory || ''); setIsEditingMemory(false); }}
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
              {subject.memory || 'No memory recorded. Click the pencil icon to align the learning tutor.'}
            </p>
          )}
        </div>

        {/* Instructions card */}
        <div style={{
          background: "var(--ws-bg)", border: '1px solid var(--ws-edge-soft)',
          borderRadius: 'var(--ws-r-lg)', padding: 16,
        }}>
          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10}}>
            <span style={{fontWeight: 600, color: "var(--ws-ink)", fontSize: 13}}>Instructions</span>
            {!isEditingInst && (
              <button
                type="button"
                onClick={() => setIsEditingInst(true)}
                style={{background: 'none', border: 'none', cursor: 'pointer', color: "var(--ws-muted)", display: 'flex', padding: 2}}
                title="Edit Instructions"
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
                  onClick={() => { setInstText(subject.instructions || ''); setIsEditingInst(false); }}
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
              {subject.instructions || 'Define study focus and workspace constraints here.'}
            </p>
          )}
        </div>

        {/* Files grid */}
        <div>
          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12}}>
            <span style={{fontWeight: 600, color: "var(--ws-ink)"}}>Files</span>
            <Link
              to="/notebook/$domainId/$subjectId"
              params={{ domainId: domain.id, subjectId: subject.id }}
              style={{background: 'none', border: 'none', cursor: 'pointer', color: "var(--ws-muted)", display: 'flex'}}
              title="Add files"
            >
              <Plus size={16} />
            </Link>
          </div>
          <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 8}}>
            {subject.resources.map(res => (
              <ResourceCard key={res.id} resource={res} onRemove={() => onRemoveResource(domain.id, subject.id, res.id)} />
            ))}
            {subject.resources.length === 0 && (
              <div style={{gridColumn: '1 / -1', padding: 24, textAlign: 'center', color: "var(--ws-muted)", fontSize: 12}}>
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

export default SubjectScreen;
