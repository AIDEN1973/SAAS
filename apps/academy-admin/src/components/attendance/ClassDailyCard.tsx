/**
 * ClassDailyCard Component
 *
 * 수업별 일일 출결 아코디언 카드
 * [불변 규칙] CSS 변수만 사용 (하드코딩 금지)
 */

import React from 'react';
import { ChevronDown, Clock, Users, CheckCircle, AlertTriangle, XCircle, Info } from 'lucide-react';
import { Badge } from '@ui-core/react';
import { StudentAttendanceTable } from './StudentAttendanceTable';
import type { ClassDailyCardProps } from './types';

export const ClassDailyCard: React.FC<ClassDailyCardProps> = ({
  classAttendance,
  isExpanded,
  onToggle,
}) => {
  const { className, startTime, endTime, stats, students } = classAttendance;

  return (
    <div
      style={{
        backgroundColor: 'var(--color-bg-primary)',
        borderRadius: 'var(--border-radius-md)',
        border: 'var(--border-width-thin) solid var(--color-border)',
        overflow: 'hidden',
        marginBottom: 'var(--spacing-sm)',
      }}
    >
      {/* 아코디언 헤더 */}
      <button
        type="button"
        onClick={onToggle}
        style={{
          width: '100%',
          padding: 'var(--spacing-md) var(--spacing-lg)',
          backgroundColor: 'var(--color-bg-primary)',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 'var(--spacing-md)',
          transition: 'background-color var(--transition-fast)',
          minHeight: 'var(--touch-target-min)',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = 'var(--color-bg-secondary)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'var(--color-bg-primary)';
        }}
      >
        {/* 왼쪽: 펼침 아이콘 + 수업 정보 */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--spacing-sm)',
            flex: 1,
            minWidth: 0,
          }}
        >
          {/* 펼침/접힘 아이콘 */}
          <div
            style={{
              transition: 'transform var(--transition-fast)',
              transform: isExpanded ? 'rotate(0deg)' : 'rotate(-90deg)',
              color: 'var(--color-text-secondary)',
              flexShrink: 0,
            }}
          >
            <ChevronDown size={18} />
          </div>

          {/* 수업명 */}
          <span
            style={{
              fontSize: 'var(--font-size-base)',
              fontWeight: 'var(--font-weight-medium)',
              color: 'var(--color-text-primary)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {className}
          </span>

          {/* 수업 시간 */}
          <Badge variant="soft" color="gray">
            <Clock size={12} style={{ marginRight: 'var(--spacing-2xs)' }} />
            {startTime} - {endTime}
          </Badge>
        </div>

        {/* 오른쪽: 인원 수 + 출결 통계 */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--spacing-md)',
            color: 'var(--color-text-secondary)',
            fontSize: 'var(--font-size-sm)',
            flexShrink: 0,
          }}
        >
          {/* 총 인원 */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--spacing-2xs)',
            }}
          >
            <Users size={14} />
            <span>{stats.total}명</span>
          </div>

          {/* 구분선 */}
          <div
            style={{
              width: '1px',
              height: '16px',
              backgroundColor: 'var(--color-border)',
            }}
          />

          {/* 출결 통계 */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--spacing-sm)',
            }}
          >
            {stats.present > 0 && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--spacing-2xs)',
                  color: 'var(--color-success)',
                }}
              >
                <CheckCircle size={14} />
                <span>{stats.present}</span>
              </div>
            )}
            {stats.late > 0 && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--spacing-2xs)',
                  color: 'var(--color-warning)',
                }}
              >
                <AlertTriangle size={14} />
                <span>{stats.late}</span>
              </div>
            )}
            {stats.absent > 0 && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--spacing-2xs)',
                  color: 'var(--color-error)',
                }}
              >
                <XCircle size={14} />
                <span>{stats.absent}</span>
              </div>
            )}
            {stats.excused > 0 && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--spacing-2xs)',
                  color: 'var(--color-info)',
                }}
              >
                <Info size={14} />
                <span>{stats.excused}</span>
              </div>
            )}
          </div>
        </div>
      </button>

      {/* 아코디언 콘텐츠 */}
      {isExpanded && (
        <div
          style={{
            borderTop: 'var(--border-width-thin) solid var(--color-border-light)',
            animation: 'fadeIn var(--transition-base)',
          }}
        >
          <StudentAttendanceTable students={students} />
        </div>
      )}
    </div>
  );
};
