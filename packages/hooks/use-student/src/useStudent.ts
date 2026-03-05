/**
 * useStudent Hook — Barrel Re-export
 *
 * [SSOT] 도메인별 분할 파일을 re-export하여 하위 호환성 유지
 * [불변 규칙] index.ts의 public API 변경 없음
 */

// 학생 쿼리 (fetchStudents, useStudents, fetchPersons, fetchPersonsCount, useStudentsPaged, useStudent)
export * from './student-queries';

// 학생 뮤테이션 (useCreateStudent, useBulkCreateStudents, useUpdateStudent, useDeleteStudent)
export * from './student-mutations';

// 보호자 (fetchGuardians, useGuardians, useCreateGuardian, useUpdateGuardian, useDeleteGuardian)
export * from './guardian-hooks';

// 상담기록 (fetchConsultations, useConsultations, useAllConsultations, useConsultationsPaged, ...)
export * from './consultation-hooks';

// 수업/반 배정 (useAllStudentClasses, useStudentClasses, useStudentClassesPaged, ...)
export * from './class-hooks';

// 태그 (useStudentTags, useStudentTagsByStudent, useAllStudentTagAssignments, useUpdateStudentTags)
export * from './tag-hooks';
