/**
 * 매뉴얼 사이드바 컴포넌트
 *
 * 매뉴얼 목차를 표시하고 섹션 네비게이션을 제공합니다.
 * [불변 규칙] 모든 스타일은 design-system 토큰을 사용합니다.
 */

import React from 'react';
import type { ManualPage } from '../types/manual';
import { allManualPages } from '../data/manuals';
import { X } from 'lucide-react';

/** 사이드바 메뉴 아이템 정의 */
interface SidebarMenuItem {
  id: string;
  label: string;
  manualId: string;
}

/** 사이드바 메뉴 목록 (순서대로 표시) */
const SIDEBAR_MENU_ITEMS: SidebarMenuItem[] = [
  { id: 'dashboard', label: '대시보드', manualId: 'dashboard' },
  { id: 'students', label: '학생관리', manualId: 'students' },
  { id: 'attendance', label: '출결관리', manualId: 'attendance' },
  { id: 'notifications', label: '문자발송', manualId: 'notifications' },
  { id: 'analytics', label: '통계분석', manualId: 'analytics' },
  { id: 'ai', label: '인공지능', manualId: 'ai' },
  { id: 'classes', label: '수업관리', manualId: 'classes' },
  { id: 'teachers', label: '강사관리', manualId: 'teachers' },
  { id: 'billing', label: '수납관리', manualId: 'billing' },
  { id: 'automation', label: '자동화 설정', manualId: 'automation' },
  { id: 'alimtalk', label: '알림톡 설정', manualId: 'alimtalk' },
  { id: 'search', label: '검색', manualId: 'search' },
  { id: 'timeline', label: '타임라인', manualId: 'timeline' },
  { id: 'agent', label: '에이전트 모드', manualId: 'agent' },
];

export interface ManualSidebarProps {
  /** 현재 선택된 매뉴얼 페이지 */
  currentManual: ManualPage | null;
  /** 현재 선택된 섹션 ID */
  currentSectionId: string | null;
  /** 매뉴얼 페이지 선택 핸들러 */
  onSelectManual: (manual: ManualPage) => void;
  /** 섹션 선택 핸들러 */
  onSelectSection: (sectionId: string) => void;
  /** 사이드바 닫기 핸들러 */
  onClose: () => void;
}

export function ManualSidebar({
  currentManual,
  currentSectionId: _currentSectionId, // eslint-disable-line @typescript-eslint/no-unused-vars
  onSelectManual,
  onSelectSection: _onSelectSection, // eslint-disable-line @typescript-eslint/no-unused-vars
  onClose,
}: ManualSidebarProps) {
  const handleMenuClick = (item: SidebarMenuItem) => {
    const manual = allManualPages.find((m) => m.id === item.manualId);
    if (manual) {
      onSelectManual(manual);
    }
  };

  return (
    <div
      style={{
        width: 'var(--width-agent-history-sidebar)',
        minWidth: 'var(--width-agent-history-sidebar)',
        height: '100%',
        backgroundColor: 'var(--color-gray-50)',
        borderRight: 'var(--border-width-thin) solid var(--color-gray-200)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* 헤더 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: 'var(--spacing-md) var(--spacing-sm)',
          borderBottom: 'var(--border-width-thin) solid var(--color-gray-200)',
        }}
      >
        {/* 좌측 타이틀 */}
        <span
          style={{
            paddingLeft: 'var(--spacing-md)',
            color: 'var(--color-text)',
            fontSize: 'var(--font-size-xl)',
            fontWeight: 'var(--font-weight-bold)',
          }}
        >
          매뉴얼
        </span>

        {/* 닫기 버튼 */}
        <button
          onClick={onClose}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 'var(--spacing-xs)',
            backgroundColor: 'transparent',
            border: 'none',
            borderRadius: 'var(--border-radius-sm)',
            cursor: 'pointer',
            color: 'var(--color-text-tertiary)',
          }}
          aria-label="매뉴얼 닫기"
        >
          <X size={18} />
        </button>
      </div>

      {/* 메뉴 목록 */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: 'var(--spacing-sm)',
        }}
      >
        {SIDEBAR_MENU_ITEMS.map((item, index) => {
          const isSelected = currentManual?.id === item.manualId;
          const isLastItem = index === SIDEBAR_MENU_ITEMS.length - 1;

          return (
            <div key={item.id}>
              <button
                onClick={() => handleMenuClick(item)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  padding: 'var(--spacing-xs) var(--spacing-md)',
                  cursor: 'pointer',
                  backgroundColor: 'transparent',
                  border: 'none',
                  color: 'var(--color-text)',
                  fontSize: 'var(--font-size-base)',
                  fontWeight: isSelected ? 'var(--font-weight-bold)' : 'var(--font-weight-normal)',
                  textAlign: 'left',
                }}
              >
                {item.label}
              </button>
              {!isLastItem && (
                <div
                  style={{
                    height: 'var(--border-width-thin)',
                    backgroundColor: 'var(--color-gray-200)',
                    margin: 'var(--spacing-xs) var(--spacing-md)',
                  }}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
