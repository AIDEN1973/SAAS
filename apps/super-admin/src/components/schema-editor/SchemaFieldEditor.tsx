/**
 * SchemaFieldEditor Component
 *
 * [불변 규칙] 필드 추가/수정/삭제 UI
 * [불변 규칙] Anti-Pattern 강제: Tailwind class, script 삽입 금지
 *
 * 기술문서: docu/스키마에디터.txt 14. Schema Editor 기능
 */

import { useState } from 'react';
import { Card, Input, Select, Button, useModal } from '@ui-core/react';
import type { FormFieldSchema } from '@schema-engine/types';

export interface SchemaFieldEditorProps {
  fields: FormFieldSchema[];
  onChange: (fields: FormFieldSchema[]) => void;
  onFieldSelect?: (index: number | null) => void;
}

export function SchemaFieldEditor({ fields, onChange, onFieldSelect }: SchemaFieldEditorProps) {
  const { showAlert } = useModal();
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingField, setEditingField] = useState<FormFieldSchema | null>(null);

  const fieldKinds: Array<{ value: FormFieldSchema['kind']; label: string }> = [
    { value: 'text', label: '텍스트' },
    { value: 'email', label: '이메일' },
    { value: 'phone', label: '전화번호' },
    { value: 'number', label: '숫자' },
    { value: 'password', label: '비밀번호' },
    { value: 'textarea', label: '텍스트 영역' },
    { value: 'select', label: '선택박스' },
    { value: 'multiselect', label: '다중 선택' },
    { value: 'radio', label: '라디오 버튼' },
    { value: 'checkbox', label: '체크박스' },
    { value: 'date', label: '날짜' },
    { value: 'datetime', label: '날짜/시간' },
    { value: 'custom', label: '커스텀 위젯' },
  ];

  const handleAddField = () => {
    const newField: FormFieldSchema = {
      name: '',
      kind: 'text',
      ui: {
        label: '',
        colSpan: 1,
      },
    };
    setEditingField(newField);
    setEditingIndex(fields.length);
  };

  const handleEditField = (index: number) => {
    setEditingField({ ...fields[index] });
    setEditingIndex(index);
    onFieldSelect?.(index);
  };

  const handleDeleteField = (index: number) => {
    const newFields = fields.filter((_, i) => i !== index);
    onChange(newFields);
  };

  const handleSaveField = () => {
    if (!editingField || editingIndex === null) return;

    // 필수 필드 검증
    if (!editingField.name.trim()) {
      showAlert('오류', '필드 이름은 필수입니다.', 'error');
      return;
    }

    // Anti-Pattern 검증: Tailwind class 금지
    const tailwindPattern = /^(p|m|w|h|text|bg|border|rounded|flex|grid|col|row|gap|space|justify|items|self|place)-/;
    if (editingField.ui?.label && tailwindPattern.test(editingField.ui.label)) {
      showAlert('오류', 'Tailwind 클래스를 직접 사용할 수 없습니다.', 'error');
      return;
    }
    if (editingField.ui?.placeholder && tailwindPattern.test(editingField.ui.placeholder)) {
      showAlert('오류', 'Tailwind 클래스를 직접 사용할 수 없습니다.', 'error');
      return;
    }

    // select/multiselect/radio는 options 필수
    if (['select', 'multiselect', 'radio'].includes(editingField.kind)) {
      if (!editingField.options || editingField.options.length === 0) {
        showAlert('오류', 'select/multiselect/radio 필드는 options가 필수입니다.', 'error');
        return;
      }
    }

    // custom은 customComponentType 필수
    if (editingField.kind === 'custom' && !editingField.customComponentType) {
      showAlert('오류', 'custom 필드는 customComponentType이 필수입니다.', 'error');
      return;
    }

    const newFields = [...fields];
    if (editingIndex === fields.length) {
      newFields.push(editingField);
    } else {
      newFields[editingIndex] = editingField;
    }
    onChange(newFields);
    setEditingField(null);
    setEditingIndex(null);
  };

  const handleCancelEdit = () => {
    setEditingField(null);
    setEditingIndex(null);
    onFieldSelect?.(null);
  };

  if (editingIndex !== null && editingField) {
    return (
      <Card padding="md" variant="default">
        <h4 style={{ fontSize: 'var(--font-size-base)', fontWeight: 'var(--font-weight-semibold)', marginBottom: 'var(--spacing-md)' }}>
          {editingIndex === fields.length ? '필드 추가' : '필드 수정'}
        </h4>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
          <Input
            label="필드 이름 (name)"
            value={editingField.name}
            onChange={(e) => setEditingField({ ...editingField, name: e.target.value })}
            helperText="데이터베이스에 저장될 필드의 이름입니다. 영문 소문자와 언더스코어(_)만 사용하세요. (예: student_name, email_address)"
            required
          />

          <div>
            <label style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)', marginBottom: 'var(--spacing-xs)', display: 'block' }}>
              필드 타입 (kind)
            </label>
            <Select
              value={editingField.kind}
              onChange={(value) => {
                const newKind = String(value) as FormFieldSchema['kind'];
                const updated: FormFieldSchema = {
                  ...editingField,
                  kind: newKind,
                  // kind 변경 시 options 초기화 (필요한 경우)
                  options: ['select', 'multiselect', 'radio'].includes(newKind) ? editingField.options || [] : undefined,
                };
                setEditingField(updated);
              }}
              required
            >
              {fieldKinds.map((k) => (
                <option key={k.value} value={k.value}>
                  {k.label}
                </option>
              ))}
            </Select>
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: 'var(--spacing-xs)', display: 'block' }}>
              사용자가 입력할 데이터의 종류를 선택하세요. 텍스트, 숫자, 날짜, 선택박스 등 다양한 타입을 지원합니다.
            </span>
          </div>

          <Input
            label="라벨 (label)"
            value={editingField.ui?.label || ''}
            onChange={(e) => setEditingField({
              ...editingField,
              ui: { ...editingField.ui, label: e.target.value },
            })}
            helperText="사용자에게 보여질 필드의 이름입니다. (예: '이름', '이메일 주소', '전화번호')"
          />

          <Input
            label="플레이스홀더 (placeholder)"
            value={editingField.ui?.placeholder || ''}
            onChange={(e) => setEditingField({
              ...editingField,
              ui: { ...editingField.ui, placeholder: e.target.value },
            })}
            helperText="입력 필드 안에 표시될 안내 문구입니다. (예: '이름을 입력하세요', '010-1234-5678')"
          />

          <Input
            type="number"
            label="열 너비 (colSpan, 1-12)"
            value={editingField.ui?.colSpan || 1}
            onChange={(e) => setEditingField({
              ...editingField,
              ui: { ...editingField.ui, colSpan: parseInt(e.target.value) || 1 },
            })}
            helperText="필드가 차지할 열의 너비입니다. 1-12 사이의 숫자를 입력하세요. (12 = 전체 너비, 6 = 절반 너비, 4 = 1/3 너비)"
            min={1}
            max={12}
          />

          {editingField.kind === 'custom' && (
            <Input
              label="커스텀 컴포넌트 타입"
              value={editingField.customComponentType || ''}
              onChange={(e) => setEditingField({
                ...editingField,
                customComponentType: e.target.value,
              })}
              helperText="사용할 커스텀 위젯의 이름을 입력하세요. (예: 'RichTextEditor', 'ImageUploader')"
              required
            />
          )}

          {['select', 'multiselect', 'radio'].includes(editingField.kind) && (
            <div>
              <label style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)', marginBottom: 'var(--spacing-xs)', display: 'block' }}>
                옵션 (options)
              </label>
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginBottom: 'var(--spacing-sm)', display: 'block' }}>
                사용자가 선택할 수 있는 옵션 목록을 추가하세요. 각 옵션은 "값"과 "라벨"을 가집니다.
              </span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)' }}>
                {(editingField.options || []).map((opt, idx) => (
                  <div key={idx} style={{ display: 'flex', gap: 'var(--spacing-xs)' }}>
                    <Input
                      placeholder="값 (value)"
                      value={opt.value}
                      onChange={(e) => {
                        const newOptions = [...(editingField.options || [])];
                        newOptions[idx] = { ...opt, value: e.target.value };
                        setEditingField({ ...editingField, options: newOptions });
                      }}
                    />
                    <Input
                      placeholder="라벨 (label)"
                      value={opt.label || ''}
                      onChange={(e) => {
                        const newOptions = [...(editingField.options || [])];
                        newOptions[idx] = { ...opt, label: e.target.value };
                        setEditingField({ ...editingField, options: newOptions });
                      }}
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        const newOptions = editingField.options?.filter((_, i) => i !== idx) || [];
                        setEditingField({ ...editingField, options: newOptions });
                      }}
                    >
                      삭제
                    </Button>
                  </div>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setEditingField({
                      ...editingField,
                      options: [...(editingField.options || []), { value: '', label: '' }],
                    });
                  }}
                >
                  옵션 추가
                </Button>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: 'var(--spacing-sm)', marginTop: 'var(--spacing-md)' }}>
            <Button variant="solid" color="primary" onClick={handleSaveField}>
              저장
            </Button>
            <Button variant="outline" onClick={handleCancelEdit}>
              취소
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card padding="md" variant="default">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-md)' }}>
        <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-semibold)' }}>
          필드 목록 ({fields.length})
        </h3>
        <Button variant="solid" color="primary" size="sm" onClick={handleAddField}>
          + 필드 추가
        </Button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)' }}>
        {fields.map((field, index) => (
          <Card
            key={index}
            padding="sm"
            variant="outlined"
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
          >
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)' }}>
                {field.name || '(이름 없음)'} ({field.kind})
              </div>
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                {field.ui?.label || '(라벨 없음)'} · colSpan: {field.ui?.colSpan || 1}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 'var(--spacing-xs)' }}>
              <Button variant="outline" size="sm" onClick={() => handleEditField(index)}>
                수정
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleDeleteField(index)}>
                삭제
              </Button>
            </div>
          </Card>
        ))}
        {fields.length === 0 && (
          <p style={{ color: 'var(--color-text-secondary)', textAlign: 'center', padding: 'var(--spacing-md)' }}>
            필드가 없습니다. 필드를 추가하세요.
          </p>
        )}
      </div>
    </Card>
  );
}

