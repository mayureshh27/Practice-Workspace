import { describe, it, expect, vi } from 'vitest';
import { ingestSource } from '../src/api/sourcesApi';

global.fetch = vi.fn();

describe('sourcesApi', () => {
  it('should successfully ingest source', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: 'accepted', sourceId: '123' }),
    });

    const res = await ingestSource({
      subjectId: 's1',
      domainId: 'd1',
      fileName: 'test.pdf',
      mimeType: 'application/pdf',
    });

    expect(res.status).toBe('accepted');
    expect(res.sourceId).toBe('123');
  });

  it('should throw error on bad response', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: false,
      status: 400,
      statusText: 'Bad Request',
      json: async () => ({ detail: 'Invalid file' }),
    });

    await expect(
      ingestSource({
        subjectId: 's1',
        domainId: 'd1',
        fileName: 'test.pdf',
        mimeType: 'application/pdf',
      }),
    ).rejects.toThrow('Invalid file');
  });

  it('should fallback to statusText on generic error', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Server Error',
      json: async () => {
        throw new Error('Not json');
      },
    });

    await expect(
      ingestSource({
        subjectId: 's1',
        domainId: 'd1',
        fileName: 'test.pdf',
        mimeType: 'application/pdf',
      }),
    ).rejects.toThrow('Server Error');
  });
});
