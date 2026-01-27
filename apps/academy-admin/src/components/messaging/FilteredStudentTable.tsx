/**
 * FilteredStudentTable - 필터링된 회원 목록 테이블 컴포넌트
 *
 * [LAYER: UI_COMPONENT]
 * [불변 규칙] 업종 중립 용어 사용 (useIndustryTerms)
 * [불변 규칙] CSS 변수 사용 (design-system 토큰)
 * [불변 규칙] UI Core 컴포넌트 사용
 */

import { memo, useState, useMemo } from 'react';
import { Button, Checkbox, Spinner, EmptyState } from '@ui-core/react';
import { useIndustryTerms } from '@hooks/use-industry-terms';
import type { FilteredStudent } from '@hooks/use-filter-tags';

export interface FilteredStudentTableProps {
  students: FilteredStudent[];
  isLoading?: boolean;
  onSendMessage: (studentIds: string[]) => void;
  isSending?: boolean;
}

export const FilteredStudentTable = memo(function FilteredStudentTable({
  students,
  isLoading = false,
  onSendMessage,
  isSending = false,
}: FilteredStudentTableProps) {
  const terms = useIndustryTerms();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // 전체 선택/해제
  const allSelected = useMemo(() => {
    return students.length > 0 && selectedIds.size === students.length;
  }, [students.length, selectedIds.size]);

  const handleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(students.map((s) => s.student_id)));
    }
  };

  const handleSelectOne = (studentId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(studentId)) {
        next.delete(studentId);
      } else {
        next.add(studentId);
      }
      return next;
    });
  };

  const handleSendMessage = () => {
    if (selectedIds.size === 0) return;
    onSendMessage(Array.from(selectedIds));
  };

  // 메타데이터에서 표시할 정보 추출
  const formatMetadata = (metadata: Record<string, unknown>): string => {
    const parts: string[] = [];

    if (metadata.late_days !== undefined && metadata.late_days !== null) {
      parts.push(`지각 ${String(metadata.late_days)}일`);
    }
    if (metadata.absent_days !== undefined && metadata.absent_days !== null) {
      parts.push(`결석 ${String(metadata.absent_days)}일`);
    }
    if (metadata.overdue_amount !== undefined && metadata.overdue_amount !== null) {
      parts.push(`미납 ${(metadata.overdue_amount as number).toLocaleString()}원`);
    }
    if (metadata.overdue_count !== undefined && metadata.overdue_count !== null) {
      parts.push(`미납 ${String(metadata.overdue_count)}건`);
    }
    if (metadata.grade !== undefined && metadata.grade !== null) {
      parts.push(String(metadata.grade));
    }
    if (metadata.last_visit_date !== undefined && metadata.last_visit_date !== null) {
      parts.push(`최근방문: ${String(metadata.last_visit_date)}`);
    }
    if (metadata.enrolled_at !== undefined && metadata.enrolled_at !== null) {
      parts.push(`등록일: ${String(metadata.enrolled_at)}`);
    }

    return parts.join(', ') || '-';
  };

  if (isLoading) {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          padding: 'var(--spacing-xl)',
        }}
      >
        <Spinner size="lg" />
      </div>
    );
  }

  if (students.length === 0) {
    return (
      <div
        style={{
          padding: 'var(--spacing-xl)',
          textAlign: 'center',
        }}
      >
        <EmptyState
          message={`조건에 맞는 ${terms.PERSON_LABEL_PRIMARY}이(가) 없습니다.`}
        />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
      {/* 상단 요약 및 액션 */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: 'var(--spacing-sm) 0',
          borderBottom: 'var(--border-width-thin) solid var(--color-border)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--spacing-md)',
          }}
        >
          <span
            style={{
              fontSize: 'var(--font-size-sm)',
              color: 'var(--color-text-secondary)',
            }}
          >
            총 <strong style={{ color: 'var(--color-text-primary)' }}>{students.length}</strong>명
          </span>
          <span
            style={{
              fontSize: 'var(--font-size-sm)',
              color: 'var(--color-text-secondary)',
            }}
          >
            선택{' '}
            <strong style={{ color: 'var(--color-primary)' }}>{selectedIds.size}</strong>명
          </span>
        </div>

        <Button
          variant="solid"
          size="sm"
          disabled={selectedIds.size === 0 || isSending}
          onClick={handleSendMessage}
        >
          {isSending ? (
            <>
              <Spinner size="sm" />
              <span style={{ marginLeft: 'var(--spacing-xs)' }}>발송 중...</span>
            </>
          ) : (
            `메시지 발송 (${selectedIds.size}명)`
          )}
        </Button>
      </div>

      {/* 테이블 */}
      <div
        style={{
          border: 'var(--border-width-thin) solid var(--color-border)',
          borderRadius: 'var(--border-radius-md)',
          overflow: 'hidden',
        }}
      >
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: 'var(--font-size-sm)',
          }}
        >
          <thead>
            <tr
              style={{
                backgroundColor: 'var(--color-gray-50)',
                borderBottom: 'var(--border-width-thin) solid var(--color-border)',
              }}
            >
              <th
                style={{
                  padding: 'var(--spacing-sm) var(--spacing-md)',
                  textAlign: 'center',
                  width: '48px',
                }}
              >
                <Checkbox checked={allSelected} onChange={handleSelectAll} />
              </th>
              <th
                style={{
                  padding: 'var(--spacing-sm) var(--spacing-md)',
                  textAlign: 'left',
                  fontWeight: 'var(--font-weight-semibold)',
                  color: 'var(--color-text-secondary)',
                }}
              >
                {terms.PERSON_LABEL_PRIMARY} 이름
              </th>
              <th
                style={{
                  padding: 'var(--spacing-sm) var(--spacing-md)',
                  textAlign: 'left',
                  fontWeight: 'var(--font-weight-semibold)',
                  color: 'var(--color-text-secondary)',
                }}
              >
                연락처
              </th>
              <th
                style={{
                  padding: 'var(--spacing-sm) var(--spacing-md)',
                  textAlign: 'left',
                  fontWeight: 'var(--font-weight-semibold)',
                  color: 'var(--color-text-secondary)',
                }}
              >
                상세 정보
              </th>
            </tr>
          </thead>
          <tbody>
            {students.map((student, index) => (
              <tr
                key={`${student.student_id}-${index}`}
                style={{
                  backgroundColor:
                    index % 2 === 0 ? 'var(--color-white)' : 'var(--color-gray-50)',
                  borderBottom:
                    index < students.length - 1
                      ? 'var(--border-width-thin) solid var(--color-border-light)'
                      : 'none',
                }}
              >
                <td
                  style={{
                    padding: 'var(--spacing-sm) var(--spacing-md)',
                    textAlign: 'center',
                  }}
                >
                  <Checkbox
                    checked={selectedIds.has(student.student_id)}
                    onChange={() => handleSelectOne(student.student_id)}
                  />
                </td>
                <td
                  style={{
                    padding: 'var(--spacing-sm) var(--spacing-md)',
                    fontWeight: 'var(--font-weight-medium)',
                    color: 'var(--color-text-primary)',
                  }}
                >
                  {student.student_name}
                </td>
                <td
                  style={{
                    padding: 'var(--spacing-sm) var(--spacing-md)',
                    color: 'var(--color-text-secondary)',
                    fontFamily: 'var(--font-family-mono, monospace)',
                  }}
                >
                  {student.phone || '-'}
                </td>
                <td
                  style={{
                    padding: 'var(--spacing-sm) var(--spacing-md)',
                    color: 'var(--color-text-tertiary)',
                    fontSize: 'var(--font-size-xs)',
                  }}
                >
                  {formatMetadata(student.metadata)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 하단 발송 안내 */}
      <div
        style={{
          padding: 'var(--spacing-sm)',
          backgroundColor: 'var(--color-info-bg)',
          borderRadius: 'var(--border-radius-sm)',
          fontSize: 'var(--font-size-xs)',
          color: 'var(--color-info-text)',
        }}
      >
        * 알림톡 우선 발송, 실패 시 SMS로 자동 전환됩니다.
      </div>
    </div>
  );
});

export default FilteredStudentTable;
