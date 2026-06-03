import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import ArtifactViewerScreen from '../components/ArtifactViewerScreen';
import { domainQueries, artifactsQueries } from '../api/queries';
import { useDeleteArtifactMutation } from '../api/mutations';

export const Route = createFileRoute('/artifacts')({
  component: ArtifactsRoute,
});

function ArtifactsRoute() {
  const { data: artifacts = [] } = useQuery(artifactsQueries.list());
  const { data: domains = [] } = useQuery(domainQueries.list());
  const { mutate: deleteArtifact } = useDeleteArtifactMutation();

  return <ArtifactViewerScreen artifacts={artifacts} domains={domains} onDelete={deleteArtifact} />;
}
