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
  title: z.string(),
  type: z.string(),
  status: z.string(),
  time: z.string(),
});

export type ArtifactDTO = z.infer<typeof ArtifactSchema>;

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

  // ── Concepts / Graph ─────────────────────────────────────────────

  getConceptGraph: async (): Promise<ConceptGraphDTO> => {
    const res = await fetch(`${API_BASE}/api/concepts/graph`);
    if (!res.ok) throw new Error(`Failed to fetch concept graph: ${res.status}`);
    const data = await res.json();
    return ConceptGraphSchema.parse(data);
  },
};
