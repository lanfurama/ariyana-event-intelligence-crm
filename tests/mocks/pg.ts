import { vi } from 'vitest';

/**
 * MockPool is a minimal stand-in for pg.Pool used in tests.
 * Tests configure `query` per case via `pool.query.mockResolvedValueOnce(...)`.
 */
export class MockPool {
  query = vi.fn();
  on = vi.fn();
  connect = vi.fn().mockResolvedValue({
    query: vi.fn(),
    release: vi.fn(),
  });
  end = vi.fn().mockResolvedValue(undefined);
}

/**
 * Factory for vi.mock('pg'). Each call returns a fresh MockPool exposed
 * via __pool so tests can assert on it.
 *
 * Usage:
 *   vi.mock('pg', () => import('../../tests/mocks/pg').then((m) => m.makePgMock()));
 */
export function makePgMock() {
  const pool = new MockPool();
  return {
    default: { Pool: vi.fn(() => pool) },
    Pool: vi.fn(() => pool),
    __pool: pool,
  };
}
