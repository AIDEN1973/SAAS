/**
 * Audit Mutation Helper
 *
 * [SSOT] Execution Audit 기록의 반복 보일러플레이트를 제거합니다.
 * 모든 mutation에서 동일한 패턴:
 *   if (session?.user?.id) { const durationMs = ...; await createExecutionAuditRecord(..., session.user.id); }
 *
 * 이 헬퍼는 위 패턴을 1줄 호출로 대체합니다.
 */

import { createExecutionAuditRecord } from './execution-audit-utils';
import type { CreateExecutionAuditParams } from './execution-audit-utils';

/**
 * Mutation 실행 후 Execution Audit 기록을 조건부로 생성합니다.
 *
 * @param startTime - mutation 시작 시점 (Date.now())
 * @param userId - session?.user?.id (undefined면 기록 생략)
 * @param params - createExecutionAuditRecord 매개변수 (duration_ms 제외 — 자동 계산)
 *
 * @example
 * const startTime = Date.now();
 * // ... mutation logic ...
 * await recordMutationAudit(startTime, session?.user?.id, {
 *   operation_type: 'student.register',
 *   status: 'success',
 *   summary: `${input.name} 학생 등록 완료`,
 *   details: { student_id: person.id },
 *   reference: { entity_type: 'student', entity_id: person.id },
 * });
 */
export async function recordMutationAudit(
  startTime: number,
  userId: string | undefined,
  params: Omit<CreateExecutionAuditParams, 'duration_ms'>
): Promise<void> {
  if (!userId) return;
  const durationMs = Date.now() - startTime;
  await createExecutionAuditRecord(
    { ...params, duration_ms: durationMs },
    userId
  );
}
