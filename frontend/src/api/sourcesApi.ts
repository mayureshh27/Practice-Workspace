import { z } from 'zod';

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000';

export const SourceIngestResponseSchema = z.object({
  status: z.literal('accepted'),
  sourceId: z.string(),
});
export type SourceIngestResponse = z.infer<typeof SourceIngestResponseSchema>;

export const IngestFileRequestSchema = z.object({
  subjectId: z.string(),
  domainId: z.string(),
  fileName: z.string(),
  mimeType: z.string(),
});

export async function ingestSource(body: {
  subjectId: string;
  domainId: string;
  fileName: string;
  mimeType: string;
  // File content is sent as multipart or base64 — TBD by backend contract
  content?: string;
}): Promise<SourceIngestResponse> {
  const res = await fetch(`${API_BASE}/api/sources/ingest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error((err as { detail?: string }).detail ?? `Ingest failed: ${res.status}`);
  }
  return SourceIngestResponseSchema.parse(await res.json());
}
