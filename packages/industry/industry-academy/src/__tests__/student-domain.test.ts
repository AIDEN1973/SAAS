/**
 * StudentDomain Unit Tests
 *
 * 학생 CRUD, 필터링, 소프트 삭제 검증
 * persons + academy_students 2단계 패턴
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createChainMock, TENANT_ID, MOCK_USER_ID } from './test-helpers';

const mockFrom = vi.fn();
const mockRpc = vi.fn();

vi.mock('@lib/supabase-client', () => ({
  createClient: () => ({ from: mockFrom, rpc: mockRpc }),
}));

vi.mock('@lib/supabase-client/db', () => ({
  withTenant: (query: unknown) => query,
}));

const mockCreatePerson = vi.fn();
const mockDeletePerson = vi.fn();
const mockUpdatePerson = vi.fn();
vi.mock('@core/party/service', () => ({
  partyService: {
    createPerson: (...args: unknown[]) => mockCreatePerson(...args),
    deletePerson: (...args: unknown[]) => mockDeletePerson(...args),
    updatePerson: (...args: unknown[]) => mockUpdatePerson(...args),
  },
}));

const mockTagsGetTags = vi.fn();
const mockTagsAssignTags = vi.fn();
vi.mock('@core/tags/service', () => ({
  tagsService: {
    getTags: (...args: unknown[]) => mockTagsGetTags(...args),
    assignTags: (...args: unknown[]) => mockTagsAssignTags(...args),
  },
}));

vi.mock('@lib/date-utils', () => ({
  toKST: () => ({
    format: () => '2026-03-05',
  }),
  toKSTDate: (d: Date) => d.toISOString().split('T')[0],
}));

// student-transforms mock
vi.mock('../student-transforms', () => ({
  extractAcademyData: (data: unknown) => {
    if (Array.isArray(data)) return data[0] || null;
    return data;
  },
  mapPersonToStudent: (person: Record<string, unknown>, academyData: Record<string, unknown> | null) => ({
    id: person.id,
    tenant_id: person.tenant_id,
    name: person.name,
    phone: person.phone,
    status: academyData?.status || 'active',
    deleted_at: academyData?.deleted_at || null,
    ...(academyData || {}),
  }),
}));

import { StudentDomain } from '../domains/student-domain';

describe('StudentDomain', () => {
  let domain: StudentDomain;
  const mockSupabase = { from: mockFrom, rpc: mockRpc } as never;

  beforeEach(() => {
    domain = new StudentDomain(mockSupabase);
    vi.clearAllMocks();
  });

  describe('getStudents', () => {
    it('persons + academy_students 조인 조회 성공', async () => {
      const personsData = [
        {
          id: 'p1', tenant_id: TENANT_ID, name: '학생1', phone: '010-1234-5678',
          person_type: 'student',
          academy_students: [{ status: 'active', deleted_at: null }],
        },
      ];
      const chain = createChainMock(personsData);
      mockFrom.mockReturnValue(chain);

      const result = await domain.getStudents(TENANT_ID);

      expect(mockFrom).toHaveBeenCalledWith('persons');
      expect(chain.select).toHaveBeenCalled();
      expect(result).toHaveLength(1);
    });

    it('소프트 삭제 학생 필터링: deleted_at !== null 제외', async () => {
      const personsData = [
        {
          id: 'p1', tenant_id: TENANT_ID, name: '활성학생', person_type: 'student',
          academy_students: [{ status: 'active', deleted_at: null }],
        },
        {
          id: 'p2', tenant_id: TENANT_ID, name: '삭제학생', person_type: 'student',
          academy_students: [{ status: 'active', deleted_at: '2026-03-01' }],
        },
      ];
      const chain = createChainMock(personsData);
      mockFrom.mockReturnValue(chain);

      const result = await domain.getStudents(TENANT_ID);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('활성학생');
    });

    it('status 필터 적용', async () => {
      const personsData = [
        {
          id: 'p1', tenant_id: TENANT_ID, name: '활성', person_type: 'student',
          academy_students: [{ status: 'active', deleted_at: null }],
        },
        {
          id: 'p2', tenant_id: TENANT_ID, name: '휴학', person_type: 'student',
          academy_students: [{ status: 'inactive', deleted_at: null }],
        },
      ];
      const chain = createChainMock(personsData);
      mockFrom.mockReturnValue(chain);

      const result = await domain.getStudents(TENANT_ID, { status: 'active' });

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('활성');
    });

    it('tag_ids 필터 (OR 조건): tag_assignments 쿼리', async () => {
      const personsData = [
        { id: 'p1', tenant_id: TENANT_ID, name: '태그학생', person_type: 'student', academy_students: [{ status: 'active', deleted_at: null }] },
        { id: 'p2', tenant_id: TENANT_ID, name: '무태그학생', person_type: 'student', academy_students: [{ status: 'active', deleted_at: null }] },
      ];
      const personsChain = createChainMock(personsData);
      const tagsChain = createChainMock([{ entity_id: 'p1' }]);

      mockFrom
        .mockReturnValueOnce(personsChain) // persons 조회
        .mockReturnValueOnce(tagsChain);   // tag_assignments 조회

      const result = await domain.getStudents(TENANT_ID, { tag_ids: ['t1'] });

      expect(mockFrom).toHaveBeenCalledWith('tag_assignments');
      expect(tagsChain.in).toHaveBeenCalledWith('tag_id', ['t1']);
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('태그학생');
    });

    it('class_id 필터: student_classes 쿼리', async () => {
      const personsData = [
        { id: 'p1', tenant_id: TENANT_ID, name: '수학반학생', person_type: 'student', academy_students: [{ status: 'active', deleted_at: null }] },
        { id: 'p2', tenant_id: TENANT_ID, name: '영어반학생', person_type: 'student', academy_students: [{ status: 'active', deleted_at: null }] },
      ];
      const personsChain = createChainMock(personsData);
      const classChain = createChainMock([{ student_id: 'p1' }]);

      mockFrom
        .mockReturnValueOnce(personsChain) // persons 조회
        .mockReturnValueOnce(classChain);  // student_classes 조회

      const result = await domain.getStudents(TENANT_ID, { class_id: 'c1' });

      expect(mockFrom).toHaveBeenCalledWith('student_classes');
      expect(classChain.eq).toHaveBeenCalledWith('class_id', 'c1');
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('수학반학생');
    });

    it('DB 에러 시 Error throw', async () => {
      const chain = createChainMock(null, { message: 'Connection timeout' });
      mockFrom.mockReturnValue(chain);

      await expect(domain.getStudents(TENANT_ID)).rejects.toThrow('Failed to fetch students: Connection timeout');
    });
  });

  describe('createStudent', () => {
    it('persons → academy_students 2단계 생성', async () => {
      const person = {
        id: 'p-new', tenant_id: TENANT_ID, name: '새학생',
        phone: '010-1111-2222', person_type: 'student',
      };
      mockCreatePerson.mockResolvedValue(person);

      const studentChain = createChainMock({ person_id: 'p-new', status: 'active' });
      mockFrom.mockReturnValue(studentChain);

      const result = await domain.createStudent(TENANT_ID, 'academy', { name: '새학생', phone: '010-1111-2222' });

      expect(mockCreatePerson).toHaveBeenCalledWith(TENANT_ID, expect.objectContaining({
        name: '새학생',
        person_type: 'student',
      }));
      expect(mockFrom).toHaveBeenCalledWith('academy_students');
      expect(studentChain.insert).toHaveBeenCalledWith(expect.objectContaining({
        person_id: 'p-new',
        tenant_id: TENANT_ID,
      }));
      expect(result).toBeDefined();
    });

    it('academy_students 실패 시 persons 롤백 (partyService.deletePerson)', async () => {
      const person = { id: 'p-new', tenant_id: TENANT_ID, name: '새학생', person_type: 'student' };
      mockCreatePerson.mockResolvedValue(person);
      mockDeletePerson.mockResolvedValue(undefined);

      const failChain = createChainMock(null, { message: 'Duplicate key' });
      mockFrom.mockReturnValue(failChain); // academy_students INSERT fail

      await expect(
        domain.createStudent(TENANT_ID, 'academy', { name: '새학생' })
      ).rejects.toThrow('Failed to create academy student: Duplicate key');

      // 롤백: partyService.deletePerson 호출
      expect(mockDeletePerson).toHaveBeenCalledWith(TENANT_ID, 'p-new');
    });

    it('guardians 입력 시 createGuardians 호출', async () => {
      const person = { id: 'p-new', tenant_id: TENANT_ID, name: '새학생', person_type: 'student' };
      mockCreatePerson.mockResolvedValue(person);

      // academy_students INSERT
      const studentChain = createChainMock({ person_id: 'p-new', status: 'active' });
      // guardians INSERT
      const guardianChain = createChainMock([{ id: 'g1' }]);

      mockFrom
        .mockReturnValueOnce(studentChain)  // academy_students
        .mockReturnValueOnce(guardianChain); // guardians

      await domain.createStudent(TENANT_ID, 'academy', {
        name: '새학생',
        guardians: [{ name: '학부모', phone: '010-0000-0000', relationship: 'mother' }],
      });

      expect(mockFrom).toHaveBeenCalledWith('guardians');
    });

    it('tag_ids 시 assignTags 호출', async () => {
      const person = { id: 'p-new', tenant_id: TENANT_ID, name: '새학생', person_type: 'student' };
      mockCreatePerson.mockResolvedValue(person);

      const studentChain = createChainMock({ person_id: 'p-new', status: 'active' });
      mockFrom.mockReturnValue(studentChain);

      mockTagsAssignTags.mockResolvedValue(undefined);

      await domain.createStudent(TENANT_ID, 'academy', {
        name: '새학생',
        tag_ids: ['t1', 't2'],
      });

      expect(mockTagsAssignTags).toHaveBeenCalledWith(TENANT_ID, 'p-new', 'student', ['t1', 't2']);
    });
  });

  describe('deleteStudent', () => {
    it('soft_delete_student RPC 호출', async () => {
      mockRpc.mockResolvedValue({ data: null, error: null });

      await domain.deleteStudent(TENANT_ID, 'p1');

      expect(mockRpc).toHaveBeenCalledWith('soft_delete_student', {
        p_person_id: 'p1',
      });
    });
  });

  describe('updateStudent', () => {
    it('persons + academy_students 각각 업데이트', async () => {
      // persons UPDATE → partyService.updatePerson (supabase 직접 호출 아님)
      mockUpdatePerson.mockResolvedValue(undefined);

      // academy_students UPDATE (supabase 직접 호출)
      const academyChain = createChainMock(null);
      // getStudent (조회) - persons query
      const getChain = createChainMock({
        id: 'p1', tenant_id: TENANT_ID, name: '수정학생', person_type: 'student',
        academy_students: [{ status: 'inactive', deleted_at: null }],
      });

      mockFrom
        .mockReturnValueOnce(academyChain)  // academy_students UPDATE
        .mockReturnValueOnce(getChain);     // getStudent 조회

      const result = await domain.updateStudent(TENANT_ID, 'p1', {
        name: '수정학생',    // persons 필드 → partyService.updatePerson
        status: 'inactive',  // academy_students 필드 → supabase 직접
      });

      // persons 업데이트는 partyService.updatePerson 호출
      expect(mockUpdatePerson).toHaveBeenCalledWith(TENANT_ID, 'p1', expect.objectContaining({
        name: '수정학생',
      }));
      // academy_students 업데이트는 supabase 직접 호출
      expect(mockFrom).toHaveBeenCalledWith('academy_students');
      expect(academyChain.update).toHaveBeenCalled();
      expect(result).toBeDefined();
    });
  });
});
