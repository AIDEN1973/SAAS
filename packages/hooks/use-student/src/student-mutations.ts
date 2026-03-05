/**
 * Student Mutations
 *
 * [SSOT] 학생 도메인 뮤테이션 훅 (CRUD)
 * [불변 규칙] api-sdk를 통해서만 데이터 요청
 * [불변 규칙] students는 View이므로 persons + academy_students를 각각 관리
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, getApiContext } from '@api-sdk/core';
import type { ApiResponse } from '@api-sdk/core';
import { normalizePhoneNumber } from '@lib/normalization'; // [불변 규칙] 전화번호 정규화
import { useSession } from '@hooks/use-auth';
import { recordMutationAudit } from './audit-mutation';
import type {
  CreateStudentInput,
  UpdateStudentInput,
  Student,
  Guardian,
} from '@services/student-service';
import {
  extractAcademyData,
  mapPersonToStudent,
} from '@industry/academy';
import type { Person } from '@core/party';

/**
 * 학생 생성 Hook
 * [불변 규칙] Zero-Trust: tenantId는 Context에서 자동으로 가져옴
 * [불변 규칙] students는 View이므로 persons + academy_students를 각각 생성해야 함
 */
export function useCreateStudent() {
  const queryClient = useQueryClient();
  const context = getApiContext();
  const tenantId = context.tenantId;
  const industryType = context.industryType || 'academy';
  const { data: session } = useSession();

  return useMutation({
    mutationFn: async (input: CreateStudentInput): Promise<Student & { restored?: boolean }> => {
      const startTime = Date.now();

      // [불변 규칙] 전화번호는 반드시 정규화 (복원 체크 전에 먼저 수행)
      const normalizedPhone = normalizePhoneNumber(input.phone);
      const normalizedFatherPhone = normalizePhoneNumber(input.father_phone);
      const normalizedMotherPhone = normalizePhoneNumber(input.mother_phone);

      // [소프트 삭제 복원] 동일한 이름+전화번호를 가진 삭제된 학생이 있는지 확인
      if (input.name && normalizedPhone && tenantId) {
        interface DeletedStudentRow {
          person_id: string;
          name: string;
          phone: string;
          deleted_at: string;
        }
        const deletedResponse = await apiClient.callRPC<DeletedStudentRow[]>('find_deleted_student', {
          p_tenant_id: tenantId,
          p_name: input.name,
          p_phone: normalizedPhone,
        });

        if (!deletedResponse.error && deletedResponse.data && deletedResponse.data.length > 0) {
          // 삭제된 학생 발견 - 복원 처리
          const deletedStudent = deletedResponse.data[0];

          // 복원 (deleted_at = NULL, status = active)
          await apiClient.callRPC('restore_deleted_student', {
            p_person_id: deletedStudent.person_id,
            p_status: input.status || 'active',
          });

          // 추가 정보 업데이트 (입력된 새 정보로)
          await apiClient.patch('persons', deletedStudent.person_id, {
            address: input.address,
          });

          await apiClient.patch('academy_students', deletedStudent.person_id, {
            birth_date: input.birth_date,
            gender: input.gender,
            school_name: input.school_name,
            grade: input.grade,
            attendance_number: input.attendance_number,
            father_phone: normalizedFatherPhone,
            mother_phone: normalizedMotherPhone,
            notes: input.notes,
            profile_image_url: input.profile_image_url,
          });

          // Execution Audit 기록
          await recordMutationAudit(startTime, session?.user?.id, {
            operation_type: 'student.restore',
            status: 'success',
            summary: `${input.name} 학생 복원 완료 (기존 삭제 데이터 재활성화)`,
            details: {
              student_id: deletedStudent.person_id,
              original_deleted_at: deletedStudent.deleted_at,
            },
            reference: {
              entity_type: 'student',
              entity_id: deletedStudent.person_id,
            },
          });

          // 복원된 학생 정보 반환
          return {
            id: deletedStudent.person_id,
            tenant_id: tenantId,
            industry_type: industryType,
            name: input.name,
            phone: normalizedPhone,
            status: input.status || 'active',
            restored: true,  // 복원 여부 플래그
          } as Student & { restored: boolean };
        }
      }

      // 1. persons 테이블에 생성 (공통 필드)
      const personResponse = await apiClient.post<Person>('persons', {
        name: input.name,
        email: input.email,
        phone: normalizedPhone,
        address: input.address,
        person_type: 'student',
      });

      if (personResponse.error) {
        throw new Error(personResponse.error.message);
      }

      const person = personResponse.data!;

      // 2. 출결번호 자동 생성 로직 (중복 방지)
      // [개선] DB의 generate_attendance_number 함수 사용하여 Race Condition 방지
      let attendanceNumber = input.attendance_number;
      if (!attendanceNumber && input.phone && tenantId) {
        // 데이터베이스 함수를 통한 원자적 생성
        const generateResponse = await apiClient.callRPC('generate_attendance_number', {
          p_tenant_id: tenantId,
          p_phone: input.phone,
        });

        if (!generateResponse.error && generateResponse.data) {
          attendanceNumber = generateResponse.data as string;
        }
      }

      // 3. academy_students 테이블에 확장 정보 추가
      interface AcademyStudent {
        person_id: string;
        tenant_id: string;
        birth_date?: string;
        gender?: string;
        school_name?: string;
        grade?: string;
        class_name?: string;
        attendance_number?: string;
        father_phone?: string;
        mother_phone?: string;
        status?: string;
        notes?: string;
        profile_image_url?: string;
        created_at: string;
        updated_at: string;
        created_by?: string;
        updated_by?: string;
      }
      const academyResponse = await apiClient.post<AcademyStudent>('academy_students', {
        person_id: person.id,
        birth_date: input.birth_date,
        gender: input.gender,
        school_name: input.school_name,
        grade: input.grade,
        attendance_number: attendanceNumber,
        father_phone: normalizedFatherPhone,
        mother_phone: normalizedMotherPhone,
        status: input.status || 'active',
        notes: input.notes,
        profile_image_url: input.profile_image_url,
      });

      if (academyResponse.error) {
        // 롤백: persons 삭제
        await apiClient.delete('persons', person.id);
        throw new Error(academyResponse.error.message);
      }

      // [N+1 최적화] 4. 보호자 정보와 태그 연결을 병렬로 처리
      const guardianPromises = (input.guardians && input.guardians.length > 0)
        ? input.guardians.map((guardian) =>
            apiClient.post<Guardian>('guardians', {
              tenant_id: tenantId,
              student_id: person.id,
              ...guardian,
            })
          )
        : [];

      const tagPromises = (input.tag_ids && input.tag_ids.length > 0)
        ? input.tag_ids.map((tagId) =>
            apiClient.post('tag_assignments', {
              tenant_id: tenantId,
              entity_id: person.id,
              entity_type: 'student',
              tag_id: tagId,
            })
          )
        : [];

      // 보호자와 태그 생성을 병렬로 실행
      const results = await Promise.all([...guardianPromises, ...tagPromises]);

      // 에러 확인 (하나라도 실패하면 롤백)
      const failedResult = results.find((r) => r.error);
      if (failedResult) {
        // 롤백: persons 및 academy_students는 cascade로 삭제됨
        await apiClient.delete('persons', person.id);
        throw new Error(failedResult.error?.message || 'Failed to create guardian or tag');
      }

      // 6. Execution Audit 기록 생성 (액티비티.md 3.3, 12 참조)
      await recordMutationAudit(startTime, session?.user?.id, {
        operation_type: 'student.register',
        status: 'success',
        summary: `${input.name} 학생 등록 완료`,
        details: { student_id: person.id },
        reference: { entity_type: 'student', entity_id: person.id },
      });

      // 7. 결과 반환 (persons + academy_students 조합)
      return mapPersonToStudent(
        person,
        academyResponse.data as Record<string, unknown> | undefined
      ) as Student;
    },
    onSuccess: () => {
      // 학생 목록 쿼리 무효화
      void queryClient.invalidateQueries({ queryKey: ['students', tenantId] });
      void queryClient.invalidateQueries({ queryKey: ['students-paged', tenantId] });
    },
  });
}

/**
 * 학생 일괄 등록 Hook (요청)
 * [요구사항] 학생 일괄 등록(엑셀)
 */
export function useBulkCreateStudents() {
  const queryClient = useQueryClient();
  const context = getApiContext();
  const tenantId = context.tenantId;

  return useMutation({
    mutationFn: async (students: CreateStudentInput[]) => {
      // [N+1 최적화] 일괄 등록을 병렬 처리 (최대 10개씩 배치)
      const BATCH_SIZE = 10;
      const results: Student[] = [];
      const errors: Array<{ index: number; error: string }> = [];

      interface AcademyStudent {
        person_id: string;
        tenant_id: string;
        birth_date?: string;
        gender?: string;
        school_name?: string;
        grade?: string;
        class_name?: string;
        status?: string;
        notes?: string;
        profile_image_url?: string;
        created_at: string;
        updated_at: string;
        created_by?: string;
        updated_by?: string;
      }

      // 배치 단위로 처리
      for (let batchStart = 0; batchStart < students.length; batchStart += BATCH_SIZE) {
        const batch = students.slice(batchStart, batchStart + BATCH_SIZE);

        // [N+1 최적화] 1. 배치 내 persons 생성을 병렬로 처리
        const personPromises = batch.map((student) =>
          apiClient.post<Person>('persons', {
            name: student.name,
            email: student.email,
            phone: student.phone,
            address: student.address,
            person_type: 'student',
          })
        );

        const personResponses = await Promise.all(personPromises);

        // [N+1 최적화] 2. 성공한 persons에 대해 academy_students 생성을 병렬로 처리
        const academyPromises: Promise<ApiResponse<AcademyStudent>>[] = [];
        const validPersons: { index: number; person: Person; student: CreateStudentInput }[] = [];

        personResponses.forEach((response, i) => {
          const globalIndex = batchStart + i;
          if (response.error) {
            errors.push({ index: globalIndex, error: response.error.message });
          } else if (response.data) {
            validPersons.push({
              index: globalIndex,
              person: response.data,
              student: batch[i],
            });
            academyPromises.push(
              apiClient.post<AcademyStudent>('academy_students', {
                tenant_id: tenantId,
                person_id: response.data.id,
                birth_date: batch[i].birth_date,
                gender: batch[i].gender,
                school_name: batch[i].school_name,
                grade: batch[i].grade,
                status: batch[i].status || 'active',
                notes: batch[i].notes,
                profile_image_url: batch[i].profile_image_url,
              })
            );
          }
        });

        const academyResponses = await Promise.all(academyPromises);

        // 결과 처리
        academyResponses.forEach((academyResponse, i) => {
          const { index: globalIndex, person } = validPersons[i];

          if (academyResponse.error) {
            // 롤백: persons 삭제 (비동기로 처리, 에러 무시)
            void apiClient.delete('persons', person.id).catch(() => {});
            errors.push({ index: globalIndex, error: academyResponse.error.message });
          } else {
            results.push(mapPersonToStudent(
              person,
              academyResponse.data as Record<string, unknown> | undefined
            ) as Student);
          }
        });
      }

      if (errors.length > 0) {
        console.warn('일부 학생 등록 실패:', errors);
      }

      return { results, errors };
    },
    onSuccess: () => {
      // 학생 목록 쿼리 무효화
      void queryClient.invalidateQueries({ queryKey: ['students', tenantId] });
      void queryClient.invalidateQueries({ queryKey: ['students-paged', tenantId] });
    },
  });
}

/**
 * 학생 수정 Hook
 * [불변 규칙] Zero-Trust: tenantId는 Context에서 자동으로 가져옴
 * [불변 규칙] students는 View이므로 persons와 academy_students를 각각 업데이트해야 함
 */
export function useUpdateStudent() {
  const queryClient = useQueryClient();
  const context = getApiContext();
  const tenantId = context.tenantId;
  const { data: session } = useSession();

  return useMutation({
    mutationFn: async ({
      studentId,
      input,
    }: {
      studentId: string;
      input: UpdateStudentInput;
    }) => {
      const startTime = Date.now();

      // [불변 규칙] 전화번호는 반드시 정규화하여 저장
      const normalizedPhone = input.phone !== undefined ? (normalizePhoneNumber(input.phone) || undefined) : undefined;
      const normalizedFatherPhone = input.father_phone !== undefined ? (normalizePhoneNumber(input.father_phone) || undefined) : undefined;
      const normalizedMotherPhone = input.mother_phone !== undefined ? (normalizePhoneNumber(input.mother_phone) || undefined) : undefined;

      // 1. persons 테이블 업데이트 (공통 필드)
      const personUpdate: Partial<{ name?: string; email?: string; phone?: string; address?: string }> = {};
      if (input.name !== undefined) personUpdate.name = input.name;
      if (input.email !== undefined) personUpdate.email = input.email;
      if (normalizedPhone !== undefined) personUpdate.phone = normalizedPhone;
      if (input.address !== undefined) personUpdate.address = input.address;

      if (Object.keys(personUpdate).length > 0) {
        const personResponse = await apiClient.patch('persons', studentId, personUpdate);
        if (personResponse.error) {
          throw new Error(personResponse.error.message);
        }
      }

      // 2. academy_students 테이블 업데이트 (업종 특화 필드)
      const academyUpdate: Partial<Student> = {};
      if (input.birth_date !== undefined) academyUpdate.birth_date = input.birth_date;
      if (input.gender !== undefined) academyUpdate.gender = input.gender;
      if (input.school_name !== undefined) academyUpdate.school_name = input.school_name;
      if (input.grade !== undefined) academyUpdate.grade = input.grade;
      if (input.attendance_number !== undefined) academyUpdate.attendance_number = input.attendance_number;
      if (normalizedFatherPhone !== undefined) academyUpdate.father_phone = normalizedFatherPhone;
      if (normalizedMotherPhone !== undefined) academyUpdate.mother_phone = normalizedMotherPhone;
      if (input.status !== undefined) academyUpdate.status = input.status;
      if (input.notes !== undefined) academyUpdate.notes = input.notes;
      if (input.profile_image_url !== undefined) academyUpdate.profile_image_url = input.profile_image_url;

      if (Object.keys(academyUpdate).length > 0) {
        // academy_students는 person_id를 PK로 사용하므로 person_id로 조회 후 업데이트
        interface AcademyStudent {
          person_id: string;
          tenant_id: string;
          birth_date?: string;
          gender?: string;
          school_name?: string;
          grade?: string;
          class_name?: string;
          attendance_number?: string;
          father_phone?: string;
          mother_phone?: string;
          status?: string;
          notes?: string;
          profile_image_url?: string;
          created_at: string;
          updated_at: string;
          created_by?: string;
          updated_by?: string;
        }
        // [소프트 삭제] 삭제되지 않은 학생만 조회
        const academyResponse = await apiClient.get<AcademyStudent>('academy_students', {
          filters: { person_id: studentId, deleted_at: null },
          limit: 1,
        });

        if (academyResponse.error) {
          throw new Error(academyResponse.error.message);
        }

        const academyStudent = academyResponse.data?.[0];
        if (academyStudent) {
          const updateResponse = await apiClient.patch('academy_students', academyStudent.person_id, academyUpdate);
          if (updateResponse.error) {
            throw new Error(updateResponse.error.message);
          }
        }
      }

      // 3. 업데이트된 데이터 조회하여 반환
      const studentResponse = await apiClient.get<Person & { academy_students?: Array<Record<string, unknown>> }>('persons', {
        select: `
          *,
          academy_students (
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
            created_at,
            updated_at,
            created_by,
            updated_by
          )
        `,
        filters: { id: studentId, person_type: 'student' },
        limit: 1,
      });

      if (studentResponse.error) {
        throw new Error(studentResponse.error.message);
      }

      const person = studentResponse.data?.[0];
      if (!person) {
        throw new Error('Student not found');
      }

      const academyData = extractAcademyData(person.academy_students);
      const updatedStudent = mapPersonToStudent(person, academyData) as Student;

      // Execution Audit 기록 생성 (액티비티.md 3.3, 12 참조)
      const changedFields: string[] = [];
      if (input.name !== undefined) changedFields.push('이름');
      if (input.phone !== undefined) changedFields.push('전화번호');
      if (input.email !== undefined) changedFields.push('이메일');
      if (input.address !== undefined) changedFields.push('주소');
      if (input.birth_date !== undefined) changedFields.push('생년월일');
      if (input.gender !== undefined) changedFields.push('성별');
      if (input.school_name !== undefined) changedFields.push('학교명');
      if (input.grade !== undefined) changedFields.push('학년');
      if (input.status !== undefined) changedFields.push('상태');
      if (input.notes !== undefined) changedFields.push('비고');
      if (input.profile_image_url !== undefined) changedFields.push('프로필 이미지');

      await recordMutationAudit(startTime, session?.user?.id, {
        operation_type: 'student.update',
        status: 'success',
        summary: `${updatedStudent.name} 학생 정보 수정 완료 (${changedFields.join(', ')})`,
        details: { student_id: studentId },
        reference: { entity_type: 'student', entity_id: studentId },
      });

      return updatedStudent;
    },
    // [P2-4] Optimistic Update: 네트워크 응답 전에 즉시 UI 업데이트
    onMutate: async ({ studentId, input }) => {
      // 진행 중인 쿼리 취소
      await queryClient.cancelQueries({ queryKey: ['student', tenantId, studentId] });
      await queryClient.cancelQueries({ queryKey: ['students', tenantId] });

      // 이전 데이터 스냅샷
      const previousStudent = queryClient.getQueryData<Student>(['student', tenantId, studentId]);
      const previousStudents = queryClient.getQueryData<Student[]>(['students', tenantId]);

      // 낙관적 업데이트: 개별 학생
      if (previousStudent) {
        const normalizedPhone = input.phone !== undefined ? normalizePhoneNumber(input.phone) : undefined;
        queryClient.setQueryData<Student>(['student', tenantId, studentId], {
          ...previousStudent,
          ...input,
          phone: normalizedPhone ?? previousStudent.phone,
        });
      }

      // 낙관적 업데이트: 학생 목록
      if (previousStudents) {
        queryClient.setQueryData<Student[]>(['students', tenantId], (old) =>
          old?.map((student) => {
            if (student.id === studentId) {
              const normalizedPhone = input.phone !== undefined ? normalizePhoneNumber(input.phone) : undefined;
              return {
                ...student,
                ...input,
                phone: normalizedPhone ?? student.phone,
              };
            }
            return student;
          })
        );
      }

      return { previousStudent, previousStudents };
    },
    // 에러 발생 시 이전 데이터로 롤백
    onError: (_err, { studentId }, context) => {
      if (context?.previousStudent) {
        queryClient.setQueryData(['student', tenantId, studentId], context.previousStudent);
      }
      if (context?.previousStudents) {
        queryClient.setQueryData(['students', tenantId], context.previousStudents);
      }
    },
    onSuccess: (data) => {
      // 학생 목록 및 상세 쿼리 무효화
      // students-paged 쿼리도 무효화하여 테이블에 즉시 반영되도록 함
      void queryClient.invalidateQueries({ queryKey: ['students', tenantId] });
      void queryClient.invalidateQueries({ queryKey: ['students-paged', tenantId] });
      void queryClient.invalidateQueries({
        queryKey: ['student', tenantId, data.id],
      });
      // [P0-FIX] 통계 카드도 무효화 (status 변경 시 통계 즉시 반영)
      void queryClient.invalidateQueries({ queryKey: ['student-stats', tenantId] });
      void queryClient.invalidateQueries({ queryKey: ['student-stats-cards', tenantId] });
    },
  });
}

/**
 * 학생 삭제 Hook (Soft delete: deleted_at 타임스탬프 설정)
 * [퇴원 vs 삭제 구분]
 * - 퇴원: status = 'withdrawn', 목록에서 조회 가능 (필터로)
 * - 삭제: deleted_at IS NOT NULL, 목록에서 완전히 숨김
 * [불변 규칙] Zero-Trust: tenantId는 Context에서 자동으로 가져옴
 */
export function useDeleteStudent() {
  const queryClient = useQueryClient();
  const context = getApiContext();
  const tenantId = context.tenantId;
  const { data: session } = useSession();

  return useMutation({
    mutationFn: async (studentId: string) => {
      const startTime = Date.now();

      // 학생 정보 조회 (Execution Audit 기록용)
      const studentResponse = await apiClient.get<Person>('persons', {
        filters: { id: studentId, person_type: 'student' },
        limit: 1,
      });

      const studentName = studentResponse.data?.[0]?.name || '알 수 없음';

      // Soft delete: deleted_at 타임스탬프 설정
      // [불변 규칙] students는 View이므로 academy_students를 직접 업데이트해야 함
      const deleteResponse = await apiClient.callRPC('soft_delete_student', {
        p_person_id: studentId,
      });

      if (deleteResponse.error) {
        throw new Error(deleteResponse.error.message);
      }

      // Execution Audit 기록 생성 (액티비티.md 3.3, 12 참조)
      await recordMutationAudit(startTime, session?.user?.id, {
        operation_type: 'student.delete',
        status: 'success',
        summary: `${studentName} 학생 삭제 완료`,
        details: { student_id: studentId },
        reference: { entity_type: 'student', entity_id: studentId },
      });

      return studentId;
    },
    // [P2-4] Optimistic Update: 삭제 시 즉시 UI에서 제거
    onMutate: async (studentId: string) => {
      // 진행 중인 쿼리 취소
      await queryClient.cancelQueries({ queryKey: ['students', tenantId] });
      await queryClient.cancelQueries({ queryKey: ['student', tenantId, studentId] });

      // 이전 데이터 스냅샷
      const previousStudents = queryClient.getQueryData<Student[]>(['students', tenantId]);

      // 낙관적 업데이트: 학생 목록에서 즉시 제거
      if (previousStudents) {
        queryClient.setQueryData<Student[]>(['students', tenantId], (old) =>
          old?.filter((student) => student.id !== studentId)
        );
      }

      return { previousStudents, studentId };
    },
    // 에러 발생 시 이전 데이터로 롤백
    onError: (_err, _studentId, context) => {
      if (context?.previousStudents) {
        queryClient.setQueryData(['students', tenantId], context.previousStudents);
      }
    },
    onSuccess: () => {
      // 학생 목록 쿼리 무효화
      void queryClient.invalidateQueries({ queryKey: ['students', tenantId] });
      void queryClient.invalidateQueries({ queryKey: ['students-paged', tenantId] });
      // 선택 학생 상세도 무효화 (레이어 메뉴에서 바로 반영)
      void queryClient.invalidateQueries({ queryKey: ['student', tenantId] });
    },
  });
}
