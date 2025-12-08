/**
 * LayoutEditor Component
 * 
 * [불변 규칙] 레이아웃 설정 UI
 * [불변 규칙] Tailwind 클래스 직접 사용 금지
 * 
 * 기술문서: docu/스키마에디터.txt 5. 스키마 구조
 */

import { Card, Input, Select } from '@ui-core/react';
import type { LayoutSchema } from '@schema-engine/types';

export interface LayoutEditorProps {
  layout: LayoutSchema | undefined;
  onChange: (layout: LayoutSchema) => void;
}

export function LayoutEditor({ layout, onChange }: LayoutEditorProps) {
  const currentLayout: LayoutSchema = layout || {
    type: 'grid',
    columns: 2,
    columnGap: 'md',
    rowGap: 'md',
  };

  const handleChange = (key: keyof LayoutSchema, value: any) => {
    onChange({ ...currentLayout, [key]: value });
  };

  return (
    <Card padding="md" variant="default">
      <h4 style={{ fontSize: 'var(--font-size-base)', fontWeight: 'var(--font-weight-semibold)', marginBottom: 'var(--spacing-md)' }}>
        레이아웃 설정
      </h4>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
        <div>
          <label style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)', marginBottom: 'var(--spacing-xs)', display: 'block' }}>
            레이아웃 타입
          </label>
          <Select
            value={currentLayout.type || 'grid'}
            onChange={(e) => handleChange('type', e.target.value)}
          >
            <option value="grid">Grid (격자형)</option>
            <option value="section">Section (섹션형)</option>
            <option value="tabs">Tabs (탭형)</option>
            <option value="stepper">Stepper (단계형)</option>
            <option value="drawer">Drawer (서랍형)</option>
            <option value="modal">Modal (팝업형)</option>
            <option value="responsive">Responsive (반응형)</option>
          </Select>
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: 'var(--spacing-xs)', display: 'block' }}>
            폼의 전체 레이아웃 방식을 선택하세요. 대부분의 경우 "Grid (격자형)"을 사용합니다.
          </span>
        </div>

        {currentLayout.type === 'grid' && (
          <>
            <Input
              type="number"
              label="열 수 (columns, 1-12)"
              value={currentLayout.columns || 2}
              onChange={(e) => handleChange('columns', parseInt(e.target.value) || 1)}
              helperText="한 줄에 배치할 필드의 개수입니다. (예: 2 = 한 줄에 2개씩, 3 = 한 줄에 3개씩)"
              min={1}
              max={12}
            />
            <div>
              <label style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)', marginBottom: 'var(--spacing-xs)', display: 'block' }}>
                열 간격 (columnGap)
              </label>
              <Select
                value={currentLayout.columnGap || 'md'}
                onChange={(e) => handleChange('columnGap', e.target.value)}
              >
                <option value="xs">XS (매우 작음)</option>
                <option value="sm">SM (작음)</option>
                <option value="md">MD (보통)</option>
                <option value="lg">LG (큼)</option>
                <option value="xl">XL (매우 큼)</option>
                <option value="2xl">2XL (특히 큼)</option>
                <option value="3xl">3XL (극히 큼)</option>
              </Select>
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: 'var(--spacing-xs)', display: 'block' }}>
                필드 사이의 가로 간격을 설정합니다.
              </span>
            </div>
            <div>
              <label style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)', marginBottom: 'var(--spacing-xs)', display: 'block' }}>
                행 간격 (rowGap)
              </label>
              <Select
                value={currentLayout.rowGap || 'md'}
                onChange={(e) => handleChange('rowGap', e.target.value)}
              >
                <option value="xs">XS (매우 작음)</option>
                <option value="sm">SM (작음)</option>
                <option value="md">MD (보통)</option>
                <option value="lg">LG (큼)</option>
                <option value="xl">XL (매우 큼)</option>
                <option value="2xl">2XL (특히 큼)</option>
                <option value="3xl">3XL (극히 큼)</option>
              </Select>
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: 'var(--spacing-xs)', display: 'block' }}>
                필드 사이의 세로 간격을 설정합니다.
              </span>
            </div>
          </>
        )}
      </div>
    </Card>
  );
}

