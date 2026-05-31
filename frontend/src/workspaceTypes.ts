/* ── Hierarchical learning model ──────────────────────────────────── */

export type Resource = {
  id: string;
  name: string;
  lines: number;
  fileType: string; // 'PDF' | 'HTML' | 'JS' | 'MD' | 'TXT' etc.
};

export type Topic = {
  id: string;
  name: string;
  lastMessage?: string | null;
  pinned?: boolean | null;
  archived?: boolean | null;
};

export type Chapter = {
  id: string;
  name: string;
  topics: Topic[];
  pinned?: boolean | null;
  archived?: boolean | null;
  description?: string | null;
  instructions?: string | null;
  memory?: string | null;
};

export type Subject = {
  id: string;
  name: string;
  description?: string | null;
  chapters: Chapter[];
  resources: Resource[];
  instructions?: string | null;
  memory?: string | null;
  pinned?: boolean | null;
  archived?: boolean | null;
};

export type Domain = {
  id: string;
  name: string;
  subjects: Subject[];
  pinned?: boolean | null;
  archived?: boolean | null;
};

/* ── Navigation ──────────────────────────────────────────────────── */

export type NavLocation =
  | { level: 'root' }
  | { level: 'domain'; domainId: string }
  | { level: 'subject'; domainId: string; subjectId: string }
  | { level: 'chapter'; domainId: string; subjectId: string; chapterId: string }
  | { level: 'topic'; domainId: string; subjectId: string; chapterId: string; topicId: string }
  | { level: 'notebook'; domainId?: string; subjectId?: string }
  | { level: 'workflows' }
  | { level: 'workflow-editor'; workflowId?: string }
  | { level: 'artifacts' }
  | { level: 'graph' };

export type RecentItem = {
  id: string;
  label: string;
  type: 'subject' | 'chapter' | 'topic' | 'notebook' | 'artifact';
  loc: NavLocation;
  time: string;
};

/** Identifiers for right-dock panel slots. Only one can be open at a time. */
export type RightDockPanel = 'sources' | 'tutor' | 'artifacts' | 'memory' | 'graph' | 'context' | 'inspector' | null;

/** Identifiers for bottom-dock tab slots. */
export type BottomDockTab = 'output' | 'tests' | 'terminal' | 'sandbox' | 'evals' | 'logs';

/* ── Workflow templates ──────────────────────────────────────────── */

export type WorkflowTemplate = {
  id: string;
  name: string;
  targetType: string; // 'Exercise Pack' | 'Lesson' | 'Quiz' | 'Summary' etc.
  description: string;
  lastRun?: string;
  evalGates: number;
};

/* ── Artifact ────────────────────────────────────────────────────── */

export type Artifact = {
  id: string;
  name: string;
  type: string;
  status: 'approved' | 'draft' | 'reviewed';
  domainId: string;
  subjectId: string;
  chapterId?: string;
  topicId?: string;
  time: string;
};
