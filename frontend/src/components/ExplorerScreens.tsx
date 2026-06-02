import {Plus, Folder, FileText, ArrowLeft, Pin, Archive, Trash2, Edit2, MoreHorizontal, BookOpen, Layers} from 'lucide-react';
import {useState, useMemo} from 'react';
import { Link } from '@tanstack/react-router';
import type {Domain, NavLocation} from '../workspaceTypes';

/* ── ROOT SCREEN (All Domains) ────────────────────────────────────── */
type RootProps = {
  domains: Domain[];
  onNavigate: (loc: NavLocation) => void;
  onOpenCreateModal: (type: 'domain' | 'subject' | 'chapter' | 'topic', domainId?: string, subjectId?: string, chapterId?: string) => void;
  onRenameDomain: (id: string, name: string) => void;
  onDeleteDomain: (id: string) => void;
  onTogglePinDomain: (id: string) => void;
  onToggleArchiveDomain: (id: string) => void;
};

export function RootScreen({
  domains,
  onNavigate,
  onOpenCreateModal,
  onRenameDomain,
  onDeleteDomain,
  onTogglePinDomain,
  onToggleArchiveDomain
}: RootProps) {
  const [contextMenu, setContextMenu] = useState<{id: string; x: number; y: number} | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  const activeDomains = useMemo(() => {
    return domains.filter(d => !d.archived).sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));
  }, [domains]);



  const handleRename = (id: string) => {
    if (renameValue.trim()) {
      onRenameDomain(id, renameValue.trim());
      setRenamingId(null);
    }
  };

  return (
    <div className="screen-container">
      <div className="screen-header flex justify-between items-center">
        <div>
          <h1>Learning Domains</h1>
          <p>Explore your structured practice workspace hierarchy and coordinate resource notebook extraction.</p>
        </div>
        <button
          type="button"
          className="press bg-ws-success text-[#0a0a0b] font-semibold rounded-md py-2 px-4 flex items-center gap-2 hover:brightness-110 transition-[filter,box-shadow] shadow-md"
          onClick={() => onOpenCreateModal('domain')}
        >
          <Plus size={16} /> New Domain
        </button>
      </div>

      <div className="card-grid">
        {activeDomains.map(domain => {
          const totalSubjects = domain.subjects.length;
          const totalChapters = domain.subjects.reduce((acc, s) => acc + s.chapters.length, 0);

          return (
            <Link
              key={domain.id}
              to="/domain/$domainId"
              params={{ domainId: domain.id }}
              className="card no-underline flex flex-col cursor-pointer relative shadow-[0_4px_6px_rgba(0,0,0,0.1)] hover:border-ws-success hover:-translate-y-0.5 group"
            >
              <div className="flex items-center gap-2 mb-2">
                <Folder size={18} className="text-ws-success" />
                {renamingId === domain.id ? (
                  <input
                    type="text"
                    value={renameValue}
                    onChange={e => setRenameValue(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleRename(domain.id); if (e.key === 'Escape') setRenamingId(null); }}
                    onClick={e => e.stopPropagation()}
                    onBlur={() => handleRename(domain.id)}
                    autoFocus
                    className="flex-1 px-1.5 py-0.5 bg-ws-bg border border-ws-success rounded text-ws-ink text-base font-bold outline-none"
                  />
                ) : (
                  <h2 className="text-base font-bold text-ws-ink m-0 overflow-hidden text-ellipsis whitespace-nowrap flex-1">
                    {domain.name}
                  </h2>
                )}

                {domain.pinned && <Pin size={12} className="text-ws-success" />}

                <button
                  type="button"
                  className="press bg-transparent border-none text-ws-muted p-1 rounded hover:text-ws-soft transition-colors"
                  onClick={e => {
                    e.stopPropagation();
                    setContextMenu({id: domain.id, x: e.clientX, y: e.clientY});
                  }}
                >
                  <MoreHorizontal size={16} />
                </button>
              </div>

              {/* Subjects Preview List inside Domain Card */}
              <div className="flex-1 mb-4 flex flex-col gap-2" onClick={e => e.stopPropagation()}>
                {domain.subjects.slice(0, 3).map(sub => {
                  const firstChId = sub.chapters[0]?.id;
                  return (
                    <div
                      key={sub.id}
                      className="press flex items-center justify-between bg-ws-bg border border-ws-line px-2.5 py-1.5 rounded-md transition-[border-color] hover:border-ws-success"
                      onClick={() => onNavigate({level: 'subject', domainId: domain.id, subjectId: sub.id})}
                    >
                      <span className="text-[12px] font-semibold text-ws-ink flex items-center gap-1.5 overflow-hidden text-ellipsis whitespace-nowrap flex-1">
                        <BookOpen size={12} className="text-ws-success shrink-0" />
                        {sub.name}
                      </span>
                      <div className="flex gap-1.5" onClick={e => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => onOpenCreateModal('chapter', domain.id, sub.id)}
                          title="Add Chapter to this subject"
                          className="press bg-transparent border-none text-ws-muted text-[10px] p-0.5 flex items-center gap-0.5 hover:text-ws-success transition-colors"
                        >
                          <Layers size={10} /> <span>+Ch</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => onOpenCreateModal('topic', domain.id, sub.id, firstChId)}
                          title="Add Topic to this subject"
                          className="press bg-transparent border-none text-ws-muted text-[10px] p-0.5 flex items-center gap-0.5 hover:text-ws-success transition-colors"
                        >
                          <Plus size={10} /> <span>+Topic</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
                {totalSubjects > 3 && (
                  <div
                    onClick={() => onNavigate({level: 'domain', domainId: domain.id})}
                    className="text-[11px] text-ws-success cursor-pointer font-semibold pl-1 hover:underline"
                  >
                    View all {totalSubjects} subjects ›
                  </div>
                )}
                {totalSubjects === 0 && (
                  <span className="text-[12px] text-ws-muted italic pl-1">No subjects inside yet.</span>
                )}
              </div>

              {/* Stats footer */}
              <div className="flex justify-between text-[11px] text-ws-muted border-t border-ws-line pt-3">
                <span className="flex items-center gap-1">
                  <Layers size={11} /> {totalSubjects} Subject{totalSubjects !== 1 ? 's' : ''}
                </span>
                <span className="flex items-center gap-1">
                  <BookOpen size={11} /> {totalChapters} Chapter{totalChapters !== 1 ? 's' : ''}
                </span>
              </div>
            </Link>
          );
        })}
      </div>

      {contextMenu && (
        <>
          <div
            className="fixed inset-0 z-[999]"
            onClick={() => setContextMenu(null)}
          />
          <div
            className="fixed z-[1000] bg-ws-bg border border-ws-line rounded-md p-1 min-w-[145px] shadow-[0_8px_24px_rgba(0,0,0,0.5)] scale-in"
            style={{left: contextMenu.x, top: contextMenu.y}}
          >
            {[
              {
                icon: Pin,
                label: domains.find(d => d.id === contextMenu.id)?.pinned ? 'Unpin' : 'Pin',
                action: () => { onTogglePinDomain(contextMenu.id); setContextMenu(null); }
              },
              {
                icon: Archive,
                label: 'Archive',
                action: () => { onToggleArchiveDomain(contextMenu.id); setContextMenu(null); }
              },
              {
                icon: Edit2,
                label: 'Rename',
                action: () => {
                  setRenamingId(contextMenu.id);
                  setRenameValue(domains.find(d => d.id === contextMenu.id)?.name || '');
                  setContextMenu(null);
                }
              },
              {
                icon: Trash2,
                label: 'Delete',
                action: () => {
                  if (confirm('Delete this Domain and all its subjects?')) {
                    onDeleteDomain(contextMenu.id);
                  }
                  setContextMenu(null);
                },
                danger: true
              },
            ].map(item => (
              <button
                key={item.label}
                type="button"
                onClick={item.action}
                className={`press w-full flex items-center gap-2 px-2.5 py-1.5 bg-transparent border-none rounded text-xs text-left transition-colors hover:bg-ws-surface-2 ${(item as {danger?: boolean}).danger ? 'text-red-500' : 'text-ws-muted'}`}
              >
                <item.icon size={12} /> {item.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}


/* ── DOMAIN SCREEN (Subjects inside a Domain) ──────────────────────── */
type DomainProps = {
  domain: Domain;
  onNavigate: (loc: NavLocation) => void;
  onOpenCreateModal: (type: 'domain' | 'subject' | 'chapter' | 'topic', domainId?: string, subjectId?: string, chapterId?: string) => void;
  onRenameSubject: (domainId: string, subjectId: string, name: string) => void;
  onDeleteSubject: (domainId: string, subjectId: string) => void;
};

export function DomainScreen({
  domain,
  onNavigate,
  onOpenCreateModal,
  onRenameSubject,
  onDeleteSubject
}: DomainProps) {
  const [contextMenu, setContextMenu] = useState<{id: string; x: number; y: number} | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  const activeSubjects = useMemo(() => {
    return domain.subjects.filter(s => !s.archived).sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));
  }, [domain]);



  const handleRename = (id: string) => {
    if (renameValue.trim()) {
      onRenameSubject(domain.id, id, renameValue.trim());
      setRenamingId(null);
    }
  };

  return (
    <div className="screen-container">
      <Link
        to="/"
        className="press flex items-center gap-1.5 bg-transparent border-none text-ws-muted text-xs p-0 mb-4 no-underline hover:text-ws-soft transition-colors"
      >
        <ArrowLeft size={14} /> Back to Domains
      </Link>

      <div className="screen-header flex justify-between items-center">
        <div>
          <h1>{domain.name} Subjects</h1>
          <p>Select a subject to open the workspace study dashboard, practice tests, and workflows.</p>
        </div>
        <button
          type="button"
          className="press bg-ws-success text-[#0a0a0b] font-semibold rounded-md py-2 px-4 flex items-center gap-2 hover:brightness-110 transition-[filter,box-shadow] shadow-md"
          onClick={() => onOpenCreateModal('subject', domain.id)}
        >
          <Plus size={16} /> New Subject
        </button>
      </div>

      <div className="card-grid-2">
        {activeSubjects.map(subject => {
          return (
            <Link
              key={subject.id}
              to="/subject/$domainId/$subjectId"
              params={{ domainId: domain.id, subjectId: subject.id }}
              className="card no-underline cursor-pointer relative flex flex-col gap-2 shadow-[0_4px_6px_rgba(0,0,0,0.1)] hover:border-ws-success hover:-translate-y-0.5 group"
            >
              <div className="flex items-center gap-2">
                <FileText size={18} className="text-ws-success" />
                {renamingId === subject.id ? (
                  <input
                    type="text"
                    value={renameValue}
                    onChange={e => setRenameValue(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleRename(subject.id); if (e.key === 'Escape') setRenamingId(null); }}
                    onClick={e => e.stopPropagation()}
                    onBlur={() => handleRename(subject.id)}
                    autoFocus
                    className="flex-1 px-1.5 py-0.5 bg-ws-bg border border-ws-success rounded text-ws-ink text-[15px] font-bold outline-none"
                  />
                ) : (
                  <h2 className="text-[15px] font-bold text-ws-ink m-0 overflow-hidden text-ellipsis whitespace-nowrap flex-1">
                    {subject.name}
                  </h2>
                )}

                <button
                  type="button"
                  className="press bg-transparent border-none text-ws-muted p-1 rounded hover:text-ws-soft transition-colors"
                  onClick={e => {
                    e.stopPropagation();
                    setContextMenu({id: subject.id, x: e.clientX, y: e.clientY});
                  }}
                >
                  <MoreHorizontal size={16} />
                </button>
              </div>

              {subject.description && (
                <p className="text-xs text-ws-muted my-1 mb-3 leading-[1.5] overflow-hidden display-webkit-box webkit-line-clamp-2 webkit-box-orient-vertical line-clamp-2">
                  {subject.description}
                </p>
              )}

              {/* Chapters Preview vertical list inside Subject Card */}
              <div className="flex-1 mb-3 flex flex-col gap-1.5" onClick={e => e.stopPropagation()}>
                {subject.chapters.slice(0, 3).map(ch => (
                  <div
                    key={ch.id}
                    className="press flex items-center justify-between bg-ws-bg border border-ws-line px-2 py-1 rounded-md transition-[border-color] hover:border-ws-success"
                    onClick={() => onNavigate({level: 'chapter', domainId: domain.id, subjectId: subject.id, chapterId: ch.id})}
                  >
                    <span className="text-[11px] font-semibold text-ws-muted flex items-center gap-1 overflow-hidden text-ellipsis whitespace-nowrap flex-1">
                      <Layers size={11} className="text-ws-success shrink-0" />
                      {ch.name}
                    </span>
                      <button
                        type="button"
                        onClick={() => onOpenCreateModal('topic', domain.id, subject.id, ch.id)}
                        title="Add topic/concept directly inside this chapter"
                        className="press bg-transparent border-none text-ws-muted text-[10px] p-0.5 flex items-center gap-0.5 hover:text-ws-success transition-colors"
                      >
                        <Plus size={10} /> <span>Topic</span>
                      </button>
                  </div>
                ))}
                {subject.chapters.length > 3 && (
                  <div
                    onClick={() => onNavigate({level: 'subject', domainId: domain.id, subjectId: subject.id})}
                    className="text-[10.5px] text-ws-success font-semibold cursor-pointer pl-1 hover:underline"
                  >
                    +{subject.chapters.length - 3} more chapters ›
                  </div>
                )}
              </div>

              {/* Subject card footer with quick creation triggers */}
              <div className="flex gap-1.5 border-t border-ws-line pt-2.5 mt-auto" onClick={e => e.stopPropagation()}>
                <button
                  type="button"
                  onClick={() => onOpenCreateModal('chapter', domain.id, subject.id)}
                  className="press flex-1 flex items-center justify-center gap-1 bg-transparent border border-dashed border-ws-line-strong rounded text-ws-success px-2 py-1 text-[11px] font-semibold transition-[border-color,background-color] hover:border-ws-success hover:bg-ws-success/10"
                >
                  <Plus size={11} /> Chapter
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const firstChId = subject.chapters[0]?.id;
                    onOpenCreateModal('topic', domain.id, subject.id, firstChId);
                  }}
                  className="press flex-1 flex items-center justify-center gap-1 bg-transparent border border-dashed border-ws-line-strong rounded text-ws-success px-2 py-1 text-[11px] font-semibold transition-[border-color,background-color] hover:border-ws-success hover:bg-ws-success/10"
                >
                  <Plus size={11} /> Topic
                </button>
              </div>
            </Link>
          );
        })}
      </div>

      {contextMenu && (
        <>
          <div
            className="fixed inset-0 z-[999]"
            onClick={() => setContextMenu(null)}
          />
          <div
            className="fixed z-[1000] bg-ws-bg border border-ws-line rounded-md p-1 min-w-[120px] shadow-[0_8px_24px_rgba(0,0,0,0.5)] scale-in"
            style={{left: contextMenu.x, top: contextMenu.y}}
          >
            {[
              {
                icon: Edit2,
                label: 'Rename',
                action: () => {
                  setRenamingId(contextMenu.id);
                  setRenameValue(domain.subjects.find(s => s.id === contextMenu.id)?.name || '');
                  setContextMenu(null);
                }
              },
              {
                icon: Trash2,
                label: 'Delete',
                action: () => {
                  if (confirm('Delete this subject and all its chapters?')) {
                    onDeleteSubject(domain.id, contextMenu.id);
                  }
                  setContextMenu(null);
                },
                danger: true
              },
            ].map(item => (
              <button
                key={item.label}
                type="button"
                onClick={item.action}
                className={`press w-full flex items-center gap-2 px-2.5 py-1.5 bg-transparent border-none rounded text-xs text-left transition-colors hover:bg-ws-surface-2 ${(item as {danger?: boolean}).danger ? 'text-red-500' : 'text-ws-muted'}`}
              >
                <item.icon size={12} /> {item.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
