/**
 * TeacherDomain Unit Tests
 *
 * 강사 CRUD 비즈니스 로직 검증
 * persons + academy_teachers 2단계 생성/수정/삭제 패턴
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createChainMock, TENANT_ID } from './test-helpers';

const mockFrom = vi.fn();

vi.mock('@lib/supabase-client', () => ({
  createClient: () => ({ from: mockFrom }),
}));

vi.mock('@lib/supabase-client/db', () => ({
  withTenant: (query: unknown) => query,
}));

const mockCreatePerson = vi.fn();
vi.mock('@core/party/service', () => ({
  partyService: {
    createPerson: (...args: unknown[]) => mockCreatePerson(...args),
  },
}));

import { TeacherDomain } from '../domains/teacher-domain';

describe('TeacherDomain', () => {
  let domain: TeacherDomain;
  const mockSupabase = { from: mockFrom } as never;

  beforeEach(() => {
    domain = new TeacherDomain(mockSupabase);
    vi.clearAllMocks();
  });

  describe('createTeacher', () => {
    it('persons + academy_teachers 2단계 생성', async () => {
      const person = {
        id: 'p-new',
        tenant_id: TENANT_ID,
        name: '김강사',
        email: 'kim@test.com',
        phone: '010-1111-2222',
        person_type: 'teacher',
        created_at: '2026-03-05',
        updated_at: '2026-03-05',
      };
      mockCreatePerson.mockResolvedValue(person);

      const teacherData = {
        person_id: 'p-new',
        status: 'active',
        hire_date: '2026-01-01',
      };
      const chain = createChainMock(teacherData);
      mockFrom.mockReturnValue(chain);

      const result = await domain.createTeacher(TENANT_ID, {
        name: '김강사',
        email: 'kim@test.com',
        phone: '010-1111-2222',
      });

      // 1단계: partyService.createPerson 호출
      expect(mockCreatePerson).toHaveBeenCalledWith(TENANT_ID, expect.objectContaining({
        name: '김강사',
        person_type: 'teacher',
      }));

      // 2단계: academy_teachers INSERT
      expect(mockFrom).toHaveBeenCalledWith('academy_teachers');
      expect(chain.insert).toHaveBeenCalledWith(expect.objectContaining({
        person_id: 'p-new',
        tenant_id: TENANT_ID,
      }));

      expect(result.id).toBe('p-new');
      expect(result.name).toBe('김강사');
    });

    it('academy_teachers 실패 시 persons 롤백 (delete 호출)', async () => {
      const person = {
        id: 'p-new',
        tenant_id: TENANT_ID,
        name: '김강사',
        person_type: 'teacher',
      };
      mockCreatePerson.mockResolvedValue(person);

      // academy_teachers INSERT 실패
      const insertChain = createChainMock(null, { message: 'Insert failed' });
      // persons DELETE 성공 (롤백용)
      const deleteChain = createChainMock(null);

      mockFrom
        .mockReturnValueOnce(insertChain) // academy_teachers INSERT
        .mockReturnValueOnce(deleteChain); // persons DELETE (롤백)

      await expect(
        domain.createTeacher(TENANT_ID, { name: '김강사' })
      ).rejects.toThrow('Failed to create teacher: Insert failed');

      // 롤백: persons DELETE 호출 확인
      expect(mockFrom).toHaveBeenCalledWith('persons');
      expect(deleteChain.delete).toHaveBeenCalled();
      expect(deleteChain.eq).toHaveBeenCalledWith('id', 'p-new');
    });
  });

  describe('getTeachers', () => {
    it('조인 조회 + 상태 필터 (클라이언트 측)', async () => {
      const personsData = [
        {
          id: 'p1', tenant_id: TENANT_ID, name: '활동강사', person_type: 'teacher',
          academy_teachers: [{ status: 'active', specialization: '수학' }],
        },
        {
          id: 'p2', tenant_id: TENANT_ID, name: '퇴직강사', person_type: 'teacher',
          academy_teachers: [{ status: 'resigned', specialization: '영어' }],
        },
      ];
      const chain = createChainMock(personsData);
      mockFrom.mockReturnValue(chain);

      const result = await domain.getTeachers(TENANT_ID, { status: 'active' });

      expect(mockFrom).toHaveBeenCalledWith('persons');
      // 클라이언트 측 필터: active만 반환
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('활동강사');
    });

    it('전문 분야 필터: specialization 필터링', async () => {
      const personsData = [
        {
          id: 'p1', tenant_id: TENANT_ID, name: '수학강사', person_type: 'teacher',
          academy_teachers: [{ status: 'active', specialization: '수학' }],
        },
        {
          id: 'p2', tenant_id: TENANT_ID, name: '영어강사', person_type: 'teacher',
          academy_teachers: [{ status: 'active', specialization: '영어' }],
        },
      ];
      const chain = createChainMock(personsData);
      mockFrom.mockReturnValue(chain);

      const result = await domain.getTeachers(TENANT_ID, { specialization: '수학' });

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('수학강사');
    });
  });

  describe('updateTeacher', () => {
    it('persons + academy_teachers 각각 업데이트', async () => {
      // persons UPDATE
      const personsChain = createChainMock(null);
      // academy_teachers UPDATE
      const teacherChain = createChainMock(null);
      // getTeacher (조회)
      const getChain = createChainMock({
        id: 'p1', tenant_id: TENANT_ID, name: '수정강사',
        academy_teachers: [{ status: 'active', specialization: '수학' }],
      });

      mockFrom
        .mockReturnValueOnce(personsChain) // persons UPDATE
        .mockReturnValueOnce(teacherChain) // academy_teachers UPDATE
        .mockReturnValueOnce(getChain); // getTeacher (조회)

      const result = await domain.updateTeacher(TENANT_ID, 'p1', {
        email: 'new@test.com', // persons 필드
        specialization: '수학', // academy_teachers 필드
      });

      // persons UPDATE
      expect(personsChain.update).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'new@test.com' })
      );
      // academy_teachers UPDATE
      expect(teacherChain.update).toHaveBeenCalledWith(
        expect.objectContaining({ specialization: '수학' })
      );
      expect(result).toBeDefined();
    });
  });

  describe('deleteTeacher', () => {
    it('소프트 삭제: status → resigned', async () => {
      const chain = createChainMock(null);
      mockFrom.mockReturnValue(chain);

      await domain.deleteTeacher(TENANT_ID, 'p1');

      expect(mockFrom).toHaveBeenCalledWith('academy_teachers');
      expect(chain.update).toHaveBeenCalledWith({ status: 'resigned' });
      expect(chain.eq).toHaveBeenCalledWith('person_id', 'p1');
    });
  });
});
