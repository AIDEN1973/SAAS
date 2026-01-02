// LAYER: UI_COMPONENT
/**
 * LayerSectionHeader Component
 *
 * 우측 레이어 메뉴 섹션 헤더
 * [불변 규칙] CSS 변수만 사용 (하드코딩 금지)
 */
import React from 'react';

export interface LayerSectionHeaderProps {
  title: React.ReactNode;
  right?: React.ReactNode;
}

export const LayerSectionHeader: React.FC<LayerSectionHeaderProps> = ({
  title,
  right,
}) => {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: right ? 'space-between' : 'flex-start',
        gap: 'var(--spacing-sm)',
        paddingTop: 'var(--spacing-sm)',
        paddingBottom: 'var(--spacing-sm)',
        paddingLeft: 'var(--spacing-form-horizontal-left)',
        paddingRight: 'var(--spacing-form-horizontal-left)',
        marginBottom: 'var(--spacing-xs)',
        minHeight: 'calc(var(--spacing-sm) + var(--size-pagination-button) + var(--spacing-sm))',
        backgroundColor: 'transparent',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--spacing-sm)',
          color: 'var(--color-text)',
          fontSize: 'var(--font-size-lg)',
          fontWeight: 'var(--font-weight-bold)',
        }}
      >
        {title}
      </div>
      {right ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
          {right}
        </div>
      ) : (
        <div style={{ width: 0, height: 'var(--size-pagination-button)', minHeight: 'var(--size-pagination-button)' }} />
      )}
    </div>
  );
};
