/**
 * 학년 상수 정의
 *
 * 학년 옵션과 자동 상향 로직을 관리합니다.
 */

/** 학년 옵션 배열 (순서대로 정의) */
export const GRADE_OPTIONS = [
  '4세',
  '5세',
  '6세',
  '7세',
  '초등 1학년',
  '초등 2학년',
  '초등 3학년',
  '초등 4학년',
  '초등 5학년',
  '초등 6학년',
  '중등 1학년',
  '중등 2학년',
  '중등 3학년',
  '고등 1학년',
  '고등 2학년',
  '고등 3학년',
  '기타',
] as const;

export type GradeOption = typeof GRADE_OPTIONS[number];

/** 학년 자동 상향 매핑 */
export const GRADE_UPGRADE_MAP: Record<string, string | null> = {
  '4세': '5세',
  '5세': '6세',
  '6세': '7세',
  '7세': '초등 1학년',
  '초등 1학년': '초등 2학년',
  '초등 2학년': '초등 3학년',
  '초등 3학년': '초등 4학년',
  '초등 4학년': '초등 5학년',
  '초등 5학년': '초등 6학년',
  '초등 6학년': '중등 1학년',
  '중등 1학년': '중등 2학년',
  '중등 2학년': '중등 3학년',
  '중등 3학년': '고등 1학년',
  '고등 1학년': '고등 2학년',
  '고등 2학년': '고등 3학년',
  '고등 3학년': null, // 졸업 (더 이상 상향 없음)
  '기타': '기타', // 기타는 변경 없음
};

/**
 * 주어진 학년의 다음 학년을 반환합니다.
 * @param currentGrade 현재 학년
 * @returns 다음 학년 (없으면 null)
 */
export function getNextGrade(currentGrade: string): string | null {
  return GRADE_UPGRADE_MAP[currentGrade] ?? null;
}

/**
 * 학년이 유효한 학년 옵션인지 확인합니다.
 * @param grade 확인할 학년
 * @returns 유효 여부
 */
export function isValidGrade(grade: string): grade is GradeOption {
  return GRADE_OPTIONS.includes(grade as GradeOption);
}
