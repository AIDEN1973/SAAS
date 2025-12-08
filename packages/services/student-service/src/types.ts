/**
 * Student Service Types
 *
 * [불변 규칙] Service Layer는 Industry Layer의 타입을 재export합니다
 * 실제 타입 정의는 @industry/academy/types를 참조합니다.
 */

// Industry Layer의 타입을 재export
export type {
  Student,
  Guardian,
  StudentClass,
  StudentConsultation,
  CreateStudentInput,
  UpdateStudentInput,
  StudentFilter,
  StudentStatus,
  Gender,
  GuardianRelationship,
  ConsultationType,
} from '@industry/academy/types';
