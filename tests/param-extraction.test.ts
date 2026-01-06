/**
 * 파라미터 추출 단위 테스트
 *
 * 목적: Fast-Path 정규식 버그 수정 검증 + 업종 중립 테스트
 * 관련 이슈: "박소영 전화번호" → { name: "전화번호" } 오류
 */

import { describe, it, expect } from 'vitest';
import { deriveMinimalParamsFromMessage } from '../infra/supabase/supabase/functions/chatops/handlers/intent-resolver.ts';

describe('deriveMinimalParamsFromMessage', () => {
  describe('기본 패턴 테스트', () => {
    it('should extract name correctly from "박소영 전화번호"', () => {
      const result = deriveMinimalParamsFromMessage('박소영 전화번호', 'student.query.profile');
      expect(result?.name).toBe('박소영');
    });

    it('should extract name correctly from "박소영 프로필"', () => {
      const result = deriveMinimalParamsFromMessage('박소영 프로필', 'student.query.profile');
      expect(result?.name).toBe('박소영');
    });

    it('should extract name correctly from "박소영 연락처"', () => {
      const result = deriveMinimalParamsFromMessage('박소영 연락처', 'student.query.profile');
      expect(result?.name).toBe('박소영');
    });

    it('should extract name correctly from "박소영 정보"', () => {
      const result = deriveMinimalParamsFromMessage('박소영 정보', 'student.query.profile');
      expect(result?.name).toBe('박소영');
    });
  });

  describe('키워드 필터링 테스트', () => {
    it('should not extract keyword as name', () => {
      const result = deriveMinimalParamsFromMessage('전화번호 조회', 'student.query.profile');
      expect(result?.name).toBeUndefined();
    });

    it('should not extract "프로필" as name', () => {
      const result = deriveMinimalParamsFromMessage('프로필 보기', 'student.query.profile');
      expect(result?.name).toBeUndefined();
    });

    it('should not extract "정보" as name', () => {
      const result = deriveMinimalParamsFromMessage('정보 확인', 'student.query.profile');
      expect(result?.name).toBeUndefined();
    });
  });

  describe('업종 중립 테스트 - Academy', () => {
    it('should extract name from "학생 박소영 조회"', () => {
      const result = deriveMinimalParamsFromMessage('학생 박소영 조회', 'student.query.profile');
      expect(result?.name).toBe('박소영');
    });

    it('should extract name from "원생 김철수 출결"', () => {
      const result = deriveMinimalParamsFromMessage('원생 김철수 출결', 'student.query.profile');
      expect(result?.name).toBe('김철수');
    });
  });

  describe('업종 중립 테스트 - Salon', () => {
    it('should extract name from "고객 박소영 연락처"', () => {
      const result = deriveMinimalParamsFromMessage('고객 박소영 연락처', 'student.query.profile');
      expect(result?.name).toBe('박소영');
    });

    it('should extract name from "고객 이영희 정보"', () => {
      const result = deriveMinimalParamsFromMessage('고객 이영희 정보', 'student.query.profile');
      expect(result?.name).toBe('이영희');
    });
  });

  describe('업종 중립 테스트 - Gym', () => {
    it('should extract name from "회원 김철수 프로필"', () => {
      const result = deriveMinimalParamsFromMessage('회원 김철수 프로필', 'student.query.profile');
      expect(result?.name).toBe('김철수');
    });

    it('should extract name from "회원 박지민 상세"', () => {
      const result = deriveMinimalParamsFromMessage('회원 박지민 상세', 'student.query.profile');
      expect(result?.name).toBe('박지민');
    });
  });

  describe('업종 중립 테스트 - NGO', () => {
    it('should extract name from "수혜자 최민수 정보"', () => {
      const result = deriveMinimalParamsFromMessage('수혜자 최민수 정보', 'student.query.profile');
      expect(result?.name).toBe('최민수');
    });

    it('should extract name from "수혜자 강유진 프로필"', () => {
      const result = deriveMinimalParamsFromMessage('수혜자 강유진 프로필', 'student.query.profile');
      expect(result?.name).toBe('강유진');
    });
  });

  describe('업종 중립 테스트 - Real Estate', () => {
    it('should extract name from "클라이언트 박소영 연락처"', () => {
      const result = deriveMinimalParamsFromMessage('클라이언트 박소영 연락처', 'student.query.profile');
      expect(result?.name).toBe('박소영');
    });
  });

  describe('엣지 케이스 테스트', () => {
    it('should handle multiple names correctly (extract first)', () => {
      const result = deriveMinimalParamsFromMessage('박소영과 김철수 프로필', 'student.query.profile');
      expect(result?.name).toBe('박소영');
    });

    it('should handle very short names (2 chars)', () => {
      const result = deriveMinimalParamsFromMessage('김철 전화번호', 'student.query.profile');
      expect(result?.name).toBe('김철');
    });

    it('should handle long names (5 chars)', () => {
      const result = deriveMinimalParamsFromMessage('남궁민수 프로필', 'student.query.profile');
      expect(result?.name).toBe('남궁민수');
    });

    it('should not extract names longer than 20 chars', () => {
      const result = deriveMinimalParamsFromMessage('가나다라마바사아자차카타파하가나다라마바사 전화번호', 'student.query.profile');
      expect(result?.name).toBeUndefined();
    });

    it('should not extract names shorter than 2 chars', () => {
      const result = deriveMinimalParamsFromMessage('김 전화번호', 'student.query.profile');
      expect(result?.name).toBeUndefined();
    });
  });

  describe('업종별 용어 필터링 테스트', () => {
    it('should not extract "학생" as name', () => {
      const result = deriveMinimalParamsFromMessage('학생 조회', 'student.query.profile');
      expect(result?.name).toBeUndefined();
    });

    it('should not extract "고객" as name', () => {
      const result = deriveMinimalParamsFromMessage('고객 정보', 'student.query.profile');
      expect(result?.name).toBeUndefined();
    });

    it('should not extract "회원" as name', () => {
      const result = deriveMinimalParamsFromMessage('회원 확인', 'student.query.profile');
      expect(result?.name).toBeUndefined();
    });

    it('should not extract "수혜자" as name', () => {
      const result = deriveMinimalParamsFromMessage('수혜자 검색', 'student.query.profile');
      expect(result?.name).toBeUndefined();
    });
  });
});

describe('회귀 테스트 - 실제 사용 케이스', () => {
  const testCases = [
    // Academy
    { input: '박소영 프로필', expected: { name: '박소영' }, industry: 'academy' },
    { input: '박소영 전화번호', expected: { name: '박소영' }, industry: 'academy' },
    { input: '학생 박소영 조회', expected: { name: '박소영' }, industry: 'academy' },
    { input: '원생 김철수 출결', expected: { name: '김철수' }, industry: 'academy' },

    // Salon
    { input: '고객 박소영 연락처', expected: { name: '박소영' }, industry: 'salon' },
    { input: '고객 이영희 정보', expected: { name: '이영희' }, industry: 'salon' },

    // Gym
    { input: '회원 김철수 프로필', expected: { name: '김철수' }, industry: 'gym' },
    { input: '회원 박지민 상세', expected: { name: '박지민' }, industry: 'gym' },

    // NGO
    { input: '수혜자 최민수 정보', expected: { name: '최민수' }, industry: 'ngo' },

    // Real Estate
    { input: '클라이언트 박소영 연락처', expected: { name: '박소영' }, industry: 'real_estate' },
  ];

  testCases.forEach(({ input, expected, industry }) => {
    it(`should extract params correctly from "${input}" (${industry})`, () => {
      const result = deriveMinimalParamsFromMessage(input, 'student.query.profile');
      expect(result).toMatchObject(expected);
    });
  });
});

