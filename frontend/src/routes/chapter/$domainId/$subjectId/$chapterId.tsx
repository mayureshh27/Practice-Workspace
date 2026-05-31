import { createFileRoute } from '@tanstack/react-router'
import ChapterScreen from '../../../../components/ChapterScreen'
import { useWorkspaceStore } from '../../../../stores/workspaceStore'

import { useEffect } from 'react'

export const Route = createFileRoute(
  '/chapter/$domainId/$subjectId/$chapterId',
)({
  component: ChapterRoute,
})

function ChapterRoute() {
  const { domainId, subjectId, chapterId } = Route.useParams()
  const domains = useWorkspaceStore((s) => s.domains)
  const domain = domains.find((d) => d.id === domainId)
  const subject = domain?.subjects.find((s) => s.id === subjectId)
  const chapter = subject?.chapters.find((c) => c.id === chapterId)

  const updateChapter = useWorkspaceStore((s) => s.updateChapter)
  const removeResource = useWorkspaceStore((s) => s.removeResource)
  const addToRecents = useWorkspaceStore((s) => s.addToRecents)

  useEffect(() => {
    if (chapter) {
      addToRecents(chapter.name, 'chapter', { level: 'chapter', domainId, subjectId, chapterId })
    }
  }, [chapter, domainId, subjectId, chapterId, addToRecents])

  if (!domain || !subject || !chapter) {
    return (
      <div
        style={{ padding: 40, textAlign: 'center', color: "var(--ws-muted)" }}
      >
        Chapter not found.
      </div>
    )
  }

  return (
    <ChapterScreen
      domain={domain}
      subject={subject}
      chapter={chapter}
      onNavigate={() => {}}
      onUpdateChapter={updateChapter}
      onRemoveResource={removeResource}
    />
  )
}
