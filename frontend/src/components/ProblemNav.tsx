import { useState } from 'react';
import { CheckCircle2, Search, ChevronLeft, ChevronRight, Layers, X } from 'lucide-react';
import { chipText, shortTitle } from '../problemContent';
import type { Problem, ProblemFilterMode, Store } from '../types';
import { CustomSelect } from './ui/CustomSelect';

type Props = {
  store: Store;
  filtered: Problem[];
  pid: string;
  query: string;
  chapter: string;
  mode: ProblemFilterMode;
  judgeCount: number;
  solved: string[];
  onQuery: (query: string) => void;
  onChapter: (chapter: string) => void;
  onMode: (mode: ProblemFilterMode) => void;
  onSelect: (problem: Problem) => void;
  onSelectById: (id: string) => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  onSearchTrigger?: () => void;
};

function ProblemNav({
  store,
  filtered,
  pid,
  query,
  chapter,
  mode,
  judgeCount,
  solved,
  onQuery,
  onChapter,
  onMode,
  onSelect,
  onSelectById,
  collapsed = false,
  onToggleCollapse
}: Props) {
  const [collapsedChapters, setCollapsedChapters] = useState<Record<string, boolean>>({});

  const toggleChapter = (chId: string) => {
    setCollapsedChapters(prev => ({
      ...prev,
      [chId]: !prev[chId]
    }));
  };

  const handleSearchClick = () => {
    if (collapsed && onToggleCollapse) {
      onToggleCollapse();
      setTimeout(() => {
        const input = document.querySelector('.search-field input') as HTMLInputElement;
        input?.focus();
      }, 120);
    }
  };

  if (collapsed) {
    return (
      <aside className="flex flex-col items-center gap-4 w-12 h-full py-4 bg-ws-bg border-r border-ws-line transition-all">
        <button
          type="button"
          onClick={onToggleCollapse}
          className="flex items-center justify-center w-7 h-7 rounded border border-ws-line text-ws-muted hover:bg-ws-surface-2 hover:text-ws-ink transition-colors"
          title="Expand Navigator"
        >
          <ChevronRight size={14} />
        </button>

        <div className="w-4/5 h-px bg-ws-surface" />

        <button
          type="button"
          onClick={handleSearchClick}
          className="flex items-center justify-center w-7 h-7 rounded border border-ws-line text-ws-muted hover:bg-ws-surface-2 hover:text-ws-ink transition-colors"
          title="Search exercises locally"
        >
          <Search size={13} />
        </button>

        <div className="flex-1 w-full overflow-y-auto flex flex-col items-center gap-3 py-2 scrollbar-none">
          {filtered.map(p => {
            const isActive = p.id === pid;
            const isSolved = solved.includes(p.id);
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => onSelect(p)}
                className={`flex items-center justify-center w-7 h-7 rounded-full text-[11px] font-bold shrink-0 transition-colors border ${isActive ? 'bg-ws-success/10 border-ws-success text-ws-success' : isSolved ? 'bg-ws-success/10 border-ws-success text-ws-success' : 'bg-ws-bg border-ws-line text-ws-muted hover:border-ws-line-strong'}`}
                title={`Exercise ${p.number}: ${shortTitle(p)} (${p.difficulty})`}
              >
                {p.number}
              </button>
            );
          })}
        </div>
      </aside>
    );
  }

  const chaptersWithProblems = store.chapters.filter(ch =>
    filtered.some(p => p.chapter === ch.id)
  );

  return (
    <aside className="flex flex-col h-full p-4 w-[280px] overflow-hidden border-r border-ws-line">
      <div className="flex items-center justify-between mb-3">
        <span className="flex items-center gap-1.5 text-[11px] font-bold text-ws-ink uppercase tracking-widest">
          <Layers size={13} className="text-ws-success" />
          <span>Navigator</span>
        </span>
        <button
          type="button"
          onClick={onToggleCollapse}
          className="flex items-center justify-center w-6 h-6 rounded border border-ws-line text-ws-muted hover:bg-ws-surface-2 hover:text-ws-ink transition-colors"
          title="Collapse Panel"
        >
          <ChevronLeft size={13} />
        </button>
      </div>

      <div className="flex flex-col gap-2.5">
        <label className="relative flex items-center bg-ws-bg border border-ws-line rounded-md px-2.5 h-8">
          <Search size={13} className="text-ws-muted mr-1.5 shrink-0" />
          <input
            value={query}
            onChange={e => onQuery(e.target.value)}
            placeholder="Search exercises..."
            className="flex-1 bg-transparent border-none text-ws-ink outline-none text-[11.5px] min-w-0"
          />
          {query && (
            <button
              type="button"
              onClick={() => onQuery('')}
              className="flex items-center justify-center p-0.5 rounded-full text-ws-muted hover:text-ws-ink shrink-0"
              title="Clear search"
            >
              <X size={11} />
            </button>
          )}
        </label>

        <div className="relative flex w-full">
          <CustomSelect
            value={chapter}
            onChange={val => onChapter(val)}
            options={[
              { value: 'all', label: 'All chapters' },
              ...store.chapters.map(c => ({
                value: c.id,
                label: `${c.id.toUpperCase().replace('CH', 'Ch ')} - ${c.title}`
              }))
            ]}
            className="w-full h-8 px-2.5 py-1 text-[11.5px]"
          />
        </div>

        <div className="flex bg-ws-bg border border-ws-line rounded-lg p-[3px] gap-[2px] my-2">
          <button
            type="button"
            onClick={() => onMode('all')}
            className={`flex-1 flex items-center justify-center gap-1.5 border-none rounded-md text-[11px] font-semibold py-1.5 transition-all ${mode === 'all' ? 'bg-ws-surface-2 text-ws-ink shadow-sm' : 'bg-transparent text-ws-muted'}`}
          >
            All
            <span className={`text-[10px] px-1.5 rounded-full font-bold ${mode === 'all' ? 'bg-ws-surface-3 text-ws-ink' : 'bg-ws-surface-2 text-ws-muted'}`}>
              {store.problems.length}
            </span>
          </button>
          <button
            type="button"
            onClick={() => onMode('judge')}
            className={`flex-1 flex items-center justify-center gap-1.5 border-none rounded-md text-[11px] font-semibold py-1.5 transition-all ${mode === 'judge' ? 'bg-ws-surface-2 text-ws-ink shadow-sm' : 'bg-transparent text-ws-muted'}`}
          >
            Judge
            <span className={`text-[10px] px-1.5 rounded-full font-bold ${mode === 'judge' ? 'bg-ws-surface-3 text-ws-ink' : 'bg-ws-surface-2 text-ws-muted'}`}>
              {judgeCount}
            </span>
          </button>
          <button
            type="button"
            onClick={() => onMode('project')}
            className={`flex-1 flex items-center justify-center gap-1.5 border-none rounded-md text-[11px] font-semibold py-1.5 transition-all ${mode === 'project' ? 'bg-ws-surface-2 text-ws-ink shadow-sm' : 'bg-transparent text-ws-muted'}`}
          >
            Project
            <span className={`text-[10px] px-1.5 rounded-full font-bold ${mode === 'project' ? 'bg-ws-surface-3 text-ws-ink' : 'bg-ws-surface-2 text-ws-muted'}`}>
              {store.problems.length - judgeCount}
            </span>
          </button>
        </div>

        <CustomSelect
          className="mobile-problem-select"
          value={pid}
          onChange={val => onSelectById(val)}
          options={filtered.map(p => ({
            value: p.id,
            label: `${p.number}. ${shortTitle(p)}`
          }))}
          style={{ display: 'none' }}
        />
      </div>

      <div className="flex-1 overflow-y-auto flex flex-col gap-2 pr-0.5 scrollbar">
        {chaptersWithProblems.map((ch, index) => {
          const chProblems = filtered.filter(p => p.chapter === ch.id);
          const chSolvedCount = chProblems.filter(p => solved.includes(p.id)).length;
          const isCollapsed = collapsedChapters[ch.id];
          const hasActiveProblem = chProblems.some(p => p.id === pid);
          const chapterHue = (index * 55) % 360;

          return (
            <div key={ch.id} className="flex flex-col gap-1.5">
              <button
                type="button"
                onClick={() => toggleChapter(ch.id)}
                className={`flex items-center gap-2 w-full px-2.5 py-2 text-left border rounded transition-colors border-l-[3px] ${hasActiveProblem ? 'bg-ws-surface-2 border-ws-line-strong' : 'bg-ws-bg border-zinc-900 hover:bg-ws-surface-2 hover:border-ws-line-strong'}`}
                style={{ borderLeftColor: `hsl(${chapterHue}, 60%, 48%)` }}
              >
                <Layers size={11} style={{ color: `hsl(${chapterHue}, 60%, 48%)` }} className="shrink-0" />
                <span className="text-[11px] font-bold flex-1 whitespace-nowrap overflow-hidden text-ellipsis text-ws-ink">
                  {ch.id.toUpperCase().replace('CH', 'Ch ')} - {ch.title}
                </span>

                <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded border shrink-0 ${chSolvedCount === chProblems.length ? 'text-ws-success bg-ws-success/10 border-ws-success/20' : 'text-ws-muted bg-ws-bg border-ws-line'}`}>
                  {chSolvedCount}/{chProblems.length}
                </span>

                <ChevronRight
                  size={12}
                  className={`text-ws-muted shrink-0 transition-transform duration-150 ${isCollapsed ? '' : 'rotate-90'}`}
                />
              </button>

              {!isCollapsed && (
                <div className="flex flex-col gap-1 pl-1.5 border-l border-dashed border-ws-line ml-1.5 mt-0.5 mb-1">
                  {chProblems.map(p => {
                    const isActiveProblem = p.id === pid;
                    const isSolvedProblem = solved.includes(p.id);
                    const diffColor = p.difficulty === 'Easy' ? '#71d99f' : p.difficulty === 'Medium' ? '#ffb74d' : '#ff8a80';
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => onSelect(p)}
                        className={`flex flex-col gap-0.5 w-full text-left px-2 py-1.5 border rounded transition-colors ${isActiveProblem ? 'bg-ws-surface-2 border-ws-line-strong' : 'bg-transparent border-transparent hover:bg-ws-surface-2'}`}
                      >
                        <div className="flex items-center w-full gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: diffColor }} title={`Difficulty: ${p.difficulty}`} />

                          <span className={`text-[11px] font-bold shrink-0 ${isActiveProblem ? 'text-ws-success' : 'text-ws-muted'}`}>
                            {p.number}.
                          </span>

                          <span className={`text-[11.5px] flex-1 overflow-hidden text-ellipsis whitespace-nowrap ${isActiveProblem ? 'font-bold text-ws-ink' : 'font-medium text-ws-muted'}`}>
                            {shortTitle(p)}
                          </span>

                          {isSolvedProblem && (
                            <CheckCircle2 size={12} className="text-ws-success shrink-0" />
                          )}
                        </div>
                        <span className="text-[9.5px] text-ws-muted pl-3">
                          {chipText(p)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </aside>
  );
}

export default ProblemNav;
