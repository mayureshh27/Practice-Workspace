import {Search, ChevronRight, ChevronDown, ChevronLeft, FolderOpen, Folder, LayoutGrid, Workflow, GitBranch, Pin, Archive, Trash2, Edit2, Plus, MoreHorizontal, BookOpen, Layers, FileCode, History, Settings2, Check, ArrowUpRight, PanelLeftClose, PanelLeftOpen} from 'lucide-react';
import {useState, useMemo} from 'react';
import type {RecentItem} from '../workspaceTypes';

import { useWorkspaceStore } from '../stores/workspaceStore';
import { useUIStore } from '../stores/uiStore';
import { Link, useRouterState, useNavigate, useRouter } from '@tanstack/react-router';

function LeftNav() {
  const recentItems = useWorkspaceStore(s => s.recentItems);
  const onRenameDomain = useWorkspaceStore(s => s.renameDomain);
  const onDeleteDomain = useWorkspaceStore(s => s.deleteDomain);
  const onTogglePinDomain = useWorkspaceStore(s => s.togglePinDomain);
  const onToggleArchiveDomain = useWorkspaceStore(s => s.toggleArchiveDomain);
  
  const collapsed = useUIStore(s => s.leftCollapsed);
  const toggleLeftCollapsed = useUIStore(s => s.toggleLeftCollapsed);
  const onSearchTrigger = () => useUIStore.getState().setSearchModalOpen(true);
  
  const setCreationModal = useUIStore(s => s.setCreationModal);
  const onOpenCreateModal = (type: any, domainId?: string, subjectId?: string) => {
    setCreationModal({
      open: true,
      type,
      domainId,
      subjectId
    });
  };
  
  const routerState = useRouterState();
  const location = routerState.location;
  const navigate = useNavigate();
  const router = useRouter();
  
  const domains = useWorkspaceStore(s => s.domains);
  const isLoadingDomains = false;

  const canGoBack = true; // window.history logic handled by router
  const canGoForward = true;
  const onBack = () => router.history.back();
  const onForward = () => router.history.forward();

  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set([domains[0]?.id]));
  const [contextMenu, setContextMenu] = useState<{id: string; type: 'domain'; x: number; y: number} | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [recentGroupBy, setRecentGroupBy] = useState<'None' | 'Date' | 'Project'>('None');
  const [showRecentMenu, setShowRecentMenu] = useState(false);

  const toggleExpand = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const filteredDomains = useMemo(() => {
    let list = domains;
    if (!showArchived) list = list.filter(d => !d.archived);
    if (search) {
      const needle = search.toLowerCase();
      list = list.filter(d =>
        d.name.toLowerCase().includes(needle) ||
        d.subjects.some(s => s.name.toLowerCase().includes(needle))
      );
    }
    return [...list].sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));
  }, [domains, search, showArchived]);

  const handleContextMenu = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({id, type: 'domain', x: e.clientX, y: e.clientY});
  };

  const closeContext = () => setContextMenu(null);

  const startRename = (id: string) => {
    const d = domains.find(dom => dom.id === id);
    setRenaming(id);
    setRenameValue(d?.name || '');
    closeContext();
  };

  const finishRename = () => {
    if (renaming && renameValue.trim()) {
      onRenameDomain(renaming, renameValue.trim());
    }
    setRenaming(null);
  };


  // Use pathname parts for active route detection
  const pathParts = location.pathname.split('/');
  const activeDomainFromPath = pathParts[2] ?? null; // used for domain highlighting
  const activeSubjectFromPath = pathParts[3] ?? null; // used for subject highlighting
  void activeDomainFromPath; void activeSubjectFromPath; // referenced in JSX below

  const renderRecentItem = (item: RecentItem, paddingLeft: number = 8) => {
    let toStr = '/';
    let paramsObj: any = {};
    if (item.loc.level === 'domain') { toStr = '/domain/$domainId'; paramsObj = { domainId: item.loc.domainId }; }
    else if (item.loc.level === 'subject') { toStr = '/subject/$domainId/$subjectId'; paramsObj = { domainId: item.loc.domainId, subjectId: item.loc.subjectId }; }
    else if (item.loc.level === 'chapter') { toStr = '/chapter/$domainId/$subjectId/$chapterId'; paramsObj = { domainId: item.loc.domainId, subjectId: item.loc.subjectId, chapterId: item.loc.chapterId }; }
    else if (item.loc.level === 'topic') { toStr = '/topic/$domainId/$subjectId/$chapterId/$topicId'; paramsObj = { domainId: item.loc.domainId, subjectId: item.loc.subjectId, chapterId: item.loc.chapterId, topicId: item.loc.topicId }; }
    
    return (
      <Link
        key={item.id}
        to={toStr as any}
        params={paramsObj}
        className="no-underline flex items-center gap-2 w-full py-1 pr-2 rounded text-ws-soft text-xs cursor-pointer text-left overflow-hidden text-ellipsis whitespace-nowrap transition-colors hover:bg-ws-surface-2"
        style={{ paddingLeft: `${paddingLeft}px` }}
      >
        <span className="text-sm font-medium overflow-hidden text-ellipsis flex-1">
          {item.label}
        </span>
        <span className="text-[9px] opacity-60 text-ws-accent px-1.5 py-0.5 bg-ws-accent/10 border border-ws-accent/25 rounded capitalize shrink-0">
          {item.type}
        </span>
      </Link>
    );
  };

  const renderGroupedByDate = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const groups: { [key: string]: RecentItem[] } = {
      'Today': [],
      'Yesterday': [],
      'Older': [],
    };

    recentItems.forEach(item => {
      const d = new Date(item.time);
      if (d >= today) groups['Today'].push(item);
      else if (d >= yesterday) groups['Yesterday'].push(item);
      else groups['Older'].push(item);
    });

    return (
      <div className="flex flex-col gap-3">
        {['Today', 'Yesterday', 'Older'].map(g => {
          if (groups[g].length === 0) return null;
          return (
            <div key={g}>
              <div className="text-[10px] text-ws-muted mb-1 pl-2">{g}</div>
              {groups[g].map(item => renderRecentItem(item))}
            </div>
          );
        })}
      </div>
    );
  };

  const renderGroupedByProject = () => {
    const domainMap = new Map<string, RecentItem[]>();
    const noDomainItems: RecentItem[] = [];

    recentItems.forEach(item => {
      const dId = 'domainId' in item.loc ? item.loc.domainId : null;
      if (dId) {
        if (!domainMap.has(dId)) domainMap.set(dId, []);
        domainMap.get(dId)!.push(item);
      } else {
        noDomainItems.push(item);
      }
    });

    return (
      <div className="flex flex-col gap-3">
        {Array.from(domainMap.entries()).map(([dId, items]) => {
          const domain = domains.find(d => d.id === dId);
          if (!domain) return null;

          const subjectMap = new Map<string, RecentItem[]>();
          const domainDirectItems: RecentItem[] = [];

          items.forEach(item => {
            const sId = 'subjectId' in item.loc ? item.loc.subjectId : null;
            if (sId) {
              if (!subjectMap.has(sId)) subjectMap.set(sId, []);
              subjectMap.get(sId)!.push(item);
            } else {
              domainDirectItems.push(item);
            }
          });

          return (
            <div key={dId}>
              <div className="flex items-center justify-between px-2 py-1 text-ws-soft text-[11px] font-medium">
                <div className="flex items-center gap-1.5 overflow-hidden">
                  <span className="overflow-hidden text-ellipsis whitespace-nowrap">{domain.name}</span>
                  <Link 
                    to="/domain/$domainId"
                    params={{ domainId: domain.id }}
                    className="bg-transparent border-none cursor-pointer p-0.5 flex text-ws-muted hover:text-ws-accent"
                    title="Go to domain"
                  >
                    <ArrowUpRight size={10} />
                  </Link>
                </div>
              </div>
              {domainDirectItems.map(item => renderRecentItem(item, 16))}
              {Array.from(subjectMap.entries()).map(([sId, sItems]) => {
                const subject = domain.subjects.find(s => s.id === sId);
                if (!subject) return null;

                const chapterMap = new Map<string, RecentItem[]>();
                const subjectDirectItems: RecentItem[] = [];

                sItems.forEach(item => {
                   const cId = 'chapterId' in item.loc ? item.loc.chapterId : null;
                   if (cId) {
                     if (!chapterMap.has(cId)) chapterMap.set(cId, []);
                     chapterMap.get(cId)!.push(item);
                   } else {
                     subjectDirectItems.push(item);
                   }
                });

                return (
                  <div key={sId} className="ml-2 mt-1">
                    <div className="flex items-center gap-1.5 px-2 py-0.5 text-ws-muted text-[11px]">
                      <span className="overflow-hidden text-ellipsis whitespace-nowrap">{subject.name}</span>
                      <Link 
                        to="/subject/$domainId/$subjectId"
                        params={{ domainId: domain.id, subjectId: subject.id }}
                        className="bg-transparent border-none cursor-pointer p-0.5 flex text-ws-muted hover:text-ws-accent"
                        title="Go to subject"
                      >
                        <ArrowUpRight size={10} />
                      </Link>
                    </div>
                    {subjectDirectItems.map(item => renderRecentItem(item, 16))}
                    {Array.from(chapterMap.entries()).map(([cId, cItems]) => {
                       const chapter = subject.chapters.find(c => c.id === cId);
                       if (!chapter) return null;
                       return (
                         <div key={cId} className="ml-2 mt-1">
                           <div className="flex items-center gap-1.5 px-2 py-0.5 text-ws-muted text-[10px]">
                             <span className="overflow-hidden text-ellipsis whitespace-nowrap">{chapter.name}</span>
                             <Link 
                               to="/chapter/$domainId/$subjectId/$chapterId"
                               params={{ domainId: domain.id, subjectId: subject.id, chapterId: chapter.id }}
                               className="bg-transparent border-none cursor-pointer p-0.5 flex text-ws-muted hover:text-ws-accent"
                               title="Go to chapter"
                             >
                               <ArrowUpRight size={10} />
                             </Link>
                           </div>
                           {cItems.map(item => renderRecentItem(item, 16))}
                         </div>
                       )
                    })}
                  </div>
                )
              })}
            </div>
          );
        })}
        {noDomainItems.length > 0 && (
          <div>
            <div className="text-[10px] text-ws-muted mb-1 pl-2">Other</div>
            {noDomainItems.map(item => renderRecentItem(item))}
          </div>
        )}
      </div>
    );
  };

  return (
    <nav className={`flex flex-col bg-ws-bg border-r border-ws-line transition-[width] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] ${collapsed ? 'w-12' : 'w-[220px]'}`} aria-label="Domain navigation" onClick={closeContext}>
      {/* Integrated Platform Header & Collapse Switch */}
      {collapsed ? (
        <div className="flex items-center justify-center h-11 shrink-0">
          <button
            type="button"
            className="press transition-colors flex items-center justify-center w-7 h-7 text-ws-muted rounded hover:text-ws-ink hover:bg-ws-surface-2"
            onClick={toggleLeftCollapsed}
            title="Expand sidebar"
          >
            <PanelLeftOpen size={14} />
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-between h-11 px-3 shrink-0">
          <span className="font-bold text-[13px] text-ws-ink tracking-tight">Practice Workspace</span>
          <button
            type="button"
            className="press transition-colors flex items-center justify-center w-7 h-7 text-ws-muted rounded hover:text-ws-ink hover:bg-ws-surface-2"
            onClick={toggleLeftCollapsed}
            title="Collapse sidebar"
          >
            <PanelLeftClose size={14} />
          </button>
        </div>
      )}

      {/* Search + nav arrows */}
      {!collapsed && (
        <div className="flex items-center gap-1 p-2">
          <button type="button" className={`press transition-colors flex items-center justify-center rounded hover:bg-ws-surface-2 text-ws-muted hover:text-ws-ink w-6 h-6 ${canGoBack ? 'opacity-100' : 'opacity-30'}`} onClick={onBack} disabled={!canGoBack} title="Back">
            <ChevronLeft size={14} />
          </button>
          <button type="button" className={`press transition-colors flex items-center justify-center rounded hover:bg-ws-surface-2 text-ws-muted hover:text-ws-ink w-6 h-6 ${canGoForward ? 'opacity-100' : 'opacity-30'}`} onClick={onForward} disabled={!canGoForward} title="Forward">
            <ChevronRight size={14} />
          </button>
          <div className="relative flex-1 min-w-0 ml-1">
            <Search size={14} className="absolute left-1.5 top-1.5 text-ws-muted" />
            <input
              type="text"
              placeholder="Search..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-6 pr-1.5 py-1 text-[13px] bg-ws-bg text-ws-ink border border-ws-line rounded outline-none focus:border-ws-success/50 focus:ring-1 focus:ring-ws-success/50 placeholder-zinc-600"
            />
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0 p-2 scrollbar">
        {/* Domain section header */}
        {!collapsed && (
          <div className="flex items-center justify-between px-2 py-1 mb-1">
            <span className="text-[10px] font-bold text-ws-muted uppercase tracking-wider">Domains</span>
            <div className="flex items-center gap-0.5">
              <button
                type="button"
                onClick={() => setShowArchived(!showArchived)}
                title={showArchived ? 'Hide archived' : 'Show archived'}
                className={`press transition-colors flex p-0.5 rounded hover:bg-ws-surface-2 ${showArchived ? 'text-ws-success' : 'text-ws-muted'}`}
              >
                <Archive size={14} />
              </button>
              <button
                type="button"
                onClick={() => onOpenCreateModal('domain')}
                title="New domain"
                className="press transition-colors flex p-0.5 rounded hover:bg-ws-surface-2 text-ws-muted"
              >
                <Plus size={14} />
              </button>
            </div>
          </div>
        )}

        {/* Domain tree */}
        {collapsed ? (
          (() => {
            const isDomainsActive = ['/', '/domain', '/subject', '/chapter', '/topic'].some(p => location.pathname.startsWith(p.length > 1 ? p : '/') && (p === '/' ? location.pathname === '/' || location.pathname.startsWith('/domain') || location.pathname.startsWith('/subject') || location.pathname.startsWith('/chapter') || location.pathname.startsWith('/topic') : true));
            return (
              <>
                {/* Topmost Domain Folder */}
                <Link
                  to="/"
                  className={`press no-underline flex items-center justify-center h-8 w-8 mx-auto rounded mb-2 transition-colors ${isDomainsActive ? 'bg-ws-accent/10' : 'bg-transparent hover:bg-ws-surface-2'}`}
                  title="All Domains"
                >
                  <Folder size={16} className={isDomainsActive ? 'text-ws-accent' : 'text-ws-soft'} />
                </Link>

                {/* Global search launcher icon — no animation, keyboard action */}
                <div
                  className="flex items-center justify-center h-8 w-8 mx-auto rounded mb-3 border-b border-ws-edge-soft pb-2 bg-transparent hover:bg-ws-surface-2"
                  onClick={() => onSearchTrigger?.()}
                  title="Search specializations and concepts (Ctrl+K)"
                >
                  <Search size={16} className="text-ws-soft" />
                </div>
              </>
            );
          })()
        ) : isLoadingDomains ? (
          <div className="flex items-center px-3 h-8 text-ws-muted text-[13px]">
            Loading...
          </div>
        ) : (
          filteredDomains.map(domain => {
            const isDomainExpanded = expanded.has(domain.id);
            const isDomainActive = location.pathname === `/domain/${domain.id}`;

          return (
            <div key={domain.id} className="mb-1">
              {/* Domain row */}
              <div
                className={`flex items-center gap-2 h-8 px-2.5 rounded cursor-pointer no-underline text-inherit ${isDomainActive ? 'bg-ws-accent/10 text-ws-accent' : 'bg-transparent text-ws-soft'} ${domain.archived ? 'opacity-50' : 'opacity-100'} hover:bg-ws-surface-2 transition-colors`}
                onClick={() => { toggleExpand(domain.id); navigate({to: '/domain/$domainId', params: { domainId: domain.id }}); }}
                onContextMenu={e => handleContextMenu(e, domain.id)}
              >
                <span className="text-ws-muted flex shrink-0 w-3.5 justify-center">
                  {isDomainExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </span>
                <span className="text-ws-muted flex shrink-0">
                  {isDomainExpanded ? <FolderOpen size={14} className="text-ws-accent" /> : <Folder size={14} />}
                </span>
                {renaming === domain.id ? (
                  <input
                    type="text"
                    value={renameValue}
                    onChange={e => setRenameValue(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') finishRename(); if (e.key === 'Escape') setRenaming(null); }}
                    onBlur={finishRename}
                    onClick={e => e.stopPropagation()}
                    autoFocus
                    className="flex-1 px-1 py-0.5 bg-ws-bg border border-ws-glow rounded text-ws-ink text-[13px] outline-none min-w-0 h-6"
                  />
                ) : (
                  <span className="text-[13px] font-semibold text-ws-ink flex-1 overflow-hidden text-ellipsis whitespace-nowrap min-w-0">
                    {domain.name}
                  </span>
                )}
                {domain.pinned && <Pin size={12} className="text-ws-accent shrink-0" />}
                <button
                  type="button"
                  onClick={e => { e.stopPropagation(); onOpenCreateModal('subject', domain.id); }}
                  title="Add subject"
                  className="press bg-transparent border-none text-ws-muted hover:text-ws-accent flex shrink-0 p-0.5 opacity-60 hover:opacity-100 transition-colors"
                >
                  <Plus size={14} />
                </button>
                <button
                  type="button"
                  onClick={e => handleContextMenu(e, domain.id)}
                  className="press bg-transparent border-none text-ws-muted hover:text-ws-accent flex shrink-0 p-0.5 opacity-60 hover:opacity-100 transition-colors"
                >
                  <MoreHorizontal size={14} />
                </button>
              </div>

              {/* Subjects (Level 2) */}
              {isDomainExpanded && domain.subjects.map(subject => {
                const isSubExpanded = expanded.has(subject.id);
                const isSubActive = location.pathname === `/subject/${domain.id}/${subject.id}`;

                return (
                  <div key={subject.id} className="ml-3.5 mb-0.5">
                    <div
                      className={`flex items-center gap-2 h-8 px-2 rounded cursor-pointer no-underline text-inherit ${isSubActive ? 'bg-ws-accent/10 text-ws-accent' : 'bg-transparent text-ws-soft'} hover:bg-ws-surface-2 transition-colors`}
                      onClick={() => { toggleExpand(subject.id); navigate({to: '/subject/$domainId/$subjectId', params: { domainId: domain.id, subjectId: subject.id }}); }}
                    >
                      <span className="text-ws-muted flex shrink-0 w-3.5 justify-center">
                        {isSubExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      </span>
                      <span className="text-ws-muted flex shrink-0">
                        <BookOpen size={14} className={isSubActive ? 'text-ws-accent' : 'text-ws-muted'} />
                      </span>
                      <span className={`text-[13px] font-medium flex-1 overflow-hidden text-ellipsis whitespace-nowrap min-w-0 ${isSubActive ? 'text-ws-ink' : 'text-ws-soft'}`}>
                        {subject.name}
                      </span>
                      <button
                        type="button"
                        onClick={e => { e.stopPropagation(); onOpenCreateModal('chapter', domain.id, subject.id); }}
                        title="Add chapter"
                        className="press bg-transparent border-none text-ws-muted hover:text-ws-accent flex shrink-0 p-0.5 opacity-60 hover:opacity-100 transition-colors"
                      >
                        <Plus size={14} />
                      </button>
                    </div>

                    {/* Chapters (Level 3) */}
                    {isSubExpanded && subject.chapters.map(chapter => {
                      const isChExpanded = expanded.has(chapter.id);
                      const isChActive = location.pathname === `/chapter/${domain.id}/${subject.id}/${chapter.id}`;

                      return (
                        <div key={chapter.id} className="ml-3.5 mb-0.5">
                          <div
                            className={`flex items-center gap-2 h-8 px-2 rounded cursor-pointer no-underline text-inherit ${isChActive ? 'bg-ws-accent/10 text-ws-accent' : 'bg-transparent text-ws-soft'} hover:bg-ws-surface-2 transition-colors`}
                            onClick={() => { toggleExpand(chapter.id); navigate({to: '/chapter/$domainId/$subjectId/$chapterId', params: { domainId: domain.id, subjectId: subject.id, chapterId: chapter.id }}); }}
                          >
                            <span className="text-ws-muted flex shrink-0 w-3.5 justify-center">
                              {isChExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                            </span>
                            <span className="text-ws-muted flex shrink-0">
                              <Layers size={14} className={isChActive ? 'text-ws-accent' : 'text-ws-muted'} />
                            </span>
                            <span className={`text-[13px] font-medium flex-1 overflow-hidden text-ellipsis whitespace-nowrap min-w-0 ${isChActive ? 'text-ws-ink' : 'text-ws-soft'}`}>
                              {chapter.name}
                            </span>
                          </div>

                          {/* Topics/Concepts (Level 4) */}
                          {isChExpanded && chapter.topics.map(topic => {
                            const isTopicActive = location.pathname === `/topic/${domain.id}/${subject.id}/${chapter.id}/${topic.id}`;

                            return (
                              <div
                                key={topic.id}
                                className={`flex items-center gap-2 h-8 px-2 ml-3.5 rounded cursor-pointer no-underline text-inherit ${isTopicActive ? 'bg-ws-accent/10 text-ws-accent' : 'bg-transparent text-ws-soft'} hover:bg-ws-surface-2 transition-colors`}
                                onClick={() => navigate({to: '/topic/$domainId/$subjectId/$chapterId/$topicId', params: { domainId: domain.id, subjectId: subject.id, chapterId: chapter.id, topicId: topic.id }})}
                              >
                                <span className="text-ws-muted flex shrink-0">
                                  <FileCode size={14} className={isTopicActive ? 'text-ws-accent' : 'text-ws-muted'} />
                                </span>
                                <span className={`text-[13px] flex-1 overflow-hidden text-ellipsis whitespace-nowrap min-w-0 ${isTopicActive ? 'text-ws-ink' : 'text-ws-muted'} ${isTopicActive ? 'font-medium' : 'font-normal'}`}>
                                  {topic.name}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          );
        }))}

        {filteredDomains.length === 0 && (
          <div className="py-4 px-2 text-center text-ws-muted text-[11px]">
            {search ? 'No results' : 'No domains yet'}
          </div>
        )}

        {/* Global nav items at bottom */}
        <div className="mt-4 border-t border-ws-edge-soft pt-2">
          {!collapsed && <div className="text-[10px] font-bold text-ws-muted uppercase tracking-wider px-3 mb-2 mt-4">Tools</div>}
          <Link
            to="/notebook"
            className={`ws-nav-item no-underline ${location.pathname.startsWith('/notebook') ? 'active' : ''} ${collapsed ? 'justify-center py-2' : ''}`}
            title="Notebooks"
          >
            <BookOpen size={collapsed ? 16 : 14} />
            {!collapsed && <span className="text-[13px] font-medium">Notebooks</span>}
          </Link>
          <Link
            to="/workflows"
            className={`ws-nav-item no-underline ${location.pathname.startsWith('/workflow') ? 'active' : ''} ${collapsed ? 'justify-center py-2' : ''}`}
            title="Workflows"
          >
            <Workflow size={collapsed ? 16 : 14} />
            {!collapsed && <span className="text-[13px] font-medium">Workflows</span>}
          </Link>
          <Link
            to="/artifacts"
            className={`ws-nav-item no-underline ${location.pathname.startsWith('/artifact') ? 'active' : ''} ${collapsed ? 'justify-center py-2' : ''}`}
            title="Artifacts"
          >
            <LayoutGrid size={collapsed ? 16 : 14} />
            {!collapsed && <span className="text-[13px] font-medium">Artifacts</span>}
          </Link>
          <Link
            to="/graph"
            className={`ws-nav-item no-underline ${location.pathname.startsWith('/graph') ? 'active' : ''} ${collapsed ? 'justify-center py-2' : ''}`}
            title="Knowledge Graph"
          >
            <GitBranch size={collapsed ? 16 : 14} />
            {!collapsed && <span className="text-[13px] font-medium">Knowledge Graph</span>}
          </Link>
        </div>

        {/* Recents Section */}
        {!collapsed && recentItems && recentItems.length > 0 && (
          <div className="mt-4 border-t border-ws-edge-soft pt-2 pb-4">
            <div className="text-[10px] font-bold text-ws-muted uppercase tracking-wider px-3 mb-1 mt-4 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <History size={14} className="text-ws-glow" />
                <span>Recent Activity</span>
              </div>
              <div className="relative">
                <button 
                  type="button"
                  className="bg-transparent border-none text-ws-muted cursor-pointer p-1 rounded hover:text-ws-accent w-5 h-5 flex items-center justify-center transition-colors" 
                  onClick={(e) => { e.stopPropagation(); setShowRecentMenu(!showRecentMenu); }}
                >
                  <Settings2 size={14} />
                </button>
                
                {showRecentMenu && (
                  <>
                    <div className="fixed inset-0 z-[999]" onClick={(e) => { e.stopPropagation(); setShowRecentMenu(false); }} />
                    <div className="pop-pop origin-trigger-tr absolute right-0 top-5.5 z-[1000] bg-ws-bg border border-ws-line rounded-md p-1 min-w-[120px] shadow-2xl" onClick={e => e.stopPropagation()}>
                      <div className="px-2 py-1.5 text-[10px] text-ws-muted uppercase tracking-wider">Group by</div>
                      {['None', 'Date', 'Project'].map(g => (
                         <button
                           key={g}
                           type="button"
                           onClick={() => { setRecentGroupBy(g as any); setShowRecentMenu(false); }}
                           className="flex items-center justify-between w-full px-2.5 py-1.5 bg-transparent border-none rounded text-ws-soft hover:bg-ws-surface-2 text-xs cursor-pointer text-left transition-colors"
                         >
                           <span>{g}</span>
                           {recentGroupBy === g && <Check size={14} className="text-ws-accent" />}
                         </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
            
            {recentGroupBy === 'None' && (
              <div className="flex flex-col">
                {recentItems.map(item => renderRecentItem(item))}
              </div>
            )}
            {recentGroupBy === 'Date' && renderGroupedByDate()}
            {recentGroupBy === 'Project' && renderGroupedByProject()}
          </div>
        )}
      </div>

      {/* Context menu */}
      {contextMenu && (
        <>
          <div className="fixed inset-0 z-[999]" onClick={closeContext} />
          <div 
            className="fixed z-[1000] bg-ws-bg border border-ws-line rounded-md p-1 min-w-[140px] shadow-2xl fade-in"
            style={{ left: contextMenu.x, top: contextMenu.y }}
          >
            {[
              {icon: Pin, label: domains.find(d => d.id === contextMenu.id)?.pinned ? 'Unpin' : 'Pin', action: () => { onTogglePinDomain(contextMenu.id); closeContext(); }},
              {icon: Archive, label: domains.find(d => d.id === contextMenu.id)?.archived ? 'Unarchive' : 'Archive', action: () => { onToggleArchiveDomain(contextMenu.id); closeContext(); }},
              {icon: Edit2, label: 'Rename', action: () => startRename(contextMenu.id)},
              {icon: Trash2, label: 'Delete', action: () => { onDeleteDomain(contextMenu.id); closeContext(); }, danger: true},
            ].map(item => (
              <button
                key={item.label}
                type="button"
                onClick={item.action}
                className={`press flex items-center gap-2 w-full px-2.5 py-1.5 bg-transparent border-none rounded text-[13px] text-left transition-colors hover:bg-ws-surface-2 ${item.danger ? 'text-[#ef4444]' : 'text-ws-soft'}`}
              >
                <item.icon size={14} /> {item.label}
              </button>
            ))}
          </div>
        </>
      )}
    </nav>
  );
}

export default LeftNav;
