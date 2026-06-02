import { z } from 'zod';

// --- Zod Schemas (validated against FastAPI backend responses) ---

export const ResourceSchema = z.object({
  id: z.string(),
  name: z.string(),
  lines: z.number(),
  fileType: z.string(),
});

export const TopicSchema = z.object({
  id: z.string(),
  name: z.string(),
  lastMessage: z.string().optional().nullable(),
  pinned: z.boolean().optional().nullable(),
  archived: z.boolean().optional().nullable(),
});

export const ChapterSchema = z.object({
  id: z.string(),
  name: z.string(),
  topics: z.array(TopicSchema),
  pinned: z.boolean().optional().nullable(),
  archived: z.boolean().optional().nullable(),
  description: z.string().optional().nullable(),
  instructions: z.string().optional().nullable(),
  memory: z.string().optional().nullable(),
});

export const SubjectSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional().nullable(),
  chapters: z.array(ChapterSchema),
  resources: z.array(ResourceSchema),
  instructions: z.string().optional().nullable(),
  memory: z.string().optional().nullable(),
  pinned: z.boolean().optional().nullable(),
  archived: z.boolean().optional().nullable(),
});

export const DomainSchema = z.object({
  id: z.string(),
  name: z.string(),
  subjects: z.array(SubjectSchema),
  pinned: z.boolean().optional().nullable(),
  archived: z.boolean().optional().nullable(),
});

export type DomainDTO = z.infer<typeof DomainSchema>;
export type SubjectDTO = z.infer<typeof SubjectSchema>;
export type ChapterDTO = z.infer<typeof ChapterSchema>;
export type TopicDTO = z.infer<typeof TopicSchema>;

// --- Chat & Mastery schemas ---

export const ChatMessageResponseSchema = z.object({
  sessionId: z.string(),
  response: z.string(),
  hintEventId: z.string().optional().nullable(),
});

export const SessionCreateResponseSchema = z.object({
  sessionId: z.string(),
});

export const SessionEndResponseSchema = z.object({
  sessionId: z.string(),
  summaryText: z.string().optional().nullable(),
  eventCount: z.number(),
});

export const ConceptMasterySchema = z.object({
  conceptId: z.string(),
  masteryScore: z.number(),
  previousMastery: z.number(),
  triggerEventId: z.string().optional().nullable(),
  updatedAt: z.string().optional().nullable(),
});

export const BlindSpotSchema = z.object({
  conceptId: z.string(),
  attemptCount: z.number(),
  sessionCount: z.number(),
  detectedAt: z.string().optional().nullable(),
});

export const EventResponseSchema = z.object({
  status: z.string(),
  eventId: z.string(),
});

export type ChatMessageResponse = z.infer<typeof ChatMessageResponseSchema>;
export type ConceptMasteryDTO = z.infer<typeof ConceptMasterySchema>;
export type BlindSpotDTO = z.infer<typeof BlindSpotSchema>;

// ── Sources schemas ─────────────────────────────────────────────────

export const ChunkPreviewSchema = z.object({
  id: z.string(),
  text: z.string(),
});

export const SourceSchema = z.object({
  id: z.string(),
  title: z.string(),
  type: z.string(),
  chunkCount: z.number(),
  inContext: z.boolean(),
  chunks: z.array(ChunkPreviewSchema),
});

export type SourceDTO = z.infer<typeof SourceSchema>;
export type ChunkPreviewDTO = z.infer<typeof ChunkPreviewSchema>;

// ── Artifacts schemas ───────────────────────────────────────────────

export const ArtifactSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.string(),
  status: z.string(),
  time: z.string(),
  domainId: z.string().optional().nullable(),
  subjectId: z.string().optional().nullable(),
  chapterId: z.string().optional().nullable(),
  topicId: z.string().optional().nullable(),
  payload: z.record(z.any()).optional().nullable(),
});

export type ArtifactDTO = z.infer<typeof ArtifactSchema>;

// ── Workflow templates ──────────────────────────────────────────────

export const PracticeConfigSchema = z.object({
  count: z.number().int().nonnegative(),
  difficulty: z.string(),
  scope: z.enum(['subject', 'chapter', 'topic']),
});

export const WorkflowTemplateSchema = z.object({
  id: z.string(),
  name: z.string(),
  targetType: z.string(),
  description: z.string(),
  lastRun: z.string().optional().nullable(),
  evalGates: z.number().int().nonnegative(),
  scope: z.enum(['global', 'subject', 'chapter', 'topic']),
  subjectId: z.string().optional().nullable(),
  chapterId: z.string().optional().nullable(),
  topicId: z.string().optional().nullable(),
  promptTemplate: z.string(),
  practiceConfig: PracticeConfigSchema.optional().nullable(),
});

export const WorkflowListResponseSchema = z.object({
  items: z.array(WorkflowTemplateSchema),
  modelConfigured: z.boolean(),
});

export type WorkflowTemplateDTO = z.infer<typeof WorkflowTemplateSchema>;
export type PracticeConfigDTO = z.infer<typeof PracticeConfigSchema>;
export type WorkflowListResponse = z.infer<typeof WorkflowListResponseSchema>;

// ── Concept Graph schemas ───────────────────────────────────────────

export const ConceptNodeDTOSchema = z.object({
  id: z.string(),
  label: z.string(),
  mastery: z.string(),
});

export const ConceptEdgeDTOSchema = z.object({
  fromId: z.string(),
  toId: z.string(),
});

export const ConceptGraphSchema = z.object({
  nodes: z.array(ConceptNodeDTOSchema),
  edges: z.array(ConceptEdgeDTOSchema),
});

export type ConceptGraphDTO = z.infer<typeof ConceptGraphSchema>;
export type ConceptNodeDTO = z.infer<typeof ConceptNodeDTOSchema>;
export type ConceptEdgeDTO = z.infer<typeof ConceptEdgeDTOSchema>;

// --- API Base URL ---
// Set VITE_API_BASE_URL to point to the FastAPI backend.
// Defaults to local backend on port 8000.
const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000';

// --- API Fetchers (HTTP calls to FastAPI backend) ---

export const api = {
  // ── Workspace hierarchy ──────────────────────────────────────────
  getDomains: async (): Promise<DomainDTO[]> => {
    const res = await fetch(`${API_BASE}/api/domains/`);
    if (!res.ok) throw new Error(`Failed to fetch domains: ${res.status}`);
    const data = await res.json();
    return z.array(DomainSchema).parse(data);
  },

  getDomain: async (domainId: string): Promise<DomainDTO> => {
    const res = await fetch(`${API_BASE}/api/domains/${domainId}`);
    if (!res.ok) throw new Error(`Domain not found: ${domainId}`);
    const data = await res.json();
    return DomainSchema.parse(data);
  },

  getSubject: async (domainId: string, subjectId: string): Promise<SubjectDTO> => {
    const res = await fetch(`${API_BASE}/api/domains/${domainId}/subjects/${subjectId}`);
    if (!res.ok) throw new Error(`Subject not found: ${subjectId}`);
    const data = await res.json();
    return SubjectSchema.parse(data);
  },

  getChapter: async (domainId: string, subjectId: string, chapterId: string): Promise<ChapterDTO> => {
    const res = await fetch(`${API_BASE}/api/domains/${domainId}/subjects/${subjectId}/chapters/${chapterId}`);
    if (!res.ok) throw new Error(`Chapter not found: ${chapterId}`);
    const data = await res.json();
    return ChapterSchema.parse(data);
  },

  getTopic: async (domainId: string, subjectId: string, chapterId: string, topicId: string): Promise<TopicDTO> => {
    const res = await fetch(`${API_BASE}/api/domains/${domainId}/subjects/${subjectId}/chapters/${chapterId}/topics/${topicId}`);
    if (!res.ok) throw new Error(`Topic not found: ${topicId}`);
    const data = await res.json();
    return TopicSchema.parse(data);
  },

  // ── Workspace mutations ──────────────────────────────────────────

  addDomain: async (name: string): Promise<DomainDTO> => {
    const res = await fetch(`${API_BASE}/api/domains/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) throw new Error(`Failed to create domain: ${res.status}`);
    return DomainSchema.parse(await res.json());
  },

  renameDomain: async (domainId: string, name: string): Promise<DomainDTO> => {
    const res = await fetch(`${API_BASE}/api/domains/${domainId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) throw new Error(`Failed to rename domain: ${res.status}`);
    return DomainSchema.parse(await res.json());
  },

  togglePinDomain: async (domainId: string, pinned: boolean): Promise<DomainDTO> => {
    const res = await fetch(`${API_BASE}/api/domains/${domainId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pinned }),
    });
    if (!res.ok) throw new Error(`Failed to toggle pin: ${res.status}`);
    return DomainSchema.parse(await res.json());
  },

  toggleArchiveDomain: async (domainId: string, archived: boolean): Promise<DomainDTO> => {
    const res = await fetch(`${API_BASE}/api/domains/${domainId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ archived }),
    });
    if (!res.ok) throw new Error(`Failed to toggle archive: ${res.status}`);
    return DomainSchema.parse(await res.json());
  },

  deleteDomain: async (domainId: string): Promise<void> => {
    const res = await fetch(`${API_BASE}/api/domains/${domainId}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error(`Failed to delete domain: ${res.status}`);
  },

  addSubject: async (domainId: string, name: string, description?: string): Promise<SubjectDTO> => {
    const res = await fetch(`${API_BASE}/api/domains/${domainId}/subjects/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description }),
    });
    if (!res.ok) throw new Error(`Failed to create subject: ${res.status}`);
    return SubjectSchema.parse(await res.json());
  },

  renameSubject: async (domainId: string, subjectId: string, name: string): Promise<SubjectDTO> => {
    const res = await fetch(`${API_BASE}/api/domains/${domainId}/subjects/${subjectId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) throw new Error(`Failed to rename subject: ${res.status}`);
    return SubjectSchema.parse(await res.json());
  },

  deleteSubject: async (domainId: string, subjectId: string): Promise<void> => {
    const res = await fetch(`${API_BASE}/api/domains/${domainId}/subjects/${subjectId}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error(`Failed to delete subject: ${res.status}`);
  },

  addChapter: async (domainId: string, subjectId: string, name: string, description?: string): Promise<ChapterDTO> => {
    const res = await fetch(`${API_BASE}/api/domains/${domainId}/subjects/${subjectId}/chapters/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description }),
    });
    if (!res.ok) throw new Error(`Failed to create chapter: ${res.status}`);
    return ChapterSchema.parse(await res.json());
  },

  addTopic: async (domainId: string, subjectId: string, chapterId: string, name: string): Promise<TopicDTO> => {
    const res = await fetch(`${API_BASE}/api/domains/${domainId}/subjects/${subjectId}/chapters/${chapterId}/topics/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) throw new Error(`Failed to create topic: ${res.status}`);
    return TopicSchema.parse(await res.json());
  },

  // ── Practice events ──────────────────────────────────────────────

  submitAttempt: async (attempt: {
    sessionId?: string;
    artifactId?: string;
    conceptId?: string;
    verdict: string;
    hintCount?: number;
    durationMs?: number;
  }) => {
    const body = {
      session_id: attempt.sessionId ?? null,
      artifact_id: attempt.artifactId ?? null,
      concept_id: attempt.conceptId ?? null,
      verdict: attempt.verdict,
      hint_count: attempt.hintCount ?? 0,
      duration_ms: attempt.durationMs ?? null,
    };
    const res = await fetch(`${API_BASE}/api/events/attempt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Failed to submit attempt: ${res.status}`);
    const data = await res.json();
    return EventResponseSchema.parse(data);
  },

  // ── Chat ─────────────────────────────────────────────────────────

  createChatSession: async () => {
    const res = await fetch(`${API_BASE}/api/chat/sessions`, {
      method: 'POST',
    });
    if (!res.ok) throw new Error(`Failed to create chat session: ${res.status}`);
    const data = await res.json();
    return SessionCreateResponseSchema.parse(data);
  },

  sendChatMessage: async (
    sessionId: string,
    message: string,
    conceptIds: string[] = [],
    sourceIds: string[] = [],
  ): Promise<ChatMessageResponse> => {
    const body = {
      session_id: sessionId,
      message,
      concept_ids: conceptIds,
      source_ids: sourceIds,
    };
    const res = await fetch(`${API_BASE}/api/chat/message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Chat message failed: ${res.status}`);
    const data = await res.json();
    return ChatMessageResponseSchema.parse(data);
  },

  /** Stream a chat message response via SSE. Returns an async iterator of text chunks. */
  streamChatMessage: async function* (
    sessionId: string,
    message: string,
    conceptIds: string[] = [],
    sourceIds: string[] = [],
  ): AsyncGenerator<string, void, unknown> {
    const body = {
      session_id: sessionId,
      message,
      concept_ids: conceptIds,
      source_ids: sourceIds,
    };
    const res = await fetch(`${API_BASE}/api/chat/message/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Chat stream failed: ${res.status}`);

    const reader = res.body?.getReader();
    if (!reader) throw new Error('No response body for streaming');

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') return;
          yield data;
        }
      }
    }
  },

  endChatSession: async (sessionId: string) => {
    const res = await fetch(`${API_BASE}/api/chat/sessions/${sessionId}/end`, {
      method: 'POST',
    });
    if (!res.ok) throw new Error(`Failed to end chat session: ${res.status}`);
    const data = await res.json();
    return SessionEndResponseSchema.parse(data);
  },

  // ── Mastery ──────────────────────────────────────────────────────

  getMasteryScores: async (): Promise<ConceptMasteryDTO[]> => {
    const res = await fetch(`${API_BASE}/api/mastery/concepts`);
    if (!res.ok) throw new Error(`Failed to fetch mastery scores: ${res.status}`);
    const data = await res.json();
    return z.array(ConceptMasterySchema).parse(data);
  },

  getBlindSpots: async (): Promise<BlindSpotDTO[]> => {
    const res = await fetch(`${API_BASE}/api/mastery/blind-spots`);
    if (!res.ok) throw new Error(`Failed to fetch blind spots: ${res.status}`);
    const data = await res.json();
    return z.array(BlindSpotSchema).parse(data);
  },

  // ── Sources ──────────────────────────────────────────────────────

  getSources: async (): Promise<SourceDTO[]> => {
    const res = await fetch(`${API_BASE}/api/sources/`);
    if (!res.ok) throw new Error(`Failed to fetch sources: ${res.status}`);
    const data = await res.json();
    return z.array(SourceSchema).parse(data);
  },

  getSourceChunks: async (sourceId: string): Promise<ChunkPreviewDTO[]> => {
    const res = await fetch(`${API_BASE}/api/sources/${sourceId}/chunks`);
    if (!res.ok) throw new Error(`Failed to fetch chunks: ${res.status}`);
    const data = await res.json();
    return z.array(ChunkPreviewSchema).parse(data);
  },

  // ── Artifacts ────────────────────────────────────────────────────

  getArtifacts: async (): Promise<ArtifactDTO[]> => {
    const res = await fetch(`${API_BASE}/api/artifacts/`);
    if (!res.ok) throw new Error(`Failed to fetch artifacts: ${res.status}`);
    const data = await res.json();
    return z.array(ArtifactSchema).parse(data);
  },

  createArtifact: async (body: {
    name: string;
    type?: string;
    status?: string;
    domainId?: string;
    subjectId?: string;
    chapterId?: string;
    topicId?: string;
    payload?: Record<string, any>;
  }): Promise<ArtifactDTO> => {
    const res = await fetch(`${API_BASE}/api/artifacts/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Failed to create artifact: ${res.status}`);
    return ArtifactSchema.parse(await res.json());
  },

  // ── Workflows ────────────────────────────────────────────────────

  getWorkflows: async (params?: {
    scope?: 'global' | 'subject' | 'chapter' | 'topic';
    subjectId?: string;
    chapterId?: string;
    topicId?: string;
  }): Promise<WorkflowListResponse> => {
    const qs = params
      ? '?' + Object.entries(params)
          .filter(([, v]) => v != null && v !== '')
          .map(([k, v]) => `${k}=${encodeURIComponent(v as string)}`)
          .join('&')
      : '';
    const res = await fetch(`${API_BASE}/api/workflows/${qs}`);
    if (!res.ok) throw new Error(`Failed to fetch workflows: ${res.status}`);
    return WorkflowListResponseSchema.parse(await res.json());
  },

  getWorkflow: async (id: string): Promise<WorkflowTemplateDTO> => {
    const res = await fetch(`${API_BASE}/api/workflows/${id}`);
    if (!res.ok) throw new Error(`Workflow not found: ${id}`);
    return WorkflowTemplateSchema.parse(await res.json());
  },

  addWorkflow: async (body: {
    name: string;
    targetType?: string;
    description?: string;
    scope?: 'global' | 'subject' | 'chapter' | 'topic';
    subjectId?: string;
    chapterId?: string;
    topicId?: string;
    promptTemplate?: string;
    practiceConfig?: PracticeConfigDTO;
    evalGates?: number;
  }): Promise<WorkflowTemplateDTO> => {
    const res = await fetch(`${API_BASE}/api/workflows/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Failed to create workflow: ${res.status}`);
    return WorkflowTemplateSchema.parse(await res.json());
  },

  updateWorkflow: async (
    id: string,
    fields: Partial<{
      name: string;
      targetType: string;
      description: string;
      lastRun: string;
      evalGates: number;
      scope: 'global' | 'subject' | 'chapter' | 'topic';
      subjectId: string;
      chapterId: string;
      topicId: string;
      promptTemplate: string;
      practiceConfig: PracticeConfigDTO;
    }>,
  ): Promise<WorkflowTemplateDTO> => {
    const res = await fetch(`${API_BASE}/api/workflows/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fields),
    });
    if (!res.ok) throw new Error(`Failed to update workflow: ${res.status}`);
    return WorkflowTemplateSchema.parse(await res.json());
  },

  deleteWorkflow: async (id: string): Promise<void> => {
    const res = await fetch(`${API_BASE}/api/workflows/${id}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error(`Failed to delete workflow: ${res.status}`);
  },

  duplicateWorkflow: async (id: string): Promise<WorkflowTemplateDTO> => {
    const res = await fetch(`${API_BASE}/api/workflows/${id}/duplicate`, {
      method: 'POST',
    });
    if (!res.ok) throw new Error(`Failed to duplicate workflow: ${res.status}`);
    return WorkflowTemplateSchema.parse(await res.json());
  },

  customizeWorkflow: async (
    id: string,
    target: { subjectId?: string; chapterId?: string; topicId?: string },
  ): Promise<WorkflowTemplateDTO> => {
    const res = await fetch(`${API_BASE}/api/workflows/${id}/customize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(target),
    });
    if (!res.ok) throw new Error(`Failed to customise workflow: ${res.status}`);
    return WorkflowTemplateSchema.parse(await res.json());
  },

  // ── Practice generation (Phase 6 — real LLM call) ────────────────

  runPracticeWorkflow: async (body: {
    workflowId: string;
    domainId: string;
    subjectId: string;
    chapterId?: string;
    topicId?: string;
    count?: number;
    difficulty?: string;
  }): Promise<ArtifactDTO> => {
    const res = await fetch(`${API_BASE}/api/practice-exercises/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail ?? `Practice generation failed: ${res.status}`);
    }
    return ArtifactSchema.parse(await res.json());
  },

  // ── Concepts / Graph ─────────────────────────────────────────────

  getConceptGraph: async (): Promise<ConceptGraphDTO> => {
    const res = await fetch(`${API_BASE}/api/concepts/graph`);
    if (!res.ok) throw new Error(`Failed to fetch concept graph: ${res.status}`);
    const data = await res.json();
    return ConceptGraphSchema.parse(data);
  },
};
