/**
 * Industry Academy Service Unit Tests
 *
 * AcademyService의 핵심 메서드 검증
 * Supabase 클라이언트를 모킹하여 withTenant 패턴, 데이터 변환 등 검증
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Supabase 체이닝 헬퍼 — 유연한 체인 빌더
function createChainMock(resolvedData: unknown = [], resolvedError: unknown = null) {
  const chain: Record<string, unknown> = {};
  const methods = ['select', 'insert', 'update', 'delete', 'eq', 'neq', 'in',
    'is', 'gte', 'lte', 'gt', 'lt', 'order', 'limit', 'range',
    'ilike', 'or', 'not', 'contains', 'filter', 'textSearch',
    'maybeSingle', 'csv'];

  for (const method of methods) {
    chain[method] = vi.fn(() => chain);
  }

  chain.single = vi.fn(() => ({ data: resolvedData, error: resolvedError }));

  // 최종 결과 반환 (await 시)
  Object.defineProperty(chain, 'then', {
    value: (resolve: (val: unknown) => void) => {
      resolve({ data: resolvedData, error: resolvedError });
    },
  });

  return chain;
}

// vi.hoisted로 mock 변수를 vi.mock보다 먼저 초기화 (호이스팅 문제 방지)
const {
  mockFrom, mockRpc,
  mockTagsServiceGetTags, mockTagsServiceAssignTags,
  mockPartyServiceCreatePerson, mockPartyServiceDeletePerson,
} = vi.hoisted(() => ({
  mockFrom: vi.fn(),
  mockRpc: vi.fn(),
  mockTagsServiceGetTags: vi.fn(),
  mockTagsServiceAssignTags: vi.fn(),
  mockPartyServiceCreatePerson: vi.fn(),
  mockPartyServiceDeletePerson: vi.fn(),
}));

vi.mock('@lib/supabase-client', () => ({
  createClient: () => ({
    from: mockFrom,
    rpc: mockRpc,
  }),
}));

vi.mock('@lib/supabase-client/server', () => ({
  createServerClient: () => ({
    from: mockFrom,
    rpc: mockRpc,
  }),
}));

vi.mock('@lib/supabase-client/db', () => ({
  withTenant: (query: unknown) => query,
}));

vi.mock('@core/pii-utils', () => ({
  maskPII: (val: unknown) => val,
}));

vi.mock('@lib/date-utils', () => ({
  toKST: () => new Date('2026-03-05T10:00:00+09:00'),
  toKSTDate: (d: Date) => d.toISOString().split('T')[0],
  toKSTMonth: () => '2026-03',
}));

// 외부 서비스 의존성 모킹
vi.mock('@core/tags/service', () => ({
  tagsService: {
    getTags: (...args: unknown[]) => mockTagsServiceGetTags(...args),
    assignTags: (...args: unknown[]) => mockTagsServiceAssignTags(...args),
  },
}));

vi.mock('@core/party/service', () => ({
  partyService: {
    createPerson: (...args: unknown[]) => mockPartyServiceCreatePerson(...args),
    deletePerson: (...args: unknown[]) => mockPartyServiceDeletePerson(...args),
  },
}));

// AcademyService는 복잡한 클래스이므로 주요 메서드만 테스트
import { AcademyService } from '../service';

const TENANT_ID = 'test-tenant-id';

describe('AcademyService', () => {
  let service: AcademyService;

  beforeEach(() => {
    service = new AcademyService();
    vi.clearAllMocks();
  });

  describe('getStudents', () => {
    it('persons + academy_students 조인 조회', async () => {
      const mockPersons = [
        {
          id: 'p1',
          tenant_id: TENANT_ID,
          name: '학생1',
          phone: '010-1234-5678',
          person_type: 'student',
          academy_students: { status: 'active', birth_date: '2010-01-01', deleted_at: null },
        },
      ];

      const chain = createChainMock(mockPersons);
      mockFrom.mockReturnValue(chain);

      const result = await service.getStudents(TENANT_ID);

      expect(mockFrom).toHaveBeenCalledWith('persons');
      expect(result).toBeDefined();
    });

    it('withTenant() 적용 확인 (select 쿼리)', async () => {
      const chain = createChainMock([]);
      mockFrom.mockReturnValue(chain);

      await service.getStudents(TENANT_ID);

      // from('persons').select(...) 호출 확인
      expect(mockFrom).toHaveBeenCalledWith('persons');
      expect(chain.select).toHaveBeenCalled();
    });
  });

  describe('createStudent', () => {
    it('partyService.createPerson() + academy_students INSERT', async () => {
      // partyService.createPerson이 person 객체를 반환
      const createdPerson = {
        id: 'p-new',
        tenant_id: TENANT_ID,
        name: '새학생',
        phone: '010-1111-1111',
        person_type: 'student',
      };
      mockPartyServiceCreatePerson.mockResolvedValue(createdPerson);

      // academy_students INSERT 체인
      const studentChain = createChainMock({
        person_id: 'p-new',
        status: 'active',
      });
      mockFrom.mockReturnValue(studentChain);

      const input = {
        name: '새학생',
        phone: '010-1111-1111',
      };

      const result = await service.createStudent(TENANT_ID, 'academy', input);

      expect(mockPartyServiceCreatePerson).toHaveBeenCalledWith(TENANT_ID, expect.objectContaining({
        name: '새학생',
        person_type: 'student',
      }));
      expect(result).toBeDefined();
    });
  });

  describe('getClasses', () => {
    it('수업 목록 조회', async () => {
      const classes = [
        { id: 'c1', name: '수학반', current_count: 10, max_capacity: 20 },
      ];
      const chain = createChainMock(classes);
      mockFrom.mockReturnValue(chain);

      const result = await service.getClasses(TENANT_ID);

      expect(mockFrom).toHaveBeenCalledWith('academy_classes');
      expect(result).toBeDefined();
    });
  });

  describe('createClass', () => {
    it('수업 생성', async () => {
      const created = { id: 'c-new', name: '영어반', current_count: 0, max_capacity: 15 };
      const chain = createChainMock(created);
      mockFrom.mockReturnValue(chain);

      const input = { name: '영어반', max_capacity: 15 };
      const result = await service.createClass(TENANT_ID, input);

      expect(mockFrom).toHaveBeenCalledWith('academy_classes');
      expect(chain.insert).toHaveBeenCalled();
      expect(result).toBeDefined();
    });
  });

  describe('getGuardians', () => {
    it('학생별 보호자 조회', async () => {
      const guardians = [
        { id: 'g1', student_id: 'p1', name: '학부모', phone: '010-0000-0000' },
      ];
      const chain = createChainMock(guardians);
      mockFrom.mockReturnValue(chain);

      const result = await service.getGuardians(TENANT_ID, 'p1');

      expect(mockFrom).toHaveBeenCalledWith('guardians');
      expect(result).toBeDefined();
    });
  });

  describe('getTags', () => {
    it('tagsService.getTags() 위임 확인', async () => {
      const tags = [{ id: 't1', name: '초등생', color: '#FF0000' }];
      mockTagsServiceGetTags.mockResolvedValue(tags);

      const result = await service.getTags(TENANT_ID);

      expect(mockTagsServiceGetTags).toHaveBeenCalledWith(TENANT_ID, { entity_type: 'student' });
      expect(result).toEqual(tags);
    });
  });

  describe('deleteStudent', () => {
    it('soft delete: RPC soft_delete_student 호출', async () => {
      mockRpc.mockResolvedValue({ data: null, error: null });

      await service.deleteStudent(TENANT_ID, 'p1');

      expect(mockRpc).toHaveBeenCalledWith('soft_delete_student', {
        p_person_id: 'p1',
      });
    });
  });

  describe('restoreDeletedStudent', () => {
    it('복원 동작: deleted_at = null', async () => {
      const chain = createChainMock({
        id: 'p1',
        name: '복원학생',
        academy_students: { status: 'active', deleted_at: null },
      });
      mockFrom.mockReturnValue(chain);

      const result = await service.restoreDeletedStudent(TENANT_ID, 'p1');

      expect(result).toBeDefined();
    });
  });

  describe('getAttendanceLogs', () => {
    it('출결 로그 조회', async () => {
      const logs = [
        { id: 'log1', student_id: 'p1', status: 'checked_in' },
      ];
      const chain = createChainMock(logs);
      mockFrom.mockReturnValue(chain);

      const result = await service.getAttendanceLogs(TENANT_ID);

      expect(mockFrom).toHaveBeenCalledWith('attendance_logs');
      expect(result).toBeDefined();
    });

    it('날짜 필터 (date_from/date_to)', async () => {
      const chain = createChainMock([]);
      mockFrom.mockReturnValue(chain);

      await service.getAttendanceLogs(TENANT_ID, {
        date_from: '2026-03-05',
        date_to: '2026-03-05',
      });

      expect(chain.gte).toHaveBeenCalled();
      expect(chain.lte).toHaveBeenCalled();
    });
  });

  describe('updateStudentTags', () => {
    it('기존 태그 삭제 후 tagsService.assignTags() 호출', async () => {
      // delete 기존 태그 (직접 Supabase)
      const deleteChain = createChainMock(null);
      mockFrom.mockReturnValue(deleteChain);

      // tagsService.assignTags (새 태그 할당)
      mockTagsServiceAssignTags.mockResolvedValue(undefined);

      await service.updateStudentTags(TENANT_ID, 'p1', ['t1', 't2']);

      expect(mockFrom).toHaveBeenCalledWith('tag_assignments');
      expect(deleteChain.delete).toHaveBeenCalled();
      expect(mockTagsServiceAssignTags).toHaveBeenCalledWith(TENANT_ID, 'p1', 'student', ['t1', 't2']);
    });
  });
});
