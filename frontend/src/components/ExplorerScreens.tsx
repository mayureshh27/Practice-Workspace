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
    <div className="p-4 h-full flex flex-col overflow-hidden bg-ws-floor text-ws-ink">
      <div className="flex-1 flex flex-col overflow-hidden bg-ws-bench border border-ws-line rounded-xl shadow-md p-6 max-w-[1200px] mx-auto w-full">
        <div className="flex justify-between items-center mb-6 shrink-0">
          <div>
            <h1 className="text-xl font-extrabold text-ws-ink m-0 mb-1.5 tracking-tight">
              Learning Domains
            </h1>
            <p className="text-[13px] text-ws-muted m-0">
              Explore your structured practice workspace hierarchy and coordinate resource notebook extraction.
            </p>
          </div>
          <button
            type="button"
            className="bg-ws-glow text-ws-floor font-bold rounded-md py-2 px-4 flex items-center gap-2 hover:brightness-110 transition-all cursor-pointer shadow-md text-[13px]"
            onClick={() => onOpenCreateModal('domain')}
          >
            <Plus size={14} /> New Domain
          </button>
        </div>

        <div className="flex-1 overflow-y-auto pr-1 grid grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-4 scrollbar">
          {activeDomains.map(domain => {
            const totalSubjects = domain.subjects.length;
            const totalChapters = domain.subjects.reduce((acc, s) => acc + s.chapters.length, 0);

            return (
              <Link
                key={domain.id}
                to="/domain/$domainId"
                params={{ domainId: domain.id }}
                className="no-underline flex flex-col bg-ws-bg border border-ws-line rounded-lg p-5 cursor-pointer relative transition-all duration-200 shadow-sm hover:border-ws-glow hover:-translate-y-0.5 group"
              >
                <div className="flex items-center gap-2 mb-3 shrink-0">
                  <Folder size={16} className="text-ws-glow" />
                  {renamingId === domain.id ? (
                    <input
                      type="text"
                      value={renameValue}
                      onChange={e => setRenameValue(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleRename(domain.id); if (e.key === 'Escape') setRenamingId(null); }}
                      onClick={e => e.stopPropagation()}
                      onBlur={() => handleRename(domain.id)}
                      autoFocus
                      className="flex-1 px-1.5 py-0.5 bg-ws-floor border border-ws-glow rounded text-ws-ink text-sm font-bold outline-none"
                    />
                  ) : (
                    <h2 className="text-[14px] font-extrabold text-ws-ink m-0 overflow-hidden text-ellipsis whitespace-nowrap flex-1 tracking-tight">
                      {domain.name}
                    </h2>
                  )}
                  
                  {domain.pinned && <Pin size={12} className="text-ws-glow" />}
                  
                  <button
                    type="button"
                    className="bg-transparent border-none text-ws-muted cursor-pointer p-1 rounded hover:text-ws-ink"
                    onClick={e => {
                      e.stopPropagation();
                      setContextMenu({id: domain.id, x: e.clientX, y: e.clientY});
                    }}
                  >
                    <MoreHorizontal size={14} />
                  </button>
                </div>

                {/* Subjects Preview List inside Domain Card */}
                <div className="flex-1 mb-4 flex flex-col gap-2" onClick={e => e.stopPropagation()}>
                  {domain.subjects.slice(0, 3).map(sub => {
                    const firstChId = sub.chapters[0]?.id;
                    return (
                      <div
                        key={sub.id}
                        className="flex items-center justify-between bg-ws-bench border border-ws-line px-2.5 py-1.5 rounded-md cursor-pointer transition-all duration-150 hover:border-ws-glow"
                        onClick={() => onNavigate({level: 'subject', domainId: domain.id, subjectId: sub.id})}
                      >
                        <span className="text-[12px] font-semibold text-ws-ink flex items-center gap-1.5 overflow-hidden text-ellipsis whitespace-nowrap flex-1">
                          <BookOpen size={12} className="text-ws-glow shrink-0" />
                          {sub.name}
                        </span>
                        <div className="flex gap-1.5" onClick={e => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => onOpenCreateModal('chapter', domain.id, sub.id)}
                            title="Add Chapter to this subject"
                            className="bg-transparent border-none cursor-pointer text-ws-muted text-[10px] p-0.5 flex items-center gap-0.5 hover:text-ws-glow transition-colors"
                          >
                            <Layers size={10} /> <span>+Ch</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => onOpenCreateModal('topic', domain.id, sub.id, firstChId)}
                            title="Add Topic to this subject"
                            className="bg-transparent border-none cursor-pointer text-ws-muted text-[10px] p-0.5 flex items-center gap-0.5 hover:text-ws-glow transition-colors"
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
                      className="text-[11px] text-ws-glow cursor-pointer font-semibold pl-1 hover:underline"
                    >
                      View all {totalSubjects} subjects ›
                    </div>
                  )}
                  {totalSubjects === 0 && (
                    <span className="text-[12px] text-ws-muted italic pl-1">No subjects inside yet.</span>
                  )}
                </div>

                {/* Stats footer */}
                <div className="flex justify-between text-[11px] text-ws-muted border-t border-ws-line pt-3 mt-auto">
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
      </div>

      {contextMenu && (
        <>
          <div
            className="fixed inset-0 z-[999]"
            onClick={() => setContextMenu(null)}
          />
          <div 
            className="fixed z-[1000] bg-ws-bg border border-ws-line rounded-md p-1 min-w-[145px] shadow-[0_8px_24px_rgba(0,0,0,0.5)]"
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
                className={`w-full flex items-center gap-2 px-2.5 py-1.5 bg-transparent border-none rounded text-xs cursor-pointer text-left transition-colors hover:bg-ws-surface-2 ${(item as {danger?: boolean}).danger ? 'text-red-500' : 'text-ws-muted'}`}
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
    <div className="p-4 h-full flex flex-col overflow-hidden bg-ws-floor text-ws-ink">
      <div className="flex-1 flex flex-col overflow-hidden bg-ws-bench border border-ws-line rounded-xl shadow-md p-6 max-w-[1200px] mx-auto w-full">
        <Link
          to="/"
          className="flex items-center gap-1.5 bg-transparent border-none text-ws-muted text-xs cursor-pointer p-0 mb-4 no-underline hover:text-ws-ink transition-colors shrink-0"
        >
          <ArrowLeft size={14} /> Back to Domains
        </Link>

        <div className="flex justify-between items-center mb-6 shrink-0">
          <div>
            <h1 className="text-xl font-extrabold text-ws-ink m-0 mb-1.5 tracking-tight">
              {domain.name} Subjects
            </h1>
            <p className="text-[13px] text-ws-muted m-0">
              Select a subject to open the workspace study dashboard, practice tests, and workflows.
            </p>
          </div>
          <button
            type="button"
            className="bg-ws-glow text-ws-floor font-bold rounded-md py-2 px-4 flex items-center gap-2 hover:brightness-110 transition-all cursor-pointer shadow-md text-[13px]"
            onClick={() => onOpenCreateModal('subject', domain.id)}
          >
            <Plus size={14} /> New Subject
          </button>
        </div>

        <div className="flex-1 overflow-y-auto pr-1 grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4 scrollbar">
          {activeSubjects.map(subject => {
            return (
              <Link
                key={subject.id}
                to="/subject/$domainId/$subjectId"
                params={{ domainId: domain.id, subjectId: subject.id }}
                className="no-underline bg-ws-bg border border-ws-line rounded-lg p-5 cursor-pointer relative flex flex-col gap-2 transition-all duration-200 shadow-sm hover:border-ws-glow hover:-translate-y-0.5 group"
              >
                <div className="flex items-center gap-2">
                  <FileText size={16} className="text-ws-glow" />
                  {renamingId === subject.id ? (
                    <input
                      type="text"
                      value={renameValue}
                      onChange={e => setRenameValue(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleRename(subject.id); if (e.key === 'Escape') setRenamingId(null); }}
                      onClick={e => e.stopPropagation()}
                      onBlur={() => handleRename(subject.id)}
                      autoFocus
                      className="flex-1 px-1.5 py-0.5 bg-ws-floor border border-ws-glow rounded text-ws-ink text-sm font-bold outline-none"
                    />
                  ) : (
                    <h2 className="text-[14px] font-extrabold text-ws-ink m-0 overflow-hidden text-ellipsis whitespace-nowrap flex-1 tracking-tight">
                      {subject.name}
                    </h2>
                  )}

                  <button
                    type="button"
                    className="bg-transparent border-none text-ws-muted cursor-pointer p-1 rounded hover:text-ws-ink"
                    onClick={e => {
                      e.stopPropagation();
                      setContextMenu({id: subject.id, x: e.clientX, y: e.clientY});
                    }}
                  >
                    <MoreHorizontal size={14} />
                  </button>
                </div>

                {subject.description && (
                  <p className="text-xs text-ws-muted my-1 mb-3 leading-[1.5] overflow-hidden line-clamp-2">
                    {subject.description}
                  </p>
                )}

                {/* Chapters Preview vertical list inside Subject Card */}
                <div className="flex-1 mb-3 flex flex-col gap-1.5" onClick={e => e.stopPropagation()}>
                  {subject.chapters.slice(0, 3).map(ch => (
                    <div
                      key={ch.id}
                      className="flex items-center justify-between bg-ws-bench border border-ws-line px-2.5 py-1.5 rounded-md cursor-pointer transition-all duration-150 hover:border-ws-glow"
                      onClick={() => onNavigate({level: 'chapter', domainId: domain.id, subjectId: subject.id, chapterId: ch.id})}
                    >
                      <span className="text-[11px] font-semibold text-ws-ink flex items-center gap-1 overflow-hidden text-ellipsis whitespace-nowrap flex-1">
                        <Layers size={11} className="text-ws-glow shrink-0" />
                        {ch.name}
                      </span>
                      <button
                        type="button"
                        onClick={() => onOpenCreateModal('topic', domain.id, subject.id, ch.id)}
                        title="Add topic/concept directly inside this chapter"
                        className="bg-transparent border-none cursor-pointer text-ws-muted text-[10px] p-0.5 flex items-center gap-0.5 hover:text-ws-glow transition-colors"
                      >
                        <Plus size={10} /> <span>Topic</span>
                      </button>
                    </div>
                  ))}
                  {subject.chapters.length > 3 && (
                    <div
                      onClick={() => onNavigate({level: 'subject', domainId: domain.id, subjectId: subject.id})}
                      className="text-[10.5px] text-ws-glow font-semibold cursor-pointer pl-1 hover:underline"
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
                    className="flex-1 flex items-center justify-center gap-1 bg-transparent border border-dashed border-ws-line rounded text-ws-glow px-2 py-1 text-[11px] font-bold cursor-pointer transition-all duration-150 hover:border-ws-glow hover:bg-ws-glow/5"
                  >
                    <Plus size={11} /> Chapter
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const firstChId = subject.chapters[0]?.id;
                      onOpenCreateModal('topic', domain.id, subject.id, firstChId);
                    }}
                    className="flex-1 flex items-center justify-center gap-1 bg-transparent border border-dashed border-ws-line rounded text-ws-glow px-2 py-1 text-[11px] font-bold cursor-pointer transition-all duration-150 hover:border-ws-glow hover:bg-ws-glow/5"
                  >
                    <Plus size={11} /> Topic
                  </button>
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      {contextMenu && (
        <>
          <div
            className="fixed inset-0 z-[999]"
            onClick={() => setContextMenu(null)}
          />
          <div 
            className="fixed z-[1000] bg-ws-bg border border-ws-line rounded-md p-1 min-w-[120px] shadow-[0_8px_24px_rgba(0,0,0,0.5)]"
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
                className={`w-full flex items-center gap-2 px-2.5 py-1.5 bg-transparent border-none rounded text-xs cursor-pointer text-left transition-colors hover:bg-ws-surface-2 ${(item as {danger?: boolean}).danger ? 'text-red-500' : 'text-ws-muted'}`}
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
