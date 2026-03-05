/**
 * Student Transforms
 *
 * [SSOT] persons + academy_students → Student 데이터 변환 순수 함수
 * [불변 규칙] DB 의존성 없음 → 클라이언트(hooks)와 서버(AcademyService) 양쪽에서 import 가능
 * [불변 규칙] 이 모듈의 함수를 사용하여 데이터 변환 로직 중복을 방지합니다.
 */

import type { Student } from './types';
import type { Person } from '@core/party';

/**
 * academy_students 테이블 select 필드 상수 (PostgREST 조인용)
 * [SSOT] 이 상수를 사용하여 select 문자열 중복을 방지합니다.
 */
export const ACADEMY_STUDENTS_SELECT = `
  birth_date,
  gender,
  school_name,
  grade,
  class_name,
  attendance_number,
  father_phone,
  mother_phone,
  status,
  notes,
  profile_image_url,
  deleted_at,
  created_at,
  updated_at,
  created_by,
  updated_by
`.trim();

/**
 * PostgREST 응답에서 academy_students 데이터 추출
 *
 * PostgREST는 1:1 관계에서 단일 객체를, 1:N 관계에서 배열을 반환합니다.
 * 이 함수는 두 경우를 모두 처리하여 단일 객체(또는 undefined)를 반환합니다.
 *
 * @param raw - PostgREST가 반환한 academy_students 필드 (배열 또는 객체)
 * @returns 정규화된 단일 객체 또는 undefined
 */
export function extractAcademyData(
  raw: unknown
): Record<string, unknown> | undefined {
  if (!raw) return undefined;
  if (Array.isArray(raw)) {
    return raw.length > 0 ? (raw[0] as Record<string, unknown>) : undefined;
  }
  return raw as Record<string, unknown>;
}

/**
 * persons + academy_students 데이터를 Student 타입으로 변환
 *
 * @param person - persons 테이블 데이터
 * @param academyData - extractAcademyData()로 추출한 academy_students 데이터
 * @param extras - 추가 필드 (주 보호자명, 대표반명 등)
 * @returns Student 객체
 */
export function mapPersonToStudent(
  person: Person,
  academyData: Record<string, unknown> | undefined,
  extras?: {
    primary_guardian_name?: string;
    primary_class_name?: string;
  }
): Student & { primary_guardian_name?: string; primary_class_name?: string } {
  const ad = academyData || {};
  return {
    id: person.id,
    tenant_id: person.tenant_id,
    industry_type: 'academy',
    name: person.name,
    birth_date: ad.birth_date as string | undefined,
    gender: ad.gender as Student['gender'],
    phone: person.phone,
    attendance_number: ad.attendance_number as string | undefined,
    email: person.email,
    father_phone: ad.father_phone as string | undefined,
    mother_phone: ad.mother_phone as string | undefined,
    address: person.address,
    school_name: ad.school_name as string | undefined,
    grade: ad.grade as string | undefined,
    status: (ad.status as Student['status']) || 'active',
    notes: ad.notes as string | undefined,
    profile_image_url: ad.profile_image_url as string | undefined,
    created_at: person.created_at,
    updated_at: person.updated_at,
    created_by: ad.created_by as string | undefined,
    updated_by: ad.updated_by as string | undefined,
    primary_guardian_name: extras?.primary_guardian_name,
    primary_class_name: extras?.primary_class_name,
  };
}

/**
 * 두 ID 배열의 교집합 계산
 *
 * 필터링 시 여러 조건의 결과를 교차시킬 때 사용합니다.
 * - 양쪽 모두 undefined → undefined (제한 없음)
 * - 한쪽만 undefined → 다른 쪽 반환
 * - 양쪽 모두 배열 → 교집합 반환
 *
 * @param a - 첫 번째 ID 배열 (undefined = 제한 없음)
 * @param b - 두 번째 ID 배열 (undefined = 제한 없음)
 * @returns 교집합 결과 (undefined = 제한 없음)
 */
export function intersect(
  a: string[] | undefined,
  b: string[] | undefined
): string[] | undefined {
  if (!a && !b) return undefined;
  if (!a) return b;
  if (!b) return a;
  const setB = new Set(b);
  return a.filter((id) => setB.has(id));
}
