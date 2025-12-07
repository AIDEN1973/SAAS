/**
 * ValidationEditor Component
 * 
 * [ë¶ˆë? ê·œì¹™] ê²€ì¦?ê·œì¹™ ?¤ì • UI
 * [ë¶ˆë? ê·œì¹™] validate ?¨ìˆ˜??Registry???€??ë¶ˆê? (JSONB ?œì•½)
 * 
 * ê¸°ìˆ ë¬¸ì„œ: docu/?¤í‚¤ë§ˆì—?”í„°.txt 9. Validation Rule
 */

import { useState } from 'react';
import { Card, Input, Checkbox } from '@ui-core/react';
import type { FormFieldSchema } from '@schema/engine';

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
        ê²€ì¦?ê·œì¹™
      </h4>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
          <Checkbox
            checked={!!validation?.required}
            onChange={(e) => handleChange('required', e.target.checked ? true : undefined)}
          />
          <div>
            <label style={{ fontSize: 'var(--font-size-sm)' }}>?„ìˆ˜ ?…ë ¥</label>
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginLeft: 'var(--spacing-xs)', display: 'block' }}>
              ì²´í¬?˜ë©´ ?¬ìš©?ê? ë°˜ë“œ???…ë ¥?´ì•¼ ?©ë‹ˆ??
            </span>
          </div>
        </div>

        {['text', 'email', 'phone', 'textarea'].includes(field.kind) && (
          <>
            <Input
              type="number"
              label="ìµœì†Œ ê¸¸ì´ (minLength)"
              value={validation?.minLength || ''}
              onChange={(e) => handleChange('minLength', e.target.value ? parseInt(e.target.value) : undefined)}
              helperText="?…ë ¥?´ì•¼ ?˜ëŠ” ìµœì†Œ ê¸€???˜ì…?ˆë‹¤. (?? 2 = ìµœì†Œ 2ê¸€???´ìƒ)"
              min={0}
            />
            <Input
              type="number"
              label="ìµœë? ê¸¸ì´ (maxLength)"
              value={validation?.maxLength || ''}
              onChange={(e) => handleChange('maxLength', e.target.value ? parseInt(e.target.value) : undefined)}
              helperText="?…ë ¥?????ˆëŠ” ìµœë? ê¸€???˜ì…?ˆë‹¤. (?? 100 = ìµœë? 100ê¸€?ê¹Œì§€)"
              min={0}
            />
            <Input
              label="?•ê·œ???¨í„´ (pattern)"
              value={validation?.pattern?.value || ''}
              onChange={(e) => handleChange('pattern', e.target.value ? { value: e.target.value } : undefined)}
              placeholder="^[0-9]+$"
              helperText="?…ë ¥ ?•ì‹???œí•œ?˜ëŠ” ?•ê·œ???¨í„´?…ë‹ˆ?? (?? ^[0-9]+$ = ?«ìë§??ˆìš©, ^[a-zA-Z]+$ = ?ë¬¸ë§??ˆìš©)"
            />
          </>
        )}

        {field.kind === 'number' && (
          <>
            <Input
              type="number"
              label="ìµœì†Œê°?(min)"
              value={validation?.min || ''}
              onChange={(e) => handleChange('min', e.target.value ? parseFloat(e.target.value) : undefined)}
              helperText="?…ë ¥?????ˆëŠ” ìµœì†Œ ?«ì?…ë‹ˆ?? (?? 0 = 0 ?´ìƒ???«ìë§??ˆìš©)"
            />
            <Input
              type="number"
              label="ìµœë?ê°?(max)"
              value={validation?.max || ''}
              onChange={(e) => handleChange('max', e.target.value ? parseFloat(e.target.value) : undefined)}
              helperText="?…ë ¥?????ˆëŠ” ìµœë? ?«ì?…ë‹ˆ?? (?? 100 = 100 ?´í•˜???«ìë§??ˆìš©)"
            />
          </>
        )}

        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: 'var(--spacing-sm)' }}>
          ? ï¸ validate ?¨ìˆ˜??Schema Registry(JSONB)???€?¥í•  ???†ìœ¼ë¯€ë¡??¬ìš©?????†ìŠµ?ˆë‹¤.
        </div>
      </div>
    </Card>
  );
}

