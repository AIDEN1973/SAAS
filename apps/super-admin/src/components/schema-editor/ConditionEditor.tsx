/**
 * ConditionEditor Component
 * 
 * [불변 규칙] Condition Rule 설정 UI
 * [불변 규칙] condition과 conditions는 동시에 사용 불가
 * 
 * 기술문서: docu/스키마에디터.txt 8. Condition Rule Engine
 */

import { useState } from 'react';
import { Card, Input, Select, Button, Checkbox } from '@ui-core/react';
import type { FormFieldSchema, ConditionRule, MultiConditionRule } from '@schema-engine/types';

export interface ConditionEditorProps {
  field: FormFieldSchema;
  allFields: FormFieldSchema[];
  onChange: (condition: ConditionRule | MultiConditionRule | undefined, conditions: MultiConditionRule | undefined) => void;
}

export function ConditionEditor({ field, allFields, onChange }: ConditionEditorProps) {
  const [useMultiCondition, setUseMultiCondition] = useState(!!field.conditions);
  const [condition, setCondition] = useState<ConditionRule>(field.condition || {
    field: '',
    op: 'eq',
    value: '',
  });
  const [multiCondition, setMultiCondition] = useState<MultiConditionRule>(field.conditions || {
    logic: 'and',
    conditions: [{ field: '', op: 'eq', value: '' }],
  });

  const operators: Array<{ value: ConditionRule['op']; label: string }> = [
    { value: 'eq', label: '같음 (==)' },
    { value: 'ne', label: '다름 (!=)' },
    { value: 'gt', label: '큼 (>)' },
    { value: 'gte', label: '크거나 같음 (>=)' },
    { value: 'lt', label: '작음 (<)' },
    { value: 'lte', label: '작거나 같음 (<=)' },
    { value: 'in', label: '포함 (in)' },
    { value: 'not_in', label: '미포함 (not_in)' },
    { value: 'exists', label: '존재 (exists)' },
    { value: 'not_exists', label: '미존재 (not_exists)' },
  ];

  const handleSingleConditionChange = (key: keyof ConditionRule, value: any) => {
    const updated = { ...condition, [key]: value };
    setCondition(updated);
    onChange(updated, undefined);
  };

  const handleMultiConditionChange = (updates: Partial<MultiConditionRule>) => {
    const updated = { ...multiCondition, ...updates };
    setMultiCondition(updated);
    onChange(undefined, updated);
  };

  const handleAddCondition = () => {
    handleMultiConditionChange({
      conditions: [...multiCondition.conditions, { field: '', op: 'eq', value: '' }],
    });
  };

  const handleRemoveCondition = (index: number) => {
    handleMultiConditionChange({
      conditions: multiCondition.conditions.filter((_, i) => i !== index),
    });
  };

  const handleConditionItemChange = (index: number, key: keyof ConditionRule, value: any) => {
    const newConditions = [...multiCondition.conditions];
    newConditions[index] = { ...newConditions[index], [key]: value };
    handleMultiConditionChange({ conditions: newConditions });
  };

  return (
    <Card padding="md" variant="default">
      <h4 style={{ fontSize: 'var(--font-size-base)', fontWeight: 'var(--font-weight-semibold)', marginBottom: 'var(--spacing-md)' }}>
        조건 규칙 (Condition Rule)
      </h4>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
          <Checkbox
            checked={useMultiCondition}
            onChange={(e) => {
              setUseMultiCondition(e.target.checked);
              if (e.target.checked) {
                onChange(undefined, multiCondition);
              } else {
                onChange(condition, undefined);
              }
            }}
          />
          <label style={{ fontSize: 'var(--font-size-sm)' }}>복수 조건 사용 (AND/OR)</label>
        </div>

        {!useMultiCondition ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
            <Select
              label="참조 필드"
              value={condition.field}
              onChange={(e) => handleSingleConditionChange('field', e.target.value)}
            >
              {allFields
                .filter((f) => f.name !== field.name)
                .map((f) => (
                  <option key={f.name} value={f.name}>
                    {f.name} ({f.kind})
                  </option>
                ))}
            </Select>
            <Select
              label="연산자"
              value={condition.op}
              onChange={(e) => handleSingleConditionChange('op', e.target.value)}
            >
              {operators.map((op) => (
                <option key={op.value} value={op.value}>
                  {op.label}
                </option>
              ))}
            </Select>
            {!['exists', 'not_exists'].includes(condition.op) && (
              <Input
                label="비교 값"
                value={condition.value || ''}
                onChange={(e) => handleSingleConditionChange('value', e.target.value)}
              />
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
            <Select
              label="연산자 (AND/OR)"
              value={multiCondition.logic || 'and'}
              onChange={(e) => handleMultiConditionChange({ logic: e.target.value as 'and' | 'or' })}
            >
              <option value="and">AND (모두 만족)</option>
              <option value="or">OR (하나라도 만족)</option>
            </Select>

            {multiCondition.conditions.map((cond, index) => (
              <Card key={index} padding="sm" variant="outlined">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)' }}>
                      조건 {index + 1}
                    </span>
                    <Button variant="ghost" size="sm" onClick={() => handleRemoveCondition(index)}>
                      삭제
                    </Button>
                  </div>
                  <Select
                    label="참조 필드"
                    value={cond.field}
                    onChange={(e) => handleConditionItemChange(index, 'field', e.target.value)}
                  >
                    {allFields
                      .filter((f) => f.name !== field.name)
                      .map((f) => (
                        <option key={f.name} value={f.name}>
                          {f.name} ({f.kind})
                        </option>
                      ))}
                  </Select>
                  <Select
                    label="연산자"
                    value={cond.op}
                    onChange={(e) => handleConditionItemChange(index, 'op', e.target.value)}
                  >
                    {operators.map((op) => (
                      <option key={op.value} value={op.value}>
                        {op.label}
                      </option>
                    ))}
                  </Select>
                  {!['exists', 'not_exists'].includes(cond.op) && (
                    <Input
                      label="비교 값"
                      value={cond.value || ''}
                      onChange={(e) => handleConditionItemChange(index, 'value', e.target.value)}
                    />
                  )}
                </div>
              </Card>
            ))}

            <Button variant="outline" size="sm" onClick={handleAddCondition}>
              + 조건 추가
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}

