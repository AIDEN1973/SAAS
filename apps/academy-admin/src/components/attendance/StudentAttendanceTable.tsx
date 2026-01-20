/**
 * StudentAttendanceTable Component
 *
 * 학생별 출결 현황 테이블
 * [불변 규칙] CSS 변수만 사용 (하드코딩 금지)
 */

import React from 'react';
import { useIndustryTerms } from '@hooks/use-industry-terms';
import { getStatusIcon, getStatusLabel, getStatusColor } from './utils';
import type { StudentAttendanceTableProps } from './types';

export const StudentAttendanceTable: React.FC<StudentAttendanceTableProps> = ({
  students,
}) => {
  const terms = useIndustryTerms();

  if (students.length === 0) {
    return (
      <div
        style={{
          padding: 'var(--spacing-lg)',
          textAlign: 'center',
          color: 'var(--color-text-tertiary)',
          fontSize: 'var(--font-size-sm)',
        }}
      >
        출결 기록이 없습니다.
      </div>
    );
  }

  return (
    <div
      style={{
        overflowX: 'auto',
        WebkitOverflowScrolling: 'touch',
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
              backgroundColor: 'var(--color-bg-tertiary)',
              borderBottom: 'var(--border-width-thin) solid var(--color-border)',
            }}
          >
            <th
              style={{
                padding: 'var(--spacing-sm) var(--spacing-md)',
                textAlign: 'left',
                fontWeight: 'var(--font-weight-medium)',
                color: 'var(--color-text-secondary)',
                whiteSpace: 'nowrap',
              }}
            >
              {terms.PERSON_LABEL_PRIMARY}명
            </th>
            <th
              style={{
                padding: 'var(--spacing-sm) var(--spacing-md)',
                textAlign: 'center',
                fontWeight: 'var(--font-weight-medium)',
                color: 'var(--color-text-secondary)',
                whiteSpace: 'nowrap',
              }}
            >
              {terms.CHECK_IN_LABEL}
            </th>
            <th
              style={{
                padding: 'var(--spacing-sm) var(--spacing-md)',
                textAlign: 'center',
                fontWeight: 'var(--font-weight-medium)',
                color: 'var(--color-text-secondary)',
                whiteSpace: 'nowrap',
              }}
            >
              {terms.CHECK_OUT_LABEL}
            </th>
            <th
              style={{
                padding: 'var(--spacing-sm) var(--spacing-md)',
                textAlign: 'center',
                fontWeight: 'var(--font-weight-medium)',
                color: 'var(--color-text-secondary)',
                whiteSpace: 'nowrap',
              }}
            >
              상태
            </th>
            <th
              style={{
                padding: 'var(--spacing-sm) var(--spacing-md)',
                textAlign: 'center',
                fontWeight: 'var(--font-weight-medium)',
                color: 'var(--color-text-secondary)',
                whiteSpace: 'nowrap',
              }}
            >
              체류시간
            </th>
          </tr>
        </thead>
        <tbody>
          {students.map((student, index) => (
            <tr
              key={student.studentId}
              style={{
                backgroundColor:
                  index % 2 === 0
                    ? 'var(--color-bg-primary)'
                    : 'var(--color-bg-secondary)',
                borderBottom:
                  index < students.length - 1
                    ? 'var(--border-width-thin) solid var(--color-border-light)'
                    : 'none',
              }}
            >
              <td
                style={{
                  padding: 'var(--spacing-sm) var(--spacing-md)',
                  color: 'var(--color-text-primary)',
                  fontWeight: 'var(--font-weight-medium)',
                  whiteSpace: 'nowrap',
                }}
              >
                {student.studentName}
              </td>
              <td
                style={{
                  padding: 'var(--spacing-sm) var(--spacing-md)',
                  textAlign: 'center',
                  color: student.checkInTime
                    ? 'var(--color-text-primary)'
                    : 'var(--color-text-tertiary)',
                  whiteSpace: 'nowrap',
                }}
              >
                {student.checkInTime || '-'}
              </td>
              <td
                style={{
                  padding: 'var(--spacing-sm) var(--spacing-md)',
                  textAlign: 'center',
                  color: student.checkOutTime
                    ? 'var(--color-text-primary)'
                    : 'var(--color-text-tertiary)',
                  whiteSpace: 'nowrap',
                }}
              >
                {student.checkOutTime || '-'}
              </td>
              <td
                style={{
                  padding: 'var(--spacing-sm) var(--spacing-md)',
                  textAlign: 'center',
                  whiteSpace: 'nowrap',
                }}
              >
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 'var(--spacing-2xs)',
                    color: getStatusColor(student.status),
                    fontWeight: 'var(--font-weight-medium)',
                  }}
                >
                  <span>{getStatusIcon(student.status)}</span>
                  <span>{getStatusLabel(student.status)}</span>
                </span>
              </td>
              <td
                style={{
                  padding: 'var(--spacing-sm) var(--spacing-md)',
                  textAlign: 'center',
                  color: student.duration
                    ? 'var(--color-text-secondary)'
                    : 'var(--color-text-tertiary)',
                  whiteSpace: 'nowrap',
                }}
              >
                {student.duration || '-'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
