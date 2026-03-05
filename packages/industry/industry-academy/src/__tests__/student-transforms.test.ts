/**
 * Student Transforms Unit Tests
 *
 * 순수 함수 테스트: DB 의존성 없는 데이터 변환 로직 검증
 */

import { describe, it, expect } from 'vitest';
import { extractAcademyData, mapPersonToStudent, intersect } from '../student-transforms';

describe('extractAcademyData', () => {
  it('정상 객체 데이터 추출', () => {
    const raw = { birth_date: '2010-01-01', gender: 'M', status: 'active' };

    const result = extractAcademyData(raw);

    expect(result).toEqual(raw);
  });

  it('배열 데이터에서 첫 번째 요소 추출', () => {
    const raw = [
      { birth_date: '2010-01-01', gender: 'M' },
      { birth_date: '2011-02-02', gender: 'F' },
    ];

    const result = extractAcademyData(raw);

    expect(result).toEqual(raw[0]);
  });

  it('null 입력 → undefined 반환', () => {
    expect(extractAcademyData(null)).toBeUndefined();
  });

  it('undefined 입력 → undefined 반환', () => {
    expect(extractAcademyData(undefined)).toBeUndefined();
  });

  it('빈 배열 → undefined 반환', () => {
    expect(extractAcademyData([])).toBeUndefined();
  });

  it('false/0 입력 → undefined 반환 (falsy 처리)', () => {
    expect(extractAcademyData(false)).toBeUndefined();
    expect(extractAcademyData(0)).toBeUndefined();
  });
});

describe('mapPersonToStudent', () => {
  const basePerson = {
    id: 'person-1',
    tenant_id: 'tenant-1',
    person_type: 'student' as const,
    name: '홍길동',
    phone: '010-1234-5678',
    email: 'hong@example.com',
    address: '서울시 강남구',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  };

  it('Person + AcademyData 정상 병합', () => {
    const academyData = {
      birth_date: '2010-05-15',
      gender: 'M',
      school_name: '강남초등학교',
      grade: '3',
      class_name: '수학반',
      status: 'active',
    };

    const result = mapPersonToStudent(basePerson, academyData);

    expect(result.id).toBe('person-1');
    expect(result.name).toBe('홍길동');
    expect(result.birth_date).toBe('2010-05-15');
    expect(result.school_name).toBe('강남초등학교');
    expect(result.grade).toBe('3');
    expect(result.industry_type).toBe('academy');
    expect(result.status).toBe('active');
  });

  it('academyData가 undefined일 때 기본값 적용', () => {
    const result = mapPersonToStudent(basePerson, undefined);

    expect(result.id).toBe('person-1');
    expect(result.name).toBe('홍길동');
    expect(result.birth_date).toBeUndefined();
    expect(result.school_name).toBeUndefined();
    expect(result.status).toBe('active'); // 기본값
  });

  it('extras(보호자, 대표반) 병합', () => {
    const result = mapPersonToStudent(basePerson, {}, {
      primary_guardian_name: '홍부모',
      primary_class_name: '영어반',
    });

    expect(result.primary_guardian_name).toBe('홍부모');
    expect(result.primary_class_name).toBe('영어반');
  });

  it('누락 필드에 기본값 적용', () => {
    const result = mapPersonToStudent(basePerson, {
      birth_date: null,
      gender: undefined,
    });

    expect(result.birth_date).toBeNull();
    expect(result.gender).toBeUndefined();
    expect(result.status).toBe('active');
  });
});

describe('intersect', () => {
  it('양쪽 모두 undefined → undefined', () => {
    expect(intersect(undefined, undefined)).toBeUndefined();
  });

  it('한쪽만 undefined → 다른 쪽 반환', () => {
    expect(intersect(['a', 'b'], undefined)).toEqual(['a', 'b']);
    expect(intersect(undefined, ['c', 'd'])).toEqual(['c', 'd']);
  });

  it('양쪽 모두 배열 → 교집합 반환', () => {
    expect(intersect(['a', 'b', 'c'], ['b', 'c', 'd'])).toEqual(['b', 'c']);
  });

  it('교집합 없음 → 빈 배열', () => {
    expect(intersect(['a'], ['b'])).toEqual([]);
  });

  it('빈 배열 → 빈 배열', () => {
    expect(intersect([], ['a'])).toEqual([]);
    expect(intersect(['a'], [])).toEqual([]);
  });
});
