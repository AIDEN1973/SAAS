import type { FormSchema } from '@schema-engine/types';

export const tagFormSchema: FormSchema = {
  version: '1.0.0',
  minSupportedClient: '1.0.0',
  entity: 'tag',
  type: 'form',
  form: {
    layout: {
      columns: 2,
      columnGap: 'md',
      rowGap: 'md',
    },
    fields: [
      {
        name: 'name',
        kind: 'custom',
        customComponentType: 'TagNameInput',
        ui: {
          labelKey: 'TAG.FORM.NAME.LABEL',
          label: '태그 이름',
          placeholder: '태그 이름을 쉼표 또는 띄어쓰기로 구분하여 입력하세요',
          colSpan: 2,
        },
        validation: {
          required: true,
          minLength: 1,
          maxLength: 200,
        },
      },
    ],
    submit: {
      label: '저장',
      variant: 'solid',
      color: 'primary',
      size: 'md',
    },
  },
};

