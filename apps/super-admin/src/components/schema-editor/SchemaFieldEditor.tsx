/**
 * SchemaFieldEditor Component
 * 
 * [ë¶ˆë? ê·œì¹™] ?„ë“œ ì¶”ê?/?˜ì •/?? œ UI
 * [ë¶ˆë? ê·œì¹™] Anti-Pattern ê°•ì œ: Tailwind class, script ?½ì… ê¸ˆì?
 * 
 * ê¸°ìˆ ë¬¸ì„œ: docu/?¤í‚¤ë§ˆì—?”í„°.txt 14. Schema Editor ê¸°ëŠ¥
 */

import { useState } from 'react';
import { Card, Input, Select, Button, useModal } from '@ui-core/react';
import type { FormFieldSchema } from '@schema/engine';

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
    { value: 'text', label: '?ìŠ¤?? },
    { value: 'email', label: '?´ë©”?? },
    { value: 'phone', label: '?„í™”ë²ˆí˜¸' },
    { value: 'number', label: '?«ì' },
    { value: 'password', label: 'ë¹„ë?ë²ˆí˜¸' },
    { value: 'textarea', label: '?ìŠ¤???ì—­' },
    { value: 'select', label: '? íƒë°•ìŠ¤' },
    { value: 'multiselect', label: '?¤ì¤‘ ? íƒ' },
    { value: 'radio', label: '?¼ë””??ë²„íŠ¼' },
    { value: 'checkbox', label: 'ì²´í¬ë°•ìŠ¤' },
    { value: 'date', label: '? ì§œ' },
    { value: 'datetime', label: '? ì§œ/?œê°„' },
    { value: 'custom', label: 'ì»¤ìŠ¤?€ ?„ì ¯' },
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

    // ?„ìˆ˜ ?„ë“œ ê²€ì¦?
    if (!editingField.name.trim()) {
      showAlert('?¤ë¥˜', '?„ë“œ ?´ë¦„?€ ?„ìˆ˜?…ë‹ˆ??', 'error');
      return;
    }

    // Anti-Pattern ê²€ì¦? Tailwind class ê¸ˆì?
    const tailwindPattern = /^(p|m|w|h|text|bg|border|rounded|flex|grid|col|row|gap|space|justify|items|self|place)-/;
    if (editingField.ui?.label && tailwindPattern.test(editingField.ui.label)) {
      showAlert('?¤ë¥˜', 'Tailwind ?´ë˜?¤ë? ì§ì ‘ ?¬ìš©?????†ìŠµ?ˆë‹¤.', 'error');
      return;
    }
    if (editingField.ui?.placeholder && tailwindPattern.test(editingField.ui.placeholder)) {
      showAlert('?¤ë¥˜', 'Tailwind ?´ë˜?¤ë? ì§ì ‘ ?¬ìš©?????†ìŠµ?ˆë‹¤.', 'error');
      return;
    }

    // select/multiselect/radio??options ?„ìˆ˜
    if (['select', 'multiselect', 'radio'].includes(editingField.kind)) {
      if (!editingField.options || editingField.options.length === 0) {
        showAlert('?¤ë¥˜', 'select/multiselect/radio ?„ë“œ??optionsê°€ ?„ìˆ˜?…ë‹ˆ??', 'error');
        return;
      }
    }

    // custom?€ customComponentType ?„ìˆ˜
    if (editingField.kind === 'custom' && !editingField.customComponentType) {
      showAlert('?¤ë¥˜', 'custom ?„ë“œ??customComponentType???„ìˆ˜?…ë‹ˆ??', 'error');
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
          {editingIndex === fields.length ? '?„ë“œ ì¶”ê?' : '?„ë“œ ?˜ì •'}
        </h4>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
          <Input
            label="?„ë“œ ?´ë¦„ (name)"
            value={editingField.name}
            onChange={(e) => setEditingField({ ...editingField, name: e.target.value })}
            helperText="?°ì´?°ë² ?´ìŠ¤???€?¥ë  ?„ë“œ???´ë¦„?…ë‹ˆ?? ?ë¬¸ ?Œë¬¸?ì? ?¸ë”?¤ì½”??_)ë§??¬ìš©?˜ì„¸?? (?? student_name, email_address)"
            required
          />

          <div>
            <label style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)', marginBottom: 'var(--spacing-xs)', display: 'block' }}>
              ?„ë“œ ?€??(kind)
            </label>
            <Select
              value={editingField.kind}
              onChange={(e) => {
                const newKind = e.target.value as FormFieldSchema['kind'];
                const updated: FormFieldSchema = {
                  ...editingField,
                  kind: newKind,
                  // kind ë³€ê²???options ì´ˆê¸°??(?„ìš”??ê²½ìš°)
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
              ?¬ìš©?ê? ?…ë ¥???°ì´?°ì˜ ì¢…ë¥˜ë¥?? íƒ?˜ì„¸?? ?ìŠ¤?? ?«ì, ? ì§œ, ? íƒë°•ìŠ¤ ???¤ì–‘???€?…ì„ ì§€?í•©?ˆë‹¤.
            </span>
          </div>

          <Input
            label="?¼ë²¨ (label)"
            value={editingField.ui?.label || ''}
            onChange={(e) => setEditingField({
              ...editingField,
              ui: { ...editingField.ui, label: e.target.value },
            })}
            helperText="?¬ìš©?ì—ê²?ë³´ì—¬ì§??„ë“œ???´ë¦„?…ë‹ˆ?? (?? '?´ë¦„', '?´ë©”??ì£¼ì†Œ', '?„í™”ë²ˆí˜¸')"
          />

          <Input
            label="?Œë ˆ?´ìŠ¤?€??(placeholder)"
            value={editingField.ui?.placeholder || ''}
            onChange={(e) => setEditingField({
              ...editingField,
              ui: { ...editingField.ui, placeholder: e.target.value },
            })}
            helperText="?…ë ¥ ?„ë“œ ?ˆì— ?œì‹œ???ˆë‚´ ë¬¸êµ¬?…ë‹ˆ?? (?? '?´ë¦„???…ë ¥?˜ì„¸??, '010-1234-5678')"
          />

          <Input
            type="number"
            label="???ˆë¹„ (colSpan, 1-12)"
            value={editingField.ui?.colSpan || 1}
            onChange={(e) => setEditingField({
              ...editingField,
              ui: { ...editingField.ui, colSpan: parseInt(e.target.value) || 1 },
            })}
            helperText="?„ë“œê°€ ì°¨ì????´ì˜ ?ˆë¹„?…ë‹ˆ?? 1-12 ?¬ì´???«ìë¥??…ë ¥?˜ì„¸?? (12 = ?„ì²´ ?ˆë¹„, 6 = ?ˆë°˜ ?ˆë¹„, 4 = 1/3 ?ˆë¹„)"
            min={1}
            max={12}
          />

          {editingField.kind === 'custom' && (
            <Input
              label="ì»¤ìŠ¤?€ ì»´í¬?ŒíŠ¸ ?€??
              value={editingField.customComponentType || ''}
              onChange={(e) => setEditingField({
                ...editingField,
                customComponentType: e.target.value,
              })}
              helperText="?¬ìš©??ì»¤ìŠ¤?€ ?„ì ¯???´ë¦„???…ë ¥?˜ì„¸?? (?? 'RichTextEditor', 'ImageUploader')"
              required
            />
          )}

          {['select', 'multiselect', 'radio'].includes(editingField.kind) && (
            <div>
              <label style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)', marginBottom: 'var(--spacing-xs)', display: 'block' }}>
                ?µì…˜ (options)
              </label>
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginBottom: 'var(--spacing-sm)', display: 'block' }}>
                ?¬ìš©?ê? ? íƒ?????ˆëŠ” ?µì…˜ ëª©ë¡??ì¶”ê??˜ì„¸?? ê°??µì…˜?€ "ê°?ê³?"?¼ë²¨"??ê°€ì§‘ë‹ˆ??
              </span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)' }}>
                {(editingField.options || []).map((opt, idx) => (
                  <div key={idx} style={{ display: 'flex', gap: 'var(--spacing-xs)' }}>
                    <Input
                      placeholder="ê°?(value)"
                      value={opt.value}
                      onChange={(e) => {
                        const newOptions = [...(editingField.options || [])];
                        newOptions[idx] = { ...opt, value: e.target.value };
                        setEditingField({ ...editingField, options: newOptions });
                      }}
                    />
                    <Input
                      placeholder="?¼ë²¨ (label)"
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
                      ?? œ
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
                  ?µì…˜ ì¶”ê?
                </Button>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: 'var(--spacing-sm)', marginTop: 'var(--spacing-md)' }}>
            <Button variant="solid" color="primary" onClick={handleSaveField}>
              ?€??
            </Button>
            <Button variant="outline" onClick={handleCancelEdit}>
              ì·¨ì†Œ
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
          ?„ë“œ ëª©ë¡ ({fields.length})
        </h3>
        <Button variant="solid" color="primary" size="sm" onClick={handleAddField}>
          + ?„ë“œ ì¶”ê?
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
                {field.name || '(?´ë¦„ ?†ìŒ)'} ({field.kind})
              </div>
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                {field.ui?.label || '(?¼ë²¨ ?†ìŒ)'} Â· colSpan: {field.ui?.colSpan || 1}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 'var(--spacing-xs)' }}>
              <Button variant="outline" size="sm" onClick={() => handleEditField(index)}>
                ?˜ì •
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleDeleteField(index)}>
                ?? œ
              </Button>
            </div>
          </Card>
        ))}
        {fields.length === 0 && (
          <p style={{ color: 'var(--color-text-secondary)', textAlign: 'center', padding: 'var(--spacing-md)' }}>
            ?„ë“œê°€ ?†ìŠµ?ˆë‹¤. ?„ë“œë¥?ì¶”ê??˜ì„¸??
          </p>
        )}
      </div>
    </Card>
  );
}

