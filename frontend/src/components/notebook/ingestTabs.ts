// Typed ingest tab definitions — no `as any` required when mapping over these.

export type IngestTab = 'upload' | 'github' | 'web' | 'drive' | 'text';
export type IngestFilter = 'web' | 'github';

export type IngestTabDef = {
  readonly id: IngestTab;
  readonly label: string;
  readonly iconName: string; // lucide icon name; resolved in IngestionModal
};

export const INGEST_TABS: readonly IngestTabDef[] = [
  { id: 'upload', label: 'Upload Files', iconName: 'Upload' },
  { id: 'github', label: 'GitHub Repo', iconName: 'Github' },
  { id: 'web', label: 'Websites', iconName: 'Globe' },
  { id: 'drive', label: 'Google Drive', iconName: 'Cloud' },
  { id: 'text', label: 'Copied Text', iconName: 'Clipboard' },
] as const;
