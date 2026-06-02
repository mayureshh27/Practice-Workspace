import { Search, Settings, Moon, Sun, ChevronLeft, ChevronRight, PanelBottom } from 'lucide-react';
import { Link, useRouter, useMatches } from '@tanstack/react-router';
import { useUIStore } from '../stores/uiStore';
import { useWorkspaceStore } from '../stores/workspaceStore';
import { Button } from '@/components/ui/button';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { cn } from '@/lib/utils';

function WorkspaceTopBar() {
  const theme = useUIStore(s => s.theme);
  const toggleTheme = useUIStore(s => s.toggleTheme);
  const setSearchModalOpen = useUIStore(s => s.setSearchModalOpen);
  const toggleSettings = useUIStore(s => s.toggleSettings);
  const bottomOpen = useUIStore(s => s.bottomOpen);
  const toggleBottom = () => useUIStore.getState().setBottomOpen(!bottomOpen);
  const domains = useWorkspaceStore(s => s.domains);

  const router = useRouter();
  const matches = useMatches();

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
    <header className="flex items-center justify-between gap-4 h-11 px-4 bg-background border-b border-border z-30 min-w-0 shrink-0">

      {/* Breadcrumb navigation */}
      <Breadcrumb className="flex-1 min-w-0 overflow-x-auto pr-4 scrollbar-none [mask-image:linear-gradient(to_right,black_85%,transparent_100%)]">
        <BreadcrumbList className="flex-nowrap gap-1">
          {allCrumbs.map((crumb, i) => {
            const isLast = i === allCrumbs.length - 1;
            return (
              <BreadcrumbItem key={i} className="shrink-0">
                {isLast ? (
                  <BreadcrumbPage className="text-[13px] font-medium text-foreground px-1.5 py-0.5">
                    {crumb.label}
                  </BreadcrumbPage>
                ) : (
                  <>
                    <BreadcrumbLink asChild>
                      <Link
                        to={crumb.to}
                        className={cn(
                          "press text-[13px] font-medium text-muted-foreground hover:bg-accent hover:text-foreground px-1.5 py-0.5 rounded transition-colors"
                        )}
                      >
                        {crumb.label}
                      </Link>
                    </BreadcrumbLink>
                    <BreadcrumbSeparator className="text-muted-foreground text-[13px]">›</BreadcrumbSeparator>
                  </>
                )}
              </BreadcrumbItem>
            );
          })}
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex items-center justify-end gap-1 shrink-0">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => setSearchModalOpen(true)}
          title="Search (⌘K)"
          className="size-7 text-muted-foreground hover:text-foreground hover:bg-accent"
        >
          <Search size={14} />
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => router.history.back()}
          title="Back"
          className="size-7 text-muted-foreground hover:text-foreground hover:bg-accent"
        >
          <ChevronLeft size={14} />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => router.history.forward()}
          title="Forward"
          className="size-7 text-muted-foreground hover:text-foreground hover:bg-accent"
        >
          <ChevronRight size={14} />
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={toggleBottom}
          title={`${bottomOpen ? 'Hide' : 'Show'} output panel`}
          aria-label={bottomOpen ? 'Hide output panel' : 'Show output panel'}
          className="size-7 text-muted-foreground hover:text-foreground hover:bg-accent"
        >
          <PanelBottom size={14} />
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={toggleTheme}
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          className="size-7 text-muted-foreground hover:text-foreground hover:bg-accent"
        >
          {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          data-settings-trigger
          onClick={toggleSettings}
          title="Appearance settings (⌘J)"
          className="size-7 text-muted-foreground hover:text-foreground hover:bg-accent"
        >
          <Settings size={14} />
        </Button>
      </div>
    </header>
  );
}

export default WorkspaceTopBar;
