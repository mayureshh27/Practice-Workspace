import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import SubjectScreen from '../../../components/SubjectScreen';
import { useWorkspaceStore } from '../../../stores/workspaceStore';
import { domainQueries } from '../../../api/queries';
import { useUpdateSubjectMutation, useRemoveResourceMutation } from '../../../api/mutations';

import { useEffect } from 'react';
import { useUIStore } from '../../../stores/uiStore';

export const Route = createFileRoute('/subject/$domainId/$subjectId')({
  component: SubjectRoute,
});

function SubjectRoute() {
  const { domainId, subjectId } = Route.useParams();
  const setCreationModal = useUIStore((s) => s.setCreationModal);

  const { data: domains = [] } = useQuery(domainQueries.list());
  const domain = domains.find((d) => d.id === domainId);
  const subject = domain?.subjects.find((s) => s.id === subjectId);

  const { mutate: updateSubject } = useUpdateSubjectMutation();
  const { mutate: removeResource } = useRemoveResourceMutation();

  const addToRecents = useWorkspaceStore((s) => s.addToRecents);

  useEffect(() => {
    if (subject) {
      addToRecents(subject.name, 'subject', { level: 'subject', domainId, subjectId });
    }
  }, [subject, domainId, subjectId, addToRecents]);

  if (!domain || !subject) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: 'var(--ws-muted)' }}>
        Subject not found.
      </div>
    );
  }

  return (
    <SubjectScreen
      domain={domain}
      subject={subject}
      onNavigate={() => {}}
      onUpdateSubject={(dId, sId, fields) =>
        updateSubject({ domainId: dId, subjectId: sId, fields })
      }
      onRemoveResource={(dId, sId, rId) =>
        removeResource({ domainId: dId, subjectId: sId, resourceId: rId })
      }
      onOpenCreateModal={(type, dId, sId) =>
        setCreationModal({ open: true, type: type as any, domainId: dId, subjectId: sId })
      }
    />
  );
}
