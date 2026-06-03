import { createFileRoute } from '@tanstack/react-router';
import { useNavigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import SourceNotebookScreen from '../../../components/SourceNotebookScreen';
import { domainQueries } from '../../../api/queries';

export const Route = createFileRoute('/notebook/$domainId/$subjectId')({
  component: NotebookRoute,
});

function NotebookRoute() {
  const { domainId, subjectId } = Route.useParams();
  const { data: domains = [] } = useQuery(domainQueries.list());
  const navigate = useNavigate();

  const domain = domains.find((d) => d.id === domainId);
  const subject = domain?.subjects.find((s) => s.id === subjectId);

  if (!domain || !subject) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: 'var(--ws-muted)' }}>
        Notebook target not found.
      </div>
    );
  }

  return (
    <SourceNotebookScreen
      domain={domain}
      subject={subject}
      onNavigate={(loc) => {
        if (loc.level === 'subject' && 'domainId' in loc) {
          navigate({
            to: `/subject/$domainId/$subjectId`,
            params: { domainId: loc.domainId, subjectId: loc.subjectId },
          });
        }
      }}
    />
  );
}
