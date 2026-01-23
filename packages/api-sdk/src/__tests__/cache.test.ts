/**
 * Cache Utilities Unit Tests
 *
 * [테스트 커버리지] Query Key 팩토리 및 캐시 무효화 헬퍼 테스트
 */

import { describe, it, expect } from 'vitest';
import {
  CACHE_TTL,
  queryKeys,
  getCacheInvalidationKeys,
  defaultQueryOptions,
} from '../cache';

describe('CACHE_TTL', () => {
  it('올바른 TTL 값이 정의되어 있다', () => {
    expect(CACHE_TTL.SHORT).toBe(30 * 1000); // 30초
    expect(CACHE_TTL.MEDIUM).toBe(5 * 60 * 1000); // 5분
    expect(CACHE_TTL.LONG).toBe(15 * 60 * 1000); // 15분
    expect(CACHE_TTL.SCHEMA).toBe(60 * 60 * 1000); // 1시간
  });

  it('TTL 값이 순서대로 증가한다', () => {
    expect(CACHE_TTL.SHORT).toBeLessThan(CACHE_TTL.MEDIUM);
    expect(CACHE_TTL.MEDIUM).toBeLessThan(CACHE_TTL.LONG);
    expect(CACHE_TTL.LONG).toBeLessThan(CACHE_TTL.SCHEMA);
  });
});

describe('queryKeys', () => {
  const tenantId = 'tenant-123';
  const studentId = 'student-456';
  const classId = 'class-789';
  const date = '2024-01-15';

  describe('students', () => {
    it('all 쿼리 키를 생성한다', () => {
      const key = queryKeys.students.all(tenantId);
      expect(key).toEqual(['students', tenantId]);
    });

    it('list 쿼리 키를 생성한다', () => {
      const filters = { status: 'active' };
      const key = queryKeys.students.list(tenantId, filters);
      expect(key).toEqual(['students', tenantId, 'list', filters]);
    });

    it('detail 쿼리 키를 생성한다', () => {
      const key = queryKeys.students.detail(tenantId, studentId);
      expect(key).toEqual(['students', tenantId, 'detail', studentId]);
    });

    it('stats 쿼리 키를 생성한다', () => {
      const key = queryKeys.students.stats(tenantId);
      expect(key).toEqual(['students', tenantId, 'stats']);
    });
  });

  describe('classes', () => {
    it('all 쿼리 키를 생성한다', () => {
      const key = queryKeys.classes.all(tenantId);
      expect(key).toEqual(['classes', tenantId]);
    });

    it('list 쿼리 키를 생성한다', () => {
      const key = queryKeys.classes.list(tenantId);
      expect(key).toEqual(['classes', tenantId, 'list', undefined]);
    });

    it('detail 쿼리 키를 생성한다', () => {
      const key = queryKeys.classes.detail(tenantId, classId);
      expect(key).toEqual(['classes', tenantId, 'detail', classId]);
    });
  });

  describe('attendance', () => {
    it('all 쿼리 키를 생성한다', () => {
      const key = queryKeys.attendance.all(tenantId);
      expect(key).toEqual(['attendance', tenantId]);
    });

    it('daily 쿼리 키를 생성한다', () => {
      const key = queryKeys.attendance.daily(tenantId, date);
      expect(key).toEqual(['attendance', tenantId, 'daily', date]);
    });

    it('stats 쿼리 키를 생성한다', () => {
      const key = queryKeys.attendance.stats(tenantId, date);
      expect(key).toEqual(['attendance', tenantId, 'stats', date]);
    });
  });

  describe('dashboard', () => {
    it('all 쿼리 키를 생성한다', () => {
      const key = queryKeys.dashboard.all(tenantId);
      expect(key).toEqual(['dashboard', tenantId]);
    });

    it('stats 쿼리 키를 생성한다', () => {
      const key = queryKeys.dashboard.stats(tenantId);
      expect(key).toEqual(['dashboard', tenantId, 'stats']);
    });

    it('alerts 쿼리 키를 생성한다', () => {
      const key = queryKeys.dashboard.alerts(tenantId);
      expect(key).toEqual(['dashboard', tenantId, 'alerts']);
    });

    it('activities 쿼리 키를 생성한다', () => {
      const key = queryKeys.dashboard.activities(tenantId);
      expect(key).toEqual(['dashboard', tenantId, 'activities']);
    });
  });

  describe('settings', () => {
    it('all 쿼리 키를 생성한다', () => {
      const key = queryKeys.settings.all(tenantId);
      expect(key).toEqual(['settings', tenantId]);
    });

    it('automation 쿼리 키를 생성한다', () => {
      const key = queryKeys.settings.automation(tenantId);
      expect(key).toEqual(['settings', tenantId, 'automation']);
    });

    it('notifications 쿼리 키를 생성한다', () => {
      const key = queryKeys.settings.notifications(tenantId);
      expect(key).toEqual(['settings', tenantId, 'notifications']);
    });
  });

  describe('schema', () => {
    it('all 쿼리 키를 생성한다', () => {
      const key = queryKeys.schema.all();
      expect(key).toEqual(['schema']);
    });

    it('entity 쿼리 키를 생성한다', () => {
      const key = queryKeys.schema.entity('student', 'academy', 'form');
      expect(key).toEqual(['schema', 'student', 'academy', 'form']);
    });
  });

  describe('analytics', () => {
    it('all 쿼리 키를 생성한다', () => {
      const key = queryKeys.analytics.all(tenantId);
      expect(key).toEqual(['analytics', tenantId]);
    });

    it('regional 쿼리 키를 생성한다', () => {
      const dateRange = '2024-01-01_2024-01-31';
      const key = queryKeys.analytics.regional(tenantId, dateRange);
      expect(key).toEqual(['analytics', tenantId, 'regional', dateRange]);
    });

    it('store 쿼리 키를 생성한다', () => {
      const dateRange = '2024-01-01_2024-01-31';
      const key = queryKeys.analytics.store(tenantId, dateRange);
      expect(key).toEqual(['analytics', tenantId, 'store', dateRange]);
    });
  });
});

describe('getCacheInvalidationKeys', () => {
  const tenantId = 'tenant-123';

  it('학생 변경 시 관련 쿼리 키들을 반환한다', () => {
    const keys = getCacheInvalidationKeys.onStudentChange(tenantId);

    expect(keys).toContainEqual(queryKeys.students.all(tenantId));
    expect(keys).toContainEqual(queryKeys.dashboard.stats(tenantId));
    expect(keys).toContainEqual(queryKeys.analytics.all(tenantId));
  });

  it('수업 변경 시 관련 쿼리 키들을 반환한다', () => {
    const keys = getCacheInvalidationKeys.onClassChange(tenantId);

    expect(keys).toContainEqual(queryKeys.classes.all(tenantId));
    expect(keys).toContainEqual(queryKeys.students.all(tenantId)); // 학생-수업 관계
    expect(keys).toContainEqual(queryKeys.dashboard.stats(tenantId));
  });

  it('출결 변경 시 관련 쿼리 키들을 반환한다', () => {
    const date = '2024-01-15';
    const keys = getCacheInvalidationKeys.onAttendanceChange(tenantId, date);

    expect(keys).toContainEqual(queryKeys.attendance.all(tenantId));
    expect(keys).toContainEqual(queryKeys.attendance.daily(tenantId, date));
    expect(keys).toContainEqual(queryKeys.dashboard.stats(tenantId));
    expect(keys).toContainEqual(queryKeys.analytics.all(tenantId));
  });

  it('설정 변경 시 관련 쿼리 키들을 반환한다', () => {
    const keys = getCacheInvalidationKeys.onSettingsChange(tenantId);

    expect(keys).toContainEqual(queryKeys.settings.all(tenantId));
    expect(keys).toContainEqual(queryKeys.dashboard.all(tenantId));
  });
});

describe('defaultQueryOptions', () => {
  describe('realtime 옵션', () => {
    it('짧은 staleTime을 가진다', () => {
      expect(defaultQueryOptions.realtime.staleTime).toBe(CACHE_TTL.SHORT);
    });

    it('윈도우 포커스 시 리페치한다', () => {
      expect(defaultQueryOptions.realtime.refetchOnWindowFocus).toBe(true);
    });

    it('마운트 시 리페치한다', () => {
      expect(defaultQueryOptions.realtime.refetchOnMount).toBe(true);
    });
  });

  describe('standard 옵션', () => {
    it('중간 staleTime을 가진다', () => {
      expect(defaultQueryOptions.standard.staleTime).toBe(CACHE_TTL.MEDIUM);
    });

    it('윈도우 포커스 시 리페치하지 않는다', () => {
      expect(defaultQueryOptions.standard.refetchOnWindowFocus).toBe(false);
    });

    it('항상 마운트 시 리페치한다', () => {
      expect(defaultQueryOptions.standard.refetchOnMount).toBe('always');
    });
  });

  describe('static 옵션', () => {
    it('긴 staleTime을 가진다', () => {
      expect(defaultQueryOptions.static.staleTime).toBe(CACHE_TTL.LONG);
    });

    it('윈도우 포커스 시 리페치하지 않는다', () => {
      expect(defaultQueryOptions.static.refetchOnWindowFocus).toBe(false);
    });

    it('마운트 시 리페치하지 않는다', () => {
      expect(defaultQueryOptions.static.refetchOnMount).toBe(false);
    });
  });

  describe('schema 옵션', () => {
    it('가장 긴 staleTime을 가진다', () => {
      expect(defaultQueryOptions.schema.staleTime).toBe(CACHE_TTL.SCHEMA);
    });

    it('24시간 gcTime을 가진다', () => {
      expect(defaultQueryOptions.schema.gcTime).toBe(24 * 60 * 60 * 1000);
    });
  });

  it('모든 옵션이 gcTime >= staleTime을 만족한다', () => {
    expect(defaultQueryOptions.realtime.gcTime).toBeGreaterThanOrEqual(
      defaultQueryOptions.realtime.staleTime
    );
    expect(defaultQueryOptions.standard.gcTime).toBeGreaterThanOrEqual(
      defaultQueryOptions.standard.staleTime
    );
    expect(defaultQueryOptions.static.gcTime).toBeGreaterThanOrEqual(
      defaultQueryOptions.static.staleTime
    );
    expect(defaultQueryOptions.schema.gcTime).toBeGreaterThanOrEqual(
      defaultQueryOptions.schema.staleTime
    );
  });
});
