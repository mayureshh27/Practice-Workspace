import { test, expect } from 'vitest';
import {
  fetchJson,
  parseJsonResponse,
  readJsonStorage,
  type StorageLike,
} from '../src/appState.ts';

function memoryStorage(seed: Record<string, string>): StorageLike & { removed: string[] } {
  const data = { ...seed };
  return {
    removed: [],
    getItem(key) {
      return Object.hasOwn(data, key) ? data[key] : null;
    },
    setItem(key, value) {
      data[key] = value;
    },
    removeItem(key) {
      this.removed.push(key);
      delete data[key];
    },
  };
}

test('readJsonStorage falls back and clears invalid JSON', () => {
  const storage = memoryStorage({ solved: 'not-json' });
  expect(readJsonStorage(storage, 'solved', [])).toEqual([]);
  expect(storage.removed).toEqual(['solved']);
});

test('readJsonStorage falls back and clears values with invalid shape', () => {
  const storage = memoryStorage({ solved: '{"oops":true}' });
  const isStringArray = (value: unknown): value is string[] =>
    Array.isArray(value) && value.every((item) => typeof item === 'string');
  expect(readJsonStorage(storage, 'solved', [], isStringArray)).toEqual([]);
  expect(storage.removed).toEqual(['solved']);
});

test('parseJsonResponse rejects non-ok responses before parsing JSON', async () => {
  const response = new Response('<h1>Down</h1>', {
    status: 503,
    statusText: 'Service Unavailable',
  });
  await expect(parseJsonResponse(response, 'Run request')).rejects.toThrow(
    /Run request failed \(503 Service Unavailable\): <h1>Down<\/h1>/,
  );
});

test('parseJsonResponse rejects invalid JSON from ok responses', async () => {
  const response = new Response('not-json', { status: 200 });
  await expect(parseJsonResponse(response, 'Problem list')).rejects.toThrow(
    /Problem list returned invalid JSON/,
  );
});

test('fetchJson reports network failures visibly', async () => {
  await expect(
    fetchJson('/api/problems', undefined, 'Problem list', async () => {
      throw new TypeError('fetch failed');
    }),
  ).rejects.toThrow(/Problem list could not reach the backend: fetch failed/);
});
