import { Search, Settings, Moon, Sun, ChevronLeft, ChevronRight } from 'lucide-react';
import { Link, useRouter, useMatches } from '@tanstack/react-router';
import { useUIStore } from '../stores/uiStore';
import { useWorkspaceStore } from '../stores/workspaceStore';

function WorkspaceTopBar() {
  const theme = useUIStore(s => s.theme);
  const toggleTheme = useUIStore(s => s.toggleTheme);
  const setSearchModalOpen = useUIStore(s => s.setSearchModalOpen);
  const domains = useWorkspaceStore(s => s.domains);

  const router = useRouter();
  const matches = useMatches();

  // Build human-readable breadcrumbs from matched routes + params
  const params: any = {};
  matches.forEach(m => {
    if (m.params) {
      Object.assign(params, m.params);
    }
  });

  const crumbs: Array<{ label: string; to: string }> = [];
  const { domainId, subjectId, chapterId, topicId } = params;

  if (domainId) {
    const domain = domains.find(d => d.id === domainId);
    crumbs.push({
      label: domain?.name ?? domainId,
      to: `/domain/${domainId}`
    });

    if (subjectId) {
      const subject = domain?.subjects.find(s => s.id === subjectId);
      const isNotebook = matches.some(m => m.pathname.includes('/notebook/'));
      
      if (isNotebook) {
        crumbs.push({
          label: subject?.name ?? subjectId,
          to: `/subject/${domainId}/${subjectId}`
        });
        crumbs.push({
          label: 'Notebooks',
          to: `/notebook/${domainId}/${subjectId}`
        });
      } else {
        crumbs.push({
          label: subject?.name ?? subjectId,
          to: `/subject/${domainId}/${subjectId}`
        });

        if (chapterId) {
          const chapter = subject?.chapters.find(c => c.id === chapterId);
          crumbs.push({
            label: chapter?.name ?? chapterId,
            to: `/chapter/${domainId}/${subjectId}/${chapterId}`
          });

          if (topicId) {
            const topic = chapter?.topics.find(t => t.id === topicId);
            crumbs.push({
              label: topic?.name ?? topicId,
              to: `/topic/${domainId}/${subjectId}/${chapterId}/${topicId}`
            });
          }
        }
      }
    }
  } else {
    const activeMatch = matches.find(match => match.routeId !== '__root__' && match.routeId !== '/');
    if (activeMatch) {
      const rId = activeMatch.routeId;
      let label = '';
      if (rId.includes('notebook')) {
        label = 'Notebooks';
      } else if (rId.includes('workflow-editor')) {
        label = 'Workflow Editor';
      } else if (rId.includes('workflow')) {
        label = 'Workflows';
      } else if (rId.includes('artifact')) {
        label = 'Artifacts';
      } else if (rId.includes('graph')) {
        label = 'Knowledge Graph';
      } else {
        const pathPart = activeMatch.pathname.replace(/^\//, '').split('/')[0];
        label = pathPart ? pathPart.charAt(0).toUpperCase() + pathPart.slice(1) : 'Section';
      }
      crumbs.push({ label, to: activeMatch.pathname });
    }
  }

  const allCrumbs = [{ label: 'Domains', to: '/' }, ...crumbs];

  return (
    <header className="flex items-center justify-between gap-4 h-11 px-4 bg-ws-bg border-b border-ws-line z-30 min-w-0 shrink-0">

      {/* Breadcrumb navigation */}
      <div className="flex-1 flex items-center gap-1 min-w-0 overflow-x-auto pr-4 flex-nowrap scrollbar-none [mask-image:linear-gradient(to_right,black_85%,transparent_100%)]">
        {allCrumbs.map((crumb, i) => (
          <span key={i} className="flex items-center gap-1 shrink-0">
            {i > 0 && <span className="text-ws-faint text-[13px] shrink-0">›</span>}
            <Link
              to={crumb.to}
              className={`text-[13px] font-medium hover:bg-ws-surface-2 hover:text-ws-ink px-1.5 py-0.5 rounded transition-colors ${i === allCrumbs.length - 1 ? 'text-ws-ink' : 'text-ws-muted'}`}
              activeProps={{ className: 'text-ws-ink bg-ws-surface-2' }}
            >
              {crumb.label}
            </Link>
          </span>
        ))}
      </div>

      <div className="flex items-center justify-end gap-1 shrink-0">
        <button
          type="button"
          className="flex items-center justify-center w-7 h-7 text-ws-muted hover:text-ws-ink hover:bg-ws-surface-2 rounded transition-colors"
          onClick={() => setSearchModalOpen(true)}
          title="Search (⌘K)"
        >
          <Search size={14} />
        </button>

        <button
          type="button"
          className="flex items-center justify-center w-7 h-7 text-ws-muted hover:text-ws-ink hover:bg-ws-surface-2 rounded transition-colors"
          onClick={() => router.history.back()}
          title="Back"
        >
          <ChevronLeft size={14} />
        </button>
        <button
          type="button"
          className="flex items-center justify-center w-7 h-7 text-ws-muted hover:text-ws-ink hover:bg-ws-surface-2 rounded transition-colors"
          onClick={() => router.history.forward()}
          title="Forward"
        >
          <ChevronRight size={14} />
        </button>

        <button
          type="button"
          className="flex items-center justify-center w-7 h-7 text-ws-muted hover:text-ws-ink hover:bg-ws-surface-2 rounded transition-colors"
          onClick={toggleTheme}
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
        >
          {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
        </button>

        <button type="button" className="flex items-center justify-center w-7 h-7 text-ws-muted hover:text-ws-ink hover:bg-ws-surface-2 rounded transition-colors" title="Settings">
          <Settings size={14} />
        </button>
      </div>
    </header>
  );
}

export default WorkspaceTopBar;
