/**
 * ValidationEditor Component
 * 
 * [불변 규칙] 검증 규칙 설정 UI
 * [불변 규칙] validate 함수는 Registry에 저장 불가 (JSONB 제약)
 * 
 * 기술문서: docu/스키마에디터.txt 9. Validation Rule
 */

import { useState } from 'react';
import { Card, Input, Checkbox } from '@ui-core/react';
import type { FormFieldSchema } from '@schema-engine';

export interface ValidationEditorProps {
  field: FormFieldSchema;
  onChange: (validation: FormFieldSchema['validation']) => void;
}

export function ValidationEditor({ field, onChange }: ValidationEditorProps) {
  const [validation, setValidation] = useState<FormFieldSchema['validation']>(field.validation || {});

  const handleChange = (key: keyof NonNullable<FormFieldSchema['validation']>, value: any) => {
    const updated = { ...validation, [key]: value };
    setValidation(updated);
    onChange(updated);
  };


  return (
    <Card padding="md" variant="default">
      <h4 style={{ fontSize: 'var(--font-size-base)', fontWeight: 'var(--font-weight-semibold)', marginBottom: 'var(--spacing-md)' }}>
        검증 규칙
      </h4>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
          <Checkbox
            checked={!!validation?.required}
            onChange={(e) => handleChange('required', e.target.checked ? true : undefined)}
          />
          <div>
            <label style={{ fontSize: 'var(--font-size-sm)' }}>필수 입력</label>
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginLeft: 'var(--spacing-xs)', display: 'block' }}>
              체크하면 사용자가 반드시 입력해야 합니다.
            </span>
          </div>
        </div>

        {['text', 'email', 'phone', 'textarea'].includes(field.kind) && (
          <>
            <Input
              type="number"
              label="최소 길이 (minLength)"
              value={validation?.minLength || ''}
              onChange={(e) => handleChange('minLength', e.target.value ? parseInt(e.target.value) : undefined)}
              helperText="입력해야 하는 최소 글자 수입니다. (예: 2 = 최소 2글자 이상)"
              min={0}
            />
            <Input
              type="number"
              label="최대 길이 (maxLength)"
              value={validation?.maxLength || ''}
              onChange={(e) => handleChange('maxLength', e.target.value ? parseInt(e.target.value) : undefined)}
              helperText="입력할 수 있는 최대 글자 수입니다. (예: 100 = 최대 100글자까지)"
              min={0}
            />
            <Input
              label="정규식 패턴 (pattern)"
              value={validation?.pattern?.value || ''}
              onChange={(e) => handleChange('pattern', e.target.value ? { value: e.target.value } : undefined)}
              placeholder="^[0-9]+$"
              helperText="입력 형식을 제한하는 정규식 패턴입니다. (예: ^[0-9]+$ = 숫자만 허용, ^[a-zA-Z]+$ = 영문만 허용)"
            />
          </>
        )}

        {field.kind === 'number' && (
          <>
            <Input
              type="number"
              label="최소값 (min)"
              value={validation?.min || ''}
              onChange={(e) => handleChange('min', e.target.value ? parseFloat(e.target.value) : undefined)}
              helperText="입력할 수 있는 최소 숫자입니다. (예: 0 = 0 이상의 숫자만 허용)"
            />
            <Input
              type="number"
              label="최대값 (max)"
              value={validation?.max || ''}
              onChange={(e) => handleChange('max', e.target.value ? parseFloat(e.target.value) : undefined)}
              helperText="입력할 수 있는 최대 숫자입니다. (예: 100 = 100 이하의 숫자만 허용)"
            />
          </>
        )}

        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: 'var(--spacing-sm)' }}>
          ⚠️ validate 함수는 Schema Registry(JSONB)에 저장할 수 없으므로 사용할 수 없습니다.
        </div>
      </div>
    </Card>
  );
}

