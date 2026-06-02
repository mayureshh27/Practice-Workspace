import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState, useEffect, useMemo } from 'react'
import { useSuspenseQuery } from '@tanstack/react-query'
import ProblemNav from '../../../../../components/ProblemNav'
import LearningPanel from '../../../../../components/LearningPanel'
import WorkPanel from '../../../../../components/WorkPanel'
import type { FlowTab, Problem, ProblemFilterMode, RunMode, RunResp, Store, Theme, UploadedFile, OutputComparison } from '../../../../../types'
import { useWorkspaceStore } from '../../../../../stores/workspaceStore'
import { problemsQueries } from '../../../../../api/queries'
import { getBrowserStorage, readJsonStorage, readTextStorage, writeJsonStorage, writeTextStorage, removeStorageItem, errorMessage } from '../../../../../appState'
import { API, canSubmit, problemNeedsFiles, buildRunMarkdown, buildOutputComparison } from '../../../../../problemContent'

export const Route = createFileRoute('/topic/$domainId/$subjectId/$chapterId/$topicId')({
  component: TopicRoute,
})

function TopicRoute() {
  const { domainId, subjectId, chapterId, topicId } = Route.useParams()
  const navigate = useNavigate()
  const [practiceNavCollapsed, setPracticeNavCollapsed] = useState(false)
  const [tab, setTab] = useState<FlowTab>('explanation')

  const domainKey = domainId === 'go-programming' ? 'go' : domainId === 'robotics' ? 'robotics' : undefined
  const { data: catalogProblems } = useSuspenseQuery(problemsQueries.catalog(domainKey))
  const domains = useWorkspaceStore(s => s.domains)
  const submitPracticeAttempt = useWorkspaceStore(s => s.submitPracticeAttempt)
  const chatSessionId = useWorkspaceStore(s => s.chatSessionId)

  const store = useMemo<Store | null>(() => {
    const domain = domains.find(d => d.id === domainId)
    const subject = domain?.subjects.find(s => s.id === subjectId)
    if (!subject) return null
    return {
      chapters: subject.chapters.map(ch => ({ id: ch.id, title: ch.name })),
      problems: catalogProblems.problems
    }
  }, [catalogProblems, domains, domainId, subjectId])

  const [pid, setPid] = useState('')
  const [query, setQuery] = useState('')
  const [chapter, setChapter] = useState('all')
  const [mode, setMode] = useState<ProblemFilterMode>('all')
  const [code, setCode] = useState('')
  const [out, setOut] = useState('')
  const [comparison, setComparison] = useState<OutputComparison | null>(null)
  const [verdict, setVerdict] = useState('')
  const [uploaded, setUploaded] = useState<UploadedFile[]>([])
  const [proofReady, setProofReady] = useState(false)
  const [solved, setSolved] = useState<string[]>(() => {
    return readJsonStorage(getBrowserStorage(), 'solved', [] as string[], (v): v is string[] => Array.isArray(v) && v.every(x => typeof x === 'string'))
  })
  const [runningMode, setRunningMode] = useState<RunMode | ''>('')
  const theme: Theme = 'dark'

  const addToRecents = useWorkspaceStore(s => s.addToRecents)

  const activeProblem = useMemo(() => {
    if (!store) return null
    return store.problems.find(p => p.id === pid)
  }, [store, pid])

  const select = (p: Problem) => {
    const storage = getBrowserStorage()
    setPid(p.id)
    setCode(readTextStorage(storage, 'draft:' + p.id, p.starterCode))
    setUploaded(readJsonStorage(storage, 'files:' + p.id, [] as UploadedFile[], (v): v is UploadedFile[] => Array.isArray(v) && v.every(x => x && typeof x === 'object' && typeof (x as any).name === 'string')))
    setProofReady(false)
    setOut('')
    setComparison(null)
    setVerdict('')
    setTab('explanation')
  }

  // Update recents and match route parameter on mount / changes
  useEffect(() => {
    if (store && store.problems.length > 0) {
      const p = store.problems.find(
        prob => prob.id.toLowerCase() === topicId.toLowerCase() ||
                prob.title.toLowerCase().includes(topicId.toLowerCase())
      )
      if (p) {
        select(p)
        addToRecents(p.title, 'topic', { level: 'topic', domainId, subjectId, chapterId, topicId })
      } else {
        const fallback = store.problems[0]
        if (fallback) select(fallback)
      }
    }
  }, [topicId, store, domainId, subjectId, chapterId, addToRecents])

  const handleSelect = (p: Problem) => {
    navigate({
      to: '/topic/$domainId/$subjectId/$chapterId/$topicId',
      params: { domainId, subjectId, chapterId, topicId: p.id }
    })
  }

  const handleSelectById = (id: string) => {
    navigate({
      to: '/topic/$domainId/$subjectId/$chapterId/$topicId',
      params: { domainId, subjectId, chapterId, topicId: id }
    })
  }

  const saveDraft = (value: string | undefined) => {
    const nextCode = value || ''
    setCode(nextCode)
    if (pid) writeTextStorage(getBrowserStorage(), 'draft:' + pid, nextCode)
  }

  const resetDraft = () => {
    if (!activeProblem || runningMode) return
    if (!window.confirm('Reset editor to the starter code? Your current draft will be lost.')) return
    setCode(activeProblem.starterCode)
    removeStorageItem(getBrowserStorage(), 'draft:' + activeProblem.id)
    setOut('')
    setComparison(null)
    setVerdict('')
  }

  const addFiles = async (list: FileList | null) => {
    if (!activeProblem || !list || runningMode) return
    const files = await Promise.all(Array.from(list).map(async file => ({ name: file.name, text: await file.text() })))
    const next = [...uploaded, ...files]
    setUploaded(next)
    writeJsonStorage(getBrowserStorage(), 'files:' + activeProblem.id, next)
    setComparison(null)
    setOut(`### Uploaded files\n\n${next.map(file => `- **${file.name}** (${file.text.length} chars)`).join('\n')}\n\nUse these as your sample inputs while solving this file-based exercise.`)
    setVerdict('Files ready')
  }

  const clearFiles = () => {
    if (!activeProblem) return
    setUploaded([])
    removeStorageItem(getBrowserStorage(), 'files:' + activeProblem.id)
    setOut('')
    setComparison(null)
    setVerdict('')
  }

  const markSolved = (p: Problem) => {
    const next = [...new Set([...solved, p.id])]
    setSolved(next)
    writeJsonStorage(getBrowserStorage(), 'solved', next)
  }

  const showProjectChecklist = () => {
    if (!activeProblem) return
    setProofReady(true)
    setComparison(null)
    setVerdict('Proof checklist')
    setOut(`### Manual completion checklist\n\nBefore marking this project complete, keep a short reproducible proof:\n\n- The command or Run-mode input you used.\n- Any sample file or argument needed by the exercise.\n- The observed output or behavior.\n- A one-sentence note connecting the result to the exercise goal.\n\nProject exercises are not accepted by hidden tests. They are marked complete locally after you have reviewed this checklist.`)
  }

  const markComplete = async () => {
    if (!activeProblem || runningMode) return
    if (canSubmit(activeProblem)) return
    if (!proofReady) {
      showProjectChecklist()
      return
    }
    
    // Submit project completion to backend event store
    await submitPracticeAttempt({
      sessionId: chatSessionId || undefined,
      conceptId: activeProblem.tags?.[0] || activeProblem.id,
      artifactId: activeProblem.id,
      verdict: 'Accepted',
    })

    if (!solved.includes(activeProblem.id)) markSolved(activeProblem)
    setComparison(null)
    setVerdict('Marked complete')
    setOut(`### Marked complete locally\n\n${activeProblem.title} is now recorded in browser localStorage as complete.\n\nKeep your proof command, sample input, and observed output with your notes so you can revisit the project later.`)
  }

  const run = async (runMode: RunMode) => {
    if (runMode === 'submit' && (!activeProblem || !canSubmit(activeProblem))) {
      showProjectChecklist()
      return
    }
    if (!activeProblem || runningMode) return

    setRunningMode(runMode)
    setComparison(null)
    setVerdict('Running...')
    setOut('')

    try {
      const response = await fetch(`${API}/api/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ problemId: pid, code, mode: runMode })
      })
      if (!response.ok) {
        throw new Error(`Execution request failed with status ${response.status}`)
      }
      const data: RunResp = await response.json()
      setVerdict(data.verdict)
      setOut(buildRunMarkdown(data))
      setComparison(buildOutputComparison(activeProblem, runMode, data))

      // Submit the attempt to the backend event store
      await submitPracticeAttempt({
        sessionId: chatSessionId || undefined,
        conceptId: activeProblem.tags?.[0] || activeProblem.id,
        artifactId: activeProblem.id,
        verdict: data.verdict,
        durationMs: data.durationMs,
      })

      if (runMode === 'submit' && data.verdict === 'Accepted') {
        markSolved(activeProblem)
      }
    } catch (error) {
      setVerdict('Error')
      setComparison(null)
      setOut(`### Request failed\n\n${errorMessage(error)}`)
    } finally {
      setRunningMode('')
    }
  }

  const filtered = useMemo(() => {
    if (!store) return []
    const q = query.trim().toLowerCase()
    return store.problems.filter(p => {
      const chMatch = chapter === 'all' || p.chapter === chapter
      const modeMatch = mode === 'all' || p.exerciseMode === mode
      const qMatch = !q || p.title.toLowerCase().includes(q) || p.statement.toLowerCase().includes(q)
      return chMatch && modeMatch && qMatch
    })
  }, [store, query, chapter, mode])

  const canSubmitProblem = activeProblem ? canSubmit(activeProblem) : false
  const needsFiles = activeProblem ? problemNeedsFiles(activeProblem) : false
  const judgeCount = store ? store.problems.filter(p => p.exerciseMode === 'judge').length : 0

  if (!store) {
    return (
      <div className="flex items-center justify-center p-10 h-full w-full bg-ws-floor text-ws-fail font-semibold">
        Failed to load exercise workspace: Problem list empty
      </div>
    )
  }

  return (
    <div className="ws-practice h-full w-full bg-ws-floor">
      <div className={`workspace-layout h-full ${practiceNavCollapsed ? 'collapsed' : ''}`}>
        <ProblemNav
          store={store}
          filtered={filtered}
          pid={pid}
          query={query}
          chapter={chapter}
          mode={mode}
          judgeCount={judgeCount}
          solved={solved}
          onQuery={setQuery}
          onChapter={setChapter}
          onMode={setMode}
          onSelect={handleSelect}
          onSelectById={handleSelectById}
          collapsed={practiceNavCollapsed}
          onToggleCollapse={() => setPracticeNavCollapsed(c => !c)}
          onSearchTrigger={() => {}}
        />
        <main className="workspace-main h-full">
          {activeProblem ? (
            <>
              <LearningPanel problem={activeProblem} tab={tab} onTab={setTab} />
              <WorkPanel
                needsFiles={needsFiles}
                canSubmitProblem={canSubmitProblem}
                code={code}
                theme={theme}
                runningMode={runningMode}
                uploaded={uploaded}
                proofReady={proofReady}
                solved={solved.includes(activeProblem.id)}
                verdict={verdict}
                output={out}
                comparison={comparison}
                onSaveDraft={saveDraft}
                onResetDraft={resetDraft}
                onAddFiles={addFiles}
                onClearFiles={clearFiles}
                onRun={run}
                onMarkComplete={markComplete}
              />
            </>
          ) : (
            <div className="flex items-center justify-center h-full w-full text-ws-ink-muted">
              Select an exercise in the navigator to begin.
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
