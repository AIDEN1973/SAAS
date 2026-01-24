/**
 * SettingsSection Component
 *
 * 설정 페이지의 섹션 그룹 컴포넌트
 * [불변 규칙] 모든 스타일은 design-system 토큰을 사용합니다.
 *
 * UI 스타일: 출결관리 페이지 서브타이틀 참고 (DailyAttendanceSection)
 * - 아이콘 + 제목 형식의 섹션 헤더
 * - 테두리로 감싸진 설정 항목 그룹
 */

import React from 'react';
import { Button } from './Button';
import { BookOpen } from 'lucide-react';

export interface SettingsSectionProps {
  /** 섹션 제목 */
  title: string;
  /** 섹션 설명 (선택) - deprecated: 출결관리 스타일에서는 사용하지 않음 */
  description?: string;
  /** 섹션 아이콘 (Lucide React 아이콘) */
  icon?: React.ReactNode;
  /** 섹션 내 설정 항목들 (SettingsRow) */
  children: React.ReactNode;
  /** 우측 상단 액션 버튼 (예: Docs 링크) */
  headerAction?: React.ReactNode;
  /** Docs 링크 URL (headerAction 대신 간편하게 Docs 버튼 표시) */
  docsUrl?: string;
  /** 콘텐츠 영역 테두리 제거 (카드 그리드 레이아웃용) */
  noBorder?: boolean;
  /** 추가 스타일 */
  style?: React.CSSProperties;
}

export const SettingsSection: React.FC<SettingsSectionProps> = ({
  title,
  // description은 deprecated되어 사용하지 않음, 하위 호환성 유지를 위해 props에서만 받음
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  description: _description,
  icon,
  children,
  headerAction,
  docsUrl,
  noBorder = false,
  style,
}) => {
  return (
    <div
      style={{
        marginBottom: 'var(--spacing-3xl)',
        ...style,
      }}
    >
      {/* 섹션 헤더 - 출결관리 페이지 스타일 (아이콘 + 제목) */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 'var(--spacing-md)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
          {/* 아이콘 (출결관리 페이지 스타일: 배경 없음, strokeWidth={1.5}) */}
          {icon && (
            <span style={{ color: 'var(--color-text-primary)', display: 'flex', alignItems: 'center' }}>
              {icon}
            </span>
          )}
          <h3
            style={{
              fontSize: 'var(--font-size-2xl)',
              fontWeight: 'var(--font-weight-extrabold)',
              color: 'var(--color-text-primary)',
              margin: 0,
            }}
          >
            {title}
          </h3>
        </div>

        {/* 우측 액션 (Docs 버튼 또는 커스텀 액션) */}
        {(headerAction || docsUrl) && (
          <div>
            {headerAction ? (
              headerAction
            ) : docsUrl ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open(docsUrl, '_blank')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--spacing-xs)',
                }}
              >
                <BookOpen size={14} strokeWidth={1.5} />
                Docs
              </Button>
            ) : null}
          </div>
        )}
      </div>

      {/* 섹션 콘텐츠 (테두리로 감싸진 영역, noBorder 옵션으로 제거 가능) */}
      <div
        style={{
          border: noBorder ? 'none' : 'var(--border-width-thin) solid var(--color-gray-200)',
          borderRadius: noBorder ? 0 : 'var(--border-radius-xs)',
          overflow: 'hidden',
          backgroundColor: noBorder ? 'transparent' : 'var(--color-white)',
        }}
      >
        {children}
      </div>
    </div>
  );
};
