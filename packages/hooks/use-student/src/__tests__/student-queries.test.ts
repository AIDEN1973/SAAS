/**
 * Student Queries & List Core Unit Tests
 *
 * [A-6 + A-9 통합] resolveStudentFilterIds, enrichStudentsWithRelations, fetchStudents
 * 순수 함수 로직 검증 (React Hook 없이 직접 호출)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// API SDK 모킹
const mockGet = vi.fn();
const mockCallRPC = vi.fn();

vi.mock('@api-sdk/core', () => ({
  apiClient: {
    get: (...args: unknown[]) => mockGet(...args),
    callRPC: (...args: unknown[]) => mockCallRPC(...args),
  },
  getApiContext: vi.fn(() => ({
    tenantId: 'test-tenant-id',
    industryType: 'academy',
  })),
}));

vi.mock('@services/student-service', () => ({
  extractAcademyData: (data: unknown) => data,
  mapPersonToStudent: (person: Record<string, unknown>, academyData: unknown, extra: unknown) => ({
    ...person,
    ...(extra as Record<string, unknown>),
  }),
}));

import {
  resolveStudentFilterIds,
  enrichStudentsWithRelations,
} from '../student-list-core';
import { fetchStudents } from '../student-queries';

const TENANT_ID = 'test-tenant-id';

describe('resolveStudentFilterIds', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('모든 필터 빈 값이면 undefined를 반환한다 (전체 조회)', async () => {
    const result = await resolveStudentFilterIds(TENANT_ID, undefined);
    expect(result).toBeUndefined();
    expect(mockCallRPC).not.toHaveBeenCalled();
  });

  it('빈 필터 객체면 undefined를 반환한다', async () => {
    const result = await resolveStudentFilterIds(TENANT_ID, {});
    expect(result).toBeUndefined();
    expect(mockCallRPC).not.toHaveBeenCalled();
  });

  it('class_id="all"이면 undefined를 반환한다', async () => {
    const result = await resolveStudentFilterIds(TENANT_ID, { class_id: 'all' });
    expect(result).toBeUndefined();
    expect(mockCallRPC).not.toHaveBeenCalled();
  });

  it('class_id가 빈 문자열이면 undefined를 반환한다', async () => {
    const result = await resolveStudentFilterIds(TENANT_ID, { class_id: '' });
    expect(result).toBeUndefined();
    expect(mockCallRPC).not.toHaveBeenCalled();
  });

  it('tag_ids 존재 시 RPC를 호출한다', async () => {
    mockCallRPC.mockResolvedValue({
      data: ['s1', 's2'],
      error: null,
    });

    const result = await resolveStudentFilterIds(TENANT_ID, {
      tag_ids: ['t1', 't2'],
    });

    expect(mockCallRPC).toHaveBeenCalledWith('resolve_student_filter_ids', {
      p_tenant_id: TENANT_ID,
      p_tag_ids: ['t1', 't2'],
      p_status: null,
      p_grade: null,
      p_class_id: null,
      p_include_deleted: false,
    });
    expect(result).toEqual(['s1', 's2']);
  });

  it('RPC 빈 결과 시 빈 배열을 반환한다', async () => {
    mockCallRPC.mockResolvedValue({
      data: null,
      error: null,
    });

    const result = await resolveStudentFilterIds(TENANT_ID, {
      status: 'active',
    });

    expect(result).toEqual([]);
  });

  it('RPC 에러 시 Error를 throw한다', async () => {
    mockCallRPC.mockResolvedValue({
      data: null,
      error: { message: 'RPC failed' },
    });

    await expect(
      resolveStudentFilterIds(TENANT_ID, { tag_ids: ['t1'] })
    ).rejects.toThrow('RPC failed');
  });
});

describe('enrichStudentsWithRelations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('빈 studentIds면 빈 Maps를 반환하고 API를 호출하지 않는다', async () => {
    const result = await enrichStudentsWithRelations([]);

    expect(result.guardiansMap.size).toBe(0);
    expect(result.studentClassMap.size).toBe(0);
    expect(mockGet).not.toHaveBeenCalled();
  });

  it('보호자 + 수업을 병렬 조회한다', async () => {
    mockGet
      .mockResolvedValueOnce({
        data: [{ student_id: 's1', name: '학부모A', is_primary: true }],
        error: null,
      })
      .mockResolvedValueOnce({
        data: [{ student_id: 's1', class_id: 'c1', is_active: true }],
        error: null,
      })
      .mockResolvedValueOnce({
        data: [{ id: 'c1', name: '수학반' }],
        error: null,
      });

    const result = await enrichStudentsWithRelations(['s1']);

    expect(result.guardiansMap.get('s1')).toBe('학부모A');
    expect(result.studentClassMap.get('s1')).toBe('수학반');
    // guardians + student_classes 병렬 호출 (최소 2회)
    expect(mockGet).toHaveBeenCalledTimes(3);
  });

  it('보호자 조회 실패해도 classMap은 정상 반환한다', async () => {
    mockGet
      .mockResolvedValueOnce({
        data: null,
        error: { message: 'Guardian query failed' },
      })
      .mockResolvedValueOnce({
        data: [{ student_id: 's1', class_id: 'c1', is_active: true }],
        error: null,
      })
      .mockResolvedValueOnce({
        data: [{ id: 'c1', name: '영어반' }],
        error: null,
      });

    const result = await enrichStudentsWithRelations(['s1']);

    expect(result.guardiansMap.size).toBe(0);
    expect(result.studentClassMap.get('s1')).toBe('영어반');
  });

  it('여러 학생의 수업 배정에서 첫 번째만 저장한다 (dedup)', async () => {
    mockGet
      .mockResolvedValueOnce({
        data: [],
        error: null,
      })
      .mockResolvedValueOnce({
        data: [
          { student_id: 's1', class_id: 'c1', is_active: true },
          { student_id: 's1', class_id: 'c2', is_active: true },
        ],
        error: null,
      })
      .mockResolvedValueOnce({
        data: [
          { id: 'c1', name: '수학반' },
          { id: 'c2', name: '영어반' },
        ],
        error: null,
      });

    const result = await enrichStudentsWithRelations(['s1']);

    // 첫 번째 배정(수학반)만 저장
    expect(result.studentClassMap.get('s1')).toBe('수학반');
  });
});

describe('fetchStudents', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('필터 없이 전체 파이프라인을 실행한다', async () => {
    // resolveStudentFilterIds → undefined (전체 조회)
    // apiClient.get persons
    mockGet
      .mockResolvedValueOnce({
        data: [{ id: 's1', name: '학생1', person_type: 'student' }],
        error: null,
      })
      // enrichment: guardians
      .mockResolvedValueOnce({ data: [], error: null })
      // enrichment: student_classes
      .mockResolvedValueOnce({ data: [], error: null });

    const result = await fetchStudents(TENANT_ID);

    expect(result).toHaveLength(1);
    expect(mockCallRPC).not.toHaveBeenCalled();
    expect(mockGet).toHaveBeenCalledWith('persons', expect.objectContaining({
      filters: expect.objectContaining({ person_type: 'student' }),
    }));
  });

  it('필터 적용 시 resolveFilterIds → enrichment 순서로 실행한다', async () => {
    // resolveStudentFilterIds
    mockCallRPC.mockResolvedValue({
      data: ['s1'],
      error: null,
    });

    // apiClient.get persons (필터된 ID 기반)
    mockGet
      .mockResolvedValueOnce({
        data: [{ id: 's1', name: '학생1', person_type: 'student' }],
        error: null,
      })
      // enrichment
      .mockResolvedValueOnce({ data: [], error: null })
      .mockResolvedValueOnce({ data: [], error: null });

    const result = await fetchStudents(TENANT_ID, { tag_ids: ['t1'] });

    expect(mockCallRPC).toHaveBeenCalledTimes(1);
    expect(result).toHaveLength(1);
    // persons 쿼리에 필터된 ID가 포함
    expect(mockGet).toHaveBeenCalledWith('persons', expect.objectContaining({
      filters: expect.objectContaining({ id: ['s1'] }),
    }));
  });
});
