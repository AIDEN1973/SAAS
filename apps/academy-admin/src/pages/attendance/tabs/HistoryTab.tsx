/**
 * 출결 기록(히스토리) 탭 컴포넌트
 *
 * [LAYER: UI_PAGE]
 */

import { useState, useMemo, useCallback } from 'react';
import { Card, EmptyState } from '@ui-core/react';
import { History } from 'lucide-react';
import {
  DailyAttendanceSection,
  groupAttendanceByDate,
} from '../../../components/attendance';
import { useIndustryTerms } from '@hooks/use-industry-terms';
import type { AttendanceLog, AttendanceFilter } from '@services/attendance-service';
import type { Class } from '@services/class-service';
import type { Student } from '@services/student-service';

interface HistoryTabProps {
  attendanceLogs: AttendanceLog[];
  isLoadingLogs: boolean;
  classes: Class[] | undefined;
  students: Student[] | undefined;
  filter: AttendanceFilter;
  onFilterChange: (filter: AttendanceFilter) => void;
}

export function HistoryTab({
  attendanceLogs,
  isLoadingLogs,
  classes,
  students,
  filter,
  onFilterChange,
}: HistoryTabProps) {
  const terms = useIndustryTerms();
  const [historySearchQuery, setHistorySearchQuery] = useState('');
  const [expandedHistoryClasses, setExpandedHistoryClasses] = useState<Set<string>>(new Set());

  // 수업 맵 생성
  const classMap = useMemo(() => {
    const map = new Map<string, { id: string; name: string; start_time: string; end_time: string }>();
    (classes || []).forEach(c => {
      map.set(c.id, { id: c.id, name: c.name, start_time: c.start_time, end_time: c.end_time });
    });
    return map;
  }, [classes]);

  // 학생 맵 생성
  const studentMap = useMemo(() => {
    const map = new Map<string, string>();
    (students || []).forEach(s => {
      map.set(s.id, s.name);
    });
    return map;
  }, [students]);

  // 로그 필터링
  const filteredLogs = useMemo(() => {
    if (!historySearchQuery) return attendanceLogs;
    return attendanceLogs.filter(log => {
      const studentName = studentMap.get(log.student_id) || '';
      return studentName.toLowerCase().includes(historySearchQuery.toLowerCase());
    });
  }, [attendanceLogs, historySearchQuery, studentMap]);

  // 날짜별 그룹화
  const dailyGroups = useMemo(
    () => groupAttendanceByDate(filteredLogs, classMap, studentMap),
    [filteredLogs, classMap, studentMap]
  );

  const handleToggleClass = useCallback((classKey: string) => {
    setExpandedHistoryClasses(prev => {
      const next = new Set(prev);
      if (next.has(classKey)) {
        next.delete(classKey);
      } else {
        next.add(classKey);
      }
      return next;
    });
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xl)' }}>
      <Card padding="lg">
        <h3 style={{
          fontSize: 'var(--font-size-lg)',
          fontWeight: 'var(--font-weight-semibold)',
          marginBottom: 'var(--spacing-md)',
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--spacing-sm)',
        }}>
          <History size={20} />
          출결기록
        </h3>

        {/* 필터 */}
        <div style={{ display: 'flex', gap: 'var(--spacing-md)', flexWrap: 'wrap', marginBottom: 'var(--spacing-lg)' }}>
          <div style={{ flex: 1, minWidth: '140px', maxWidth: '180px' }}>
            <label style={{
              display: 'block',
              fontSize: 'var(--font-size-sm)',
              fontWeight: 'var(--font-weight-medium)',
              marginBottom: 'var(--spacing-xs)',
            }}>
              시작일
            </label>
            <input
              type="date"
              value={filter.date_from}
              onChange={(e) => onFilterChange({ ...filter, date_from: e.target.value })}
              style={{
                width: '100%',
                padding: 'var(--spacing-sm) var(--spacing-md)',
                border: 'var(--border-width-thin) solid var(--color-border)',
                borderRadius: 'var(--border-radius-md)',
                fontSize: 'var(--font-size-base)',
              }}
            />
          </div>
          <div style={{ flex: 1, minWidth: '140px', maxWidth: '180px' }}>
            <label style={{
              display: 'block',
              fontSize: 'var(--font-size-sm)',
              fontWeight: 'var(--font-weight-medium)',
              marginBottom: 'var(--spacing-xs)',
            }}>
              종료일
            </label>
            <input
              type="date"
              value={filter.date_to}
              onChange={(e) => onFilterChange({ ...filter, date_to: e.target.value })}
              style={{
                width: '100%',
                padding: 'var(--spacing-sm) var(--spacing-md)',
                border: 'var(--border-width-thin) solid var(--color-border)',
                borderRadius: 'var(--border-radius-md)',
                fontSize: 'var(--font-size-base)',
              }}
            />
          </div>
          <div style={{ flex: 1, minWidth: '140px', maxWidth: '200px' }}>
            <label style={{
              display: 'block',
              fontSize: 'var(--font-size-sm)',
              fontWeight: 'var(--font-weight-medium)',
              marginBottom: 'var(--spacing-xs)',
            }}>
              수업
            </label>
            <select
              value={filter.class_id || ''}
              onChange={(e) => onFilterChange({ ...filter, class_id: e.target.value || undefined })}
              style={{
                width: '100%',
                padding: 'var(--spacing-sm) var(--spacing-md)',
                border: 'var(--border-width-thin) solid var(--color-border)',
                borderRadius: 'var(--border-radius-md)',
                fontSize: 'var(--font-size-base)',
              }}
            >
              <option value="">전체 수업</option>
              {(classes || []).map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div style={{ flex: 2, minWidth: '200px' }}>
            <label style={{
              display: 'block',
              fontSize: 'var(--font-size-sm)',
              fontWeight: 'var(--font-weight-medium)',
              marginBottom: 'var(--spacing-xs)',
            }}>
              {terms.PERSON_LABEL_PRIMARY}명 검색
            </label>
            <input
              type="text"
              value={historySearchQuery}
              onChange={(e) => setHistorySearchQuery(e.target.value)}
              placeholder={`${terms.PERSON_LABEL_PRIMARY}명으로 검색...`}
              style={{
                width: '100%',
                padding: 'var(--spacing-sm) var(--spacing-md)',
                border: 'var(--border-width-thin) solid var(--color-border)',
                borderRadius: 'var(--border-radius-md)',
                fontSize: 'var(--font-size-base)',
              }}
            />
          </div>
        </div>

        {/* 범례 */}
        <div style={{
          display: 'flex',
          gap: 'var(--spacing-lg)',
          padding: 'var(--spacing-sm) var(--spacing-md)',
          backgroundColor: 'var(--color-bg-secondary)',
          borderRadius: 'var(--border-radius-md)',
          marginBottom: 'var(--spacing-lg)',
          fontSize: 'var(--font-size-sm)',
          color: 'var(--color-text-secondary)',
          flexWrap: 'wrap',
        }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-2xs)' }}>
            <span style={{ color: 'var(--color-success)' }}>✓</span> {terms.PRESENT_LABEL}
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-2xs)' }}>
            <span style={{ color: 'var(--color-warning)' }}>△</span> {terms.LATE_LABEL}
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-2xs)' }}>
            <span style={{ color: 'var(--color-error)' }}>✗</span> {terms.ABSENCE_LABEL}
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-2xs)' }}>
            <span style={{ color: 'var(--color-info)' }}>○</span> {terms.EXCUSED_LABEL}
          </span>
        </div>

        {/* 출결 기록 - 날짜별 타임라인 뷰 */}
        {isLoadingLogs ? (
          <div style={{ textAlign: 'center', padding: 'var(--spacing-xl)', color: 'var(--color-text-secondary)' }}>
            {terms.MESSAGES.LOADING}
          </div>
        ) : dailyGroups.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {dailyGroups.map((group) => (
              <DailyAttendanceSection
                key={group.date}
                group={group}
                expandedClassIds={expandedHistoryClasses}
                onToggleClass={handleToggleClass}
              />
            ))}
          </div>
        ) : (
          <EmptyState icon={History} message="선택한 기간에 출결 기록이 없습니다." />
        )}
      </Card>
    </div>
  );
}
