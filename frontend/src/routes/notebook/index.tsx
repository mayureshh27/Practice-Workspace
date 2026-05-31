import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { Folder } from 'lucide-react'
import { useWorkspaceStore } from '../../stores/workspaceStore'

export const Route = createFileRoute('/notebook/')({
  component: NotebookIndexRoute,
})

function NotebookIndexRoute() {
  const domains = useWorkspaceStore(s => s.domains)
  const navigate = useNavigate()

  return (
    <div className="px-6 py-8 max-w-[1000px] mx-auto h-full overflow-y-auto scrollbar">
      <div className="mb-7">
        <h1 className="text-2xl font-extrabold text-ws-ink m-0 mb-1.5 tracking-tight">
          Reference Source Notebooks
        </h1>
        <p className="text-[13px] text-ws-ink-2 m-0">
          Select a subject context below to launch its dedicated Source Notebook and compile audio summaries or problem sets.
        </p>
      </div>

      <div className="flex flex-col gap-6">
        {domains.map(d => (
          <div key={d.id} className="bg-ws-bench border border-ws-edge-soft rounded-lg p-5">
            <h2 className="text-base font-bold text-ws-ink mt-0 mb-3 flex items-center gap-2">
              <Folder size={16} className="text-ws-glow" />
              {d.name}
            </h2>

            <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-3">
              {d.subjects.map(s => (
                <div
                  key={s.id}
                  onClick={() => navigate({
                    to: '/notebook/$domainId/$subjectId',
                    params: { domainId: d.id, subjectId: s.id }
                  })}
                  className="bg-ws-floor border border-ws-edge-soft rounded-md p-4 cursor-pointer flex flex-col gap-2.5 transition-all hover:border-ws-glow duration-150"
                >
                  <div>
                    <h3 className="text-sm font-semibold text-ws-ink m-0 mb-1">{s.name}</h3>
                    {s.description && (
                      <p className="text-[11px] text-ws-ink-muted m-0 leading-normal overflow-hidden text-ellipsis whitespace-nowrap">
                        {s.description}
                      </p>
                    )}
                  </div>
                  
                  <div className="flex justify-between items-center text-[10px] text-ws-glow font-semibold border-t border-ws-edge-soft pt-2">
                    <span>{s.resources?.length || 0} Reference Sources</span>
                    <span className="uppercase text-[9px] tracking-wider">Launch Notebook ›</span>
                  </div>
                </div>
              ))}
              {d.subjects.length === 0 && (
                <div className="col-span-full text-xs text-ws-ink-muted italic p-3">
                  No subjects inside this domain yet.
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
