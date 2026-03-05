/**
 * Core Auth Service Unit Tests
 *
 * Supabase Auth 기반 사용자 조회 검증
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockGetUser, mockGetUserById } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockGetUserById: vi.fn(),
}));

vi.mock('@lib/supabase-client/server', () => ({
  createServerClient: () => ({
    auth: {
      getUser: mockGetUser,
      admin: {
        getUserById: mockGetUserById,
      },
    },
  }),
}));

import { AuthService } from '../service';

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(() => {
    service = new AuthService();
    vi.clearAllMocks();
  });

  describe('getCurrentUser', () => {
    it('인증된 사용자 조회', async () => {
      mockGetUser.mockResolvedValueOnce({
        data: {
          user: {
            id: 'user-1',
            email: 'test@example.com',
            phone: '010-1234-5678',
            created_at: '2026-01-01T00:00:00Z',
          },
        },
        error: null,
      });

      const result = await service.getCurrentUser();

      expect(result).toEqual({
        id: 'user-1',
        email: 'test@example.com',
        phone: '010-1234-5678',
        created_at: '2026-01-01T00:00:00Z',
      });
    });

    it('미인증 시 null 반환', async () => {
      mockGetUser.mockResolvedValueOnce({
        data: { user: null },
        error: null,
      });

      const result = await service.getCurrentUser();

      expect(result).toBeNull();
    });

    it('에러 발생 시 null 반환', async () => {
      mockGetUser.mockResolvedValueOnce({
        data: { user: null },
        error: { message: 'Auth session missing' },
      });

      const result = await service.getCurrentUser();

      expect(result).toBeNull();
    });
  });

  describe('getUserById', () => {
    it('사용자 ID로 조회', async () => {
      mockGetUserById.mockResolvedValueOnce({
        data: {
          user: {
            id: 'user-1',
            email: 'test@example.com',
            phone: '010-1234-5678',
            created_at: '2026-01-01T00:00:00Z',
          },
        },
        error: null,
      });

      const result = await service.getUserById('user-1');

      expect(mockGetUserById).toHaveBeenCalledWith('user-1');
      expect(result?.id).toBe('user-1');
    });

    it('존재하지 않는 사용자 → null', async () => {
      mockGetUserById.mockResolvedValueOnce({
        data: { user: null },
        error: { message: 'User not found' },
      });

      const result = await service.getUserById('nonexistent');

      expect(result).toBeNull();
    });
  });
});
