import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { HttpError, describeError, errorCode } from '@/lib/errors';
import { apiError, requireAdmin, requireBearer, safeEqual } from '@/lib/http';

const request = (headers: Record<string, string>) => new Request('http://localhost/api', { headers });

describe('safeEqual', () => {
  it('matches only identical non-empty strings', () => {
    expect(safeEqual('secret', 'secret')).toBe(true);
    expect(safeEqual('secret', 'secreT')).toBe(false);
    expect(safeEqual('short', 'longer-value')).toBe(false);
    expect(safeEqual('', '')).toBe(false);
    expect(safeEqual(null, 'secret')).toBe(false);
    expect(safeEqual('secret', undefined)).toBe(false);
  });
});

describe('requireBearer', () => {
  it('accepts the exact bearer token', () => {
    expect(requireBearer(request({ authorization: 'Bearer abc' }), 'abc')).toBe(true);
  });
  it('rejects wrong, missing or unconfigured secrets', () => {
    expect(requireBearer(request({ authorization: 'Bearer abd' }), 'abc')).toBe(false);
    expect(requireBearer(request({}), 'abc')).toBe(false);
    expect(requireBearer(request({ authorization: 'Bearer ' }), '')).toBe(false);
    expect(requireBearer(request({ authorization: 'Bearer undefined' }), undefined)).toBe(false);
  });
});

describe('requireAdmin', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('checks the x-admin-password header against ADMIN_PASSWORD', () => {
    vi.stubEnv('ADMIN_PASSWORD', 'pw');
    expect(requireAdmin(request({ 'x-admin-password': 'pw' }))).toBe(true);
    expect(requireAdmin(request({ 'x-admin-password': 'nope' }))).toBe(false);
  });
  it('denies everything when no password is configured', () => {
    vi.stubEnv('ADMIN_PASSWORD', '');
    expect(requireAdmin(request({ 'x-admin-password': '' }))).toBe(false);
  });
});

describe('apiError', () => {
  afterEach(() => vi.restoreAllMocks());

  it('uses the status carried by HttpError', async () => {
    const response = apiError(new HttpError(409, 'conflict'));
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: 'conflict' });
  });
  it('maps validation failures to 400 without leaking details', async () => {
    const result = z.object({ a: z.string() }).safeParse({});
    const response = apiError(result.error);
    expect(response.status).toBe(400);
    expect(JSON.stringify(await response.json())).not.toContain('"a"');
  });
  it('hides unexpected error messages behind a generic 500', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const response = apiError(new Error('password authentication failed for user neondb_owner'));
    expect(response.status).toBe(500);
    expect(JSON.stringify(await response.json())).not.toContain('neondb_owner');
  });
  it('reports missing configuration as 503', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(apiError(new Error('DATABASE_URL is not configured')).status).toBe(503);
  });
});

describe('database error helpers', () => {
  const wrapped = Object.assign(new Error('Failed query: insert into users params: 20240001,secret-hash'), {
    cause: Object.assign(new Error('duplicate key value violates unique constraint "users_user_code_unique"'), { code: '23505' }),
  });

  it('finds the PostgreSQL code on a wrapped driver error', () => {
    expect(errorCode(wrapped)).toBe('23505');
    expect(errorCode(new Error('plain'))).toBeUndefined();
    expect(errorCode('text')).toBeUndefined();
  });
  it('describes the root cause without query parameters', () => {
    const text = describeError(wrapped);
    expect(text).toContain('[23505]');
    expect(text).toContain('duplicate key');
    expect(text).not.toContain('secret-hash');
  });
});
