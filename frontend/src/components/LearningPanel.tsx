import { useState, useEffect } from 'react';
import { BookOpen, List, ChevronLeft, ChevronRight } from 'lucide-react';
import { flowContent, flowTabs, splitLessonSections } from '../problemContent';
import type { FlowTab, Problem } from '../types';
import MarkdownView from './MarkdownView';

type Props = {
  problem: Problem;
  tab: FlowTab;
  onTab: (tab: FlowTab) => void;
};

function LearningPanel({ problem, tab, onTab }: Props) {
  const [outlineCollapsed, setOutlineCollapsed] = useState(false);
  const [activeSectionId, setActiveSectionId] = useState<string>('');
  
  const sections = splitLessonSections(flowContent(problem, tab));
  const idPrefix = `lesson-${problem.id}-${tab}`;

  function jumpTo(sectionId: string) {
    if (typeof document === 'undefined') return;
    const targetElement = document.getElementById(`${idPrefix}-${sectionId}`);
    if (targetElement) {
      targetElement.scrollIntoView({ block: 'start', behavior: 'smooth' });
      setActiveSectionId(sectionId);
    }
  }

  // Active scroll position observer in lesson block viewport
  useEffect(() => {
    if (sections.length === 0) return;
    
    // Default to the first section as active
    setActiveSectionId(sections[0].id);

    const container = document.querySelector('.lesson-sections');
    if (!container) return;

    const observerOptions = {
      root: container,
      rootMargin: '-10% 0px -70% 0px',
      threshold: 0
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const fullId = entry.target.id;
          const prefix = `${idPrefix}-`;
          if (fullId.startsWith(prefix)) {
            const sectionId = fullId.substring(prefix.length);
            setActiveSectionId(sectionId);
          }
        }
      });
    }, observerOptions);

    const blocks = container.querySelectorAll('.lesson-block');
    blocks.forEach(block => observer.observe(block));

    return () => {
      observer.disconnect();
    };
  }, [problem.id, tab, sections.length, idPrefix]);

  return (
    <section className="flex flex-col h-full bg-ws-bench border border-ws-edge-soft rounded-lg overflow-hidden">
      
      {/* Header bar area */}
      <div className="flex flex-col gap-2 px-4 py-3 bg-ws-floor border-b border-ws-edge-soft shrink-0">
        <div className="flex items-center gap-1.5 text-[10px] font-bold text-ws-glow uppercase tracking-wider">
          <BookOpen size={14} className="shrink-0" /> 
          <span>Exercise workspace</span>
        </div>
        
        <h2 className="text-base font-bold text-ws-ink m-0 tracking-tight leading-tight">
          {problem.title}
        </h2>
        
        {/* Topic Badge tags row */}
        <div className="flex flex-wrap gap-1.5 my-1">
          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 bg-ws-glow-wash text-ws-glow border border-ws-glow-ring rounded">
            {problem.exerciseMode === 'judge' ? 'Local judge' : 'Project-style'}
          </span>
          {problem.tags.slice(0, 4).map(t => (
            <span 
              key={t}
              className="text-[10px] font-semibold px-2 py-0.5 bg-ws-shelf text-ws-ink-2 border border-ws-edge rounded transition-colors"
            >
              {t}
            </span>
          ))}
        </div>

        {/* Tab selector menu */}
        <div className="flex overflow-x-auto gap-1 p-1 bg-ws-bench border border-ws-edge rounded-md w-full scrollbar-none">
          {flowTabs.map(t => {
            const isActive = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                className={`flex-1 inline-flex items-center justify-center px-3 h-8 whitespace-nowrap text-[13px] rounded transition-all duration-150 ${isActive ? 'font-bold text-ws-glow bg-ws-floor border border-ws-edge-soft' : 'font-medium text-ws-ink-3 bg-transparent border border-transparent hover:text-ws-ink'}`}
                onClick={() => onTab(t.id)}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main split work view */}
      <div className={`flex-1 grid overflow-hidden bg-ws-bench min-h-0 ${outlineCollapsed ? 'grid-cols-[44px_minmax(0,1fr)]' : 'grid-cols-[240px_minmax(0,1fr)]'}`}>
        
        {/* Outline Sidebar Panel */}
        {outlineCollapsed ? (
          <nav
            className="flex flex-col items-center gap-3 w-11 h-full py-4 px-1 bg-ws-floor border-r border-ws-edge-soft shrink-0 scrollbar-none"
            aria-label="Outline navigation"
          >
            <button
              type="button"
              onClick={() => setOutlineCollapsed(false)}
              className="flex items-center justify-center w-7 h-7 rounded bg-ws-floor border border-ws-edge-soft text-ws-ink-2 hover:bg-ws-shelf hover:text-ws-ink transition-colors"
              title="Expand Outline"
            >
              <ChevronRight size={14} />
            </button>
            
            <div className="w-[60%] h-px bg-ws-edge-soft" />
            
            <List size={14} className="text-ws-ink-muted mt-1" />
            <span className="text-[10px] font-bold text-ws-ink-muted uppercase tracking-wider mt-2 whitespace-nowrap [writing-mode:vertical-rl] rotate-180">
              Outline Map
            </span>
          </nav>
        ) : (
          <nav 
            className="flex flex-col gap-4 relative bg-ws-floor border-r border-ws-edge-soft p-4 overflow-y-auto scrollbar" 
            aria-label="Outline navigation"
          >
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-1.5 text-[10px] font-bold text-ws-ink uppercase tracking-wider">
                <List size={14} className="text-ws-glow shrink-0" />
                <span>Outline Map</span>
              </div>
              <button
                type="button"
                onClick={() => setOutlineCollapsed(true)}
                className="flex items-center justify-center w-6 h-6 rounded border border-ws-edge-soft text-ws-ink-3 hover:bg-ws-shelf hover:text-ws-ink transition-colors"
                title="Collapse Outline"
              >
                <ChevronLeft size={14} />
              </button>
            </div>

            {/* Glowing vertical timeline tree track layout */}
            <div className="relative flex flex-col gap-1 pl-1">
              
              {/* Continuous vertical baseline track line */}
              <div className="absolute left-[15px] top-[14px] bottom-[14px] w-[2px] bg-ws-edge-soft z-0" />
              
              {sections.map((section, index) => {
                const isActive = section.id === activeSectionId;
                const activeIndex = sections.findIndex(s => s.id === activeSectionId);
                const isPassed = index <= activeIndex;
                
                return (
                  <button
                    key={section.id}
                    type="button"
                    className={`flex items-center gap-2 h-8 w-full pl-1 pr-2.5 rounded-md text-left relative z-10 transition-all duration-150 border ${isActive ? 'bg-ws-shelf border-ws-edge-soft text-ws-glow' : 'bg-transparent border-transparent text-ws-soft hover:bg-white/5'}`}
                    onClick={() => jumpTo(section.id)}
                  >
                    {/* Numbered node circle with active glowing halos */}
                    <div
                      className={`flex items-center justify-center shrink-0 w-[22px] h-[22px] rounded-full text-[10px] font-extrabold transition-all duration-200 border ${isActive ? 'bg-ws-glow border-ws-glow text-ws-floor shadow-[0_0_8px_var(--ws-glow-ring)]' : isPassed ? 'bg-ws-glow-wash border-ws-glow-ring text-ws-glow' : 'bg-ws-bench border-ws-edge text-ws-ink-3'}`}
                    >
                      {String(index + 1).padStart(2, '0')}
                    </div>
                    
                    <span 
                      className={`flex-1 whitespace-nowrap overflow-hidden text-ellipsis text-[13px] transition-colors duration-150 ${isActive ? 'font-bold text-ws-ink' : 'font-medium text-ws-ink-2'}`}
                    >
                      {section.title}
                    </span>
                  </button>
                );
              })}
            </div>
          </nav>
        )}

        {/* Content sections scrolling pane */}
        <div className="lesson-sections flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-6 scroll-smooth bg-ws-bench scrollbar">
          {sections.map((section, index) => {
            const isActive = section.id === activeSectionId;
            return (
              <article 
                className={`lesson-block relative pl-5 border-l transition-all duration-250 ${isActive ? 'border-ws-glow opacity-100' : 'border-ws-edge-soft opacity-85'}`}
                id={`${idPrefix}-${section.id}`} 
                key={section.id}
              >
                {/* Visual marker element */}
                <div 
                  className={`lesson-index absolute -left-[13px] top-0 w-6 h-6 rounded-full border flex items-center justify-center font-mono text-[10px] font-bold transition-all duration-200 ${isActive ? 'bg-ws-glow border-ws-glow text-ws-floor shadow-[0_0_6px_var(--ws-glow-ring)]' : 'bg-ws-floor border-ws-edge text-ws-glow'}`}
                >
                  {String(index + 1).padStart(2, '0')}
                </div>
                
                <h3 className={`text-base font-bold m-0 mb-2 tracking-tight transition-colors duration-200 ${isActive ? 'text-ws-ink' : 'text-ws-ink-2'}`}>
                  {section.title}
                </h3>
                
                <div className="text-ws-ink-2 text-[13px] leading-relaxed">
                  <MarkdownView text={section.body || ' '} className="lesson-markdown" />
                </div>
              </article>
            );
          })}
        </div>

      </div>
    </section>
  );
}

export default LearningPanel;
