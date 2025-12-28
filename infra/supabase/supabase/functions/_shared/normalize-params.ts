// LAYER: EDGE_FUNCTION_SHARED
/**
 * 파라미터 정규화 (범용)
 *
 * AI가 추출한 파라미터를 Handler가 기대하는 형식으로 변환합니다.
 * - name → student_id (학생 이름으로 조회)
 * - class_name → class_id (반 이름으로 조회)
 * - 기타 일반적인 변환 규칙 적용
 *
 * 이 함수는 모든 Intent에 일관되게 적용되며, 케이스별 로직을 피합니다.
 */

import { withTenant } from './withTenant.ts';
import { toKSTDate } from './date-utils.ts';
import { maskPII } from './pii-utils.ts';
import { getTenantTableName } from './industry-adapter.ts';

export async function normalizeParams(
  params: Record<string, unknown>,
  intentKey: string,
  supabase: any,
  tenantId: string
): Promise<Record<string, unknown>> {
  const normalized = { ...params };

  // student_id가 없거나 UUID 형식이 아닌 경우: name으로 student_id 조회
  // ⚠️ P0: AI가 student_id에 이름을 넣는 경우 방지
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const hasValidStudentId = normalized.student_id && typeof normalized.student_id === 'string' && uuidRegex.test(normalized.student_id);

  // student_id가 없거나 유효하지 않은 경우, name으로 변환 시도
  if (!hasValidStudentId) {
    // name이 있으면 name 사용, 없으면 student_id를 name으로 간주 (AI가 잘못 넣은 경우)
    const studentName = (normalized.name && typeof normalized.name === 'string')
      ? normalized.name.trim()
      : (normalized.student_id && typeof normalized.student_id === 'string' && !uuidRegex.test(normalized.student_id))
        ? normalized.student_id.trim() // student_id에 이름이 들어간 경우
        : null;

    if (studentName) {
      try {
        // ⚠️ 중요: withTenant를 사용하여 tenant_id 필터링 필수
        // 1단계: 정확한 이름 일치 시도
        let { data: persons, error: searchError } = await withTenant(
          supabase
            .from('persons')
            .select('id, name')
            .eq('name', studentName)
            .eq('person_type', 'student')
            .limit(1),
          tenantId
        );

        // 2단계: 정확한 일치가 없으면 부분 일치 시도 (ILIKE 사용, 대소문자 무시)
        if ((searchError || !persons || persons.length === 0) && studentName.length > 0) {
          const { data: partialMatch, error: partialError } = await withTenant(
            supabase
              .from('persons')
              .select('id, name')
              .ilike('name', `%${studentName}%`)
              .eq('person_type', 'student')
              .limit(1),
            tenantId
          );

          if (!partialError && partialMatch && partialMatch.length > 0) {
            persons = partialMatch;
            searchError = null;
            console.log('[ChatOps:Normalize] name → student_id 부분 일치 성공:', {
              name: maskPII(studentName),
              matched_name: maskPII(partialMatch[0].name),
            });
          }
        }

        if (!searchError && persons && persons.length > 0) {
          normalized.student_id = persons[0].id;
          // 잘못된 student_id 값 제거 (이름이 들어간 경우)
          if (normalized.student_id === studentName || (normalized.name && normalized.name === studentName && normalized.student_id !== persons[0].id)) {
            // 이미 올바른 UUID로 설정되었으므로 추가 작업 불필요
          }
          console.log('[ChatOps:Normalize] name → student_id 변환 성공:', {
            name: maskPII(studentName),
            student_id: persons[0].id.substring(0, 8) + '...',
          });
          // name은 제거하지 않음 (Handler가 필요할 수 있음)
        } else {
          // ⚠️ P0: Resolver Gate - 변환 실패 시 에러 정보 저장 (Apply 단계에서 검증)
          console.log('[ChatOps:Normalize] name → student_id 변환 실패:', {
            name: maskPII(studentName),
            error: searchError ? maskPII(searchError) : '학생을 찾을 수 없음',
          });
          // 변환 실패 정보를 저장 (Apply 단계에서 검증)
          normalized._resolve_failed = {
            field: 'student_id',
            original_value: studentName,
            reason: searchError ? '학생을 찾을 수 없습니다' : '학생을 찾을 수 없음',
          };
          // 잘못된 student_id 값 제거 (이름이 들어간 경우)
          if (normalized.student_id === studentName) {
            delete normalized.student_id;
          }
        }
      } catch (error) {
        const maskedError = maskPII(error);
        console.error('[ChatOps:Normalize] name → student_id 변환 중 오류:', maskedError);
        normalized._resolve_failed = {
          field: 'student_id',
          original_value: studentName || '',
          reason: '변환 중 오류 발생',
        };
        if (normalized.student_id === studentName) {
          delete normalized.student_id;
        }
      }
    }
  }

  // class_name → class_id 변환
  if (normalized.class_name && typeof normalized.class_name === 'string' && !normalized.class_id) {
    try {
      const className = normalized.class_name.trim();
      // ⚠️ 중요: Industry Adapter 사용 (업종 중립성)
      const classTableName = await getTenantTableName(supabase, tenantId, 'class');
      if (classTableName) {
        const { data: classes, error: classError } = await withTenant(
          supabase
            .from(classTableName)
            .select('id, name')
            .eq('name', className)
            .limit(1),
          tenantId
        );

        if (!classError && classes && classes.length > 0) {
          normalized.class_id = classes[0].id;
          console.log('[ChatOps:Normalize] class_name → class_id 변환 성공:', {
            class_name: maskPII(className),
            class_id: classes[0].id.substring(0, 8) + '...',
          });
        } else {
          console.log('[ChatOps:Normalize] class_name → class_id 변환 실패:', {
            class_name: maskPII(className),
            error: classError ? maskPII(classError) : '반을 찾을 수 없음',
          });
          normalized._resolve_failed = {
            field: 'class_id',
            original_value: className,
            reason: classError ? '반을 찾을 수 없습니다' : '반을 찾을 수 없음',
          };
        }
      }
    } catch (error) {
      const maskedError = maskPII(error);
      console.error('[ChatOps:Normalize] class_name → class_id 변환 중 오류:', maskedError);
    }
  }

  // 날짜 형식 정규화 (YYYY-MM-DD)
  // ⚠️ P1: 날짜 처리 - toKSTDate() 사용 (체크리스트 준수)
  // ChatOps_계약_붕괴_방지_체계_분석.md 3.1 참조: 자연어 상대시간 서버 측 재확인
  if (normalized.date && typeof normalized.date === 'string') {
    // "오늘", "어제", "내일" 같은 상대시간 표현 처리 (서버에서 KST 기준으로 재확인)
    const relativeTimeMap: Record<string, string> = {
      '오늘': toKSTDate(new Date()),
      '어제': toKSTDate(new Date(Date.now() - 24 * 60 * 60 * 1000)),
      '내일': toKSTDate(new Date(Date.now() + 24 * 60 * 60 * 1000)),
      'today': toKSTDate(new Date()),
      'yesterday': toKSTDate(new Date(Date.now() - 24 * 60 * 60 * 1000)),
      'tomorrow': toKSTDate(new Date(Date.now() + 24 * 60 * 60 * 1000)),
    };

    const lowerDate = normalized.date.toLowerCase().trim();
    if (relativeTimeMap[lowerDate]) {
      normalized.date = relativeTimeMap[lowerDate];
      console.log('[ChatOps:Normalize] 상대시간 표현 변환:', {
        original: normalized.date,
        normalized: relativeTimeMap[lowerDate],
      });
    }

    // 이미 YYYY-MM-DD 형식인지 확인
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (normalized.date && typeof normalized.date === 'string' && !dateRegex.test(normalized.date)) {
      try {
        const date = new Date(normalized.date as string);
        if (!isNaN(date.getTime())) {
          // ⚠️ P1: toISOString().split('T')[0] 직접 사용 금지, toKSTDate() 사용
          normalized.date = toKSTDate(date);
          console.log('[ChatOps:Normalize] 날짜 형식 정규화:', {
            original: normalized.date,
            normalized: normalized.date,
          });
        }
      } catch (error) {
        // 날짜 파싱 실패는 무시
      }
    }
  }

  return normalized;
}

