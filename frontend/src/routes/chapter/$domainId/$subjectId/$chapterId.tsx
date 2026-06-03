import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import ChapterScreen from '../../../../components/ChapterScreen';
import { useWorkspaceStore } from '../../../../stores/workspaceStore';
import { domainQueries } from '../../../../api/queries';
import { useUpdateChapterMutation, useRemoveResourceMutation } from '../../../../api/mutations';

import { useEffect } from 'react';

export const Route = createFileRoute('/chapter/$domainId/$subjectId/$chapterId')({
  component: ChapterRoute,
});

function ChapterRoute() {
  const { domainId, subjectId, chapterId } = Route.useParams();

  const { data: domains = [] } = useQuery(domainQueries.list());
  const domain = domains.find((d) => d.id === domainId);
  const subject = domain?.subjects.find((s) => s.id === subjectId);
  const chapter = subject?.chapters.find((c) => c.id === chapterId);

  const { mutate: updateChapter } = useUpdateChapterMutation();
  const { mutate: removeResource } = useRemoveResourceMutation();

  const addToRecents = useWorkspaceStore((s) => s.addToRecents);

  useEffect(() => {
    if (chapter) {
      addToRecents(chapter.name, 'chapter', { level: 'chapter', domainId, subjectId, chapterId });
    }
  }, [chapter, domainId, subjectId, chapterId, addToRecents]);

  if (!domain || !subject || !chapter) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: 'var(--ws-muted)' }}>
        Chapter not found.
      </div>
    );
  }

  return (
    <ChapterScreen
      domain={domain}
      subject={subject}
      chapter={chapter}
      onNavigate={() => {}}
      onUpdateChapter={(dId, sId, cId, fields) =>
        updateChapter({ domainId: dId, subjectId: sId, chapterId: cId, fields })
      }
      onRemoveResource={(dId, sId, rId) =>
        removeResource({ domainId: dId, subjectId: sId, resourceId: rId })
      }
    />
  );
}
