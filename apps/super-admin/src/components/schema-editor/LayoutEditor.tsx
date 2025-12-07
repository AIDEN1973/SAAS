/**
 * LayoutEditor Component
 * 
 * [불�? 규칙] ?�이?�웃 ?�정 UI
 * [불�? 규칙] Tailwind ?�래??직접 ?�용 금�?
 * 
 * 기술문서: docu/?�키마에?�터.txt 5. ?�키�?구조
 */

import { Card, Input, Select } from '@ui-core/react';
import type { LayoutSchema } from '@schema/engine';

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
        ?�이?�웃 ?�정
      </h4>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
        <div>
          <label style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)', marginBottom: 'var(--spacing-xs)', display: 'block' }}>
            ?�이?�웃 ?�??
          </label>
          <Select
            value={currentLayout.type || 'grid'}
            onChange={(e) => handleChange('type', e.target.value)}
          >
            <option value="grid">Grid (격자??</option>
            <option value="section">Section (?�션??</option>
            <option value="tabs">Tabs (??��)</option>
            <option value="stepper">Stepper (?�계??</option>
            <option value="drawer">Drawer (?�랍??</option>
            <option value="modal">Modal (?�업??</option>
            <option value="responsive">Responsive (반응??</option>
          </Select>
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: 'var(--spacing-xs)', display: 'block' }}>
            ?�의 ?�체 ?�이?�웃 방식???�택?�세?? ?�부분의 경우 "Grid (격자??"???�용?�니??
          </span>
        </div>

        {currentLayout.type === 'grid' && (
          <>
            <Input
              type="number"
              label="????(columns, 1-12)"
              value={currentLayout.columns || 2}
              onChange={(e) => handleChange('columns', parseInt(e.target.value) || 1)}
              helperText="??줄에 배치???�드??개수?�니?? (?? 2 = ??줄에 2개씩, 3 = ??줄에 3개씩)"
              min={1}
              max={12}
            />
            <div>
              <label style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)', marginBottom: 'var(--spacing-xs)', display: 'block' }}>
                ??간격 (columnGap)
              </label>
              <Select
                value={currentLayout.columnGap || 'md'}
                onChange={(e) => handleChange('columnGap', e.target.value)}
              >
                <option value="xs">XS (매우 ?�음)</option>
                <option value="sm">SM (?�음)</option>
                <option value="md">MD (보통)</option>
                <option value="lg">LG (??</option>
                <option value="xl">XL (매우 ??</option>
                <option value="2xl">2XL (?�히 ??</option>
                <option value="3xl">3XL (극히 ??</option>
              </Select>
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: 'var(--spacing-xs)', display: 'block' }}>
                ?�드 ?�이??가�?간격???�정?�니??
              </span>
            </div>
            <div>
              <label style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)', marginBottom: 'var(--spacing-xs)', display: 'block' }}>
                ??간격 (rowGap)
              </label>
              <Select
                value={currentLayout.rowGap || 'md'}
                onChange={(e) => handleChange('rowGap', e.target.value)}
              >
                <option value="xs">XS (매우 ?�음)</option>
                <option value="sm">SM (?�음)</option>
                <option value="md">MD (보통)</option>
                <option value="lg">LG (??</option>
                <option value="xl">XL (매우 ??</option>
                <option value="2xl">2XL (?�히 ??</option>
                <option value="3xl">3XL (극히 ??</option>
              </Select>
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: 'var(--spacing-xs)', display: 'block' }}>
                ?�드 ?�이???�로 간격???�정?�니??
              </span>
            </div>
          </>
        )}
      </div>
    </Card>
  );
}

