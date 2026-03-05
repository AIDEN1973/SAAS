/**
 * SchemaField Component
 *
 * [불변 규칙] React Hook Form과 통합된 Schema Field Renderer
 * [불변 규칙] Condition Rule 기반 동적 UI 렌더링
 * [불변 규칙] Tailwind 클래스 문자열을 직접 사용하지 않고, ui-core 컴포넌트만 사용
 *
 * 기술문서: docu/스키마엔진.txt 8. Renderer 통합
 */

import React from 'react';
import {
  useWatch,
  Controller,
  UseFormRegister,
  Control,
  FieldErrors,
  UseFormSetValue,
} from 'react-hook-form';
import type { RegisterOptions } from 'react-hook-form';
import { getConditionalActions } from '../core/conditionEvaluator';
import { buildValidationRules } from '../core/validation';
import { formatKoreanPhoneNumber } from '../core/formatKoreanPhoneNumber';
import type { FormFieldSchema } from '../types';
import { loadWidget } from '../widgets/registry';
import {
  Input,
  NumberInput,
  TimeInput,
  Select,
  Checkbox,
  DatePicker,
  FormFieldLayout,
  FormField,
  Textarea,
  Radio,
  Card,
  Button,
  AddressInput,
  DateInput,
} from '@ui-core/react';
// ⚠️ 참고: Input 컴포넌트는 TextInput의 역할을 수행합니다.
// 기술문서에서는 TextInput으로 명시되어 있으나, 실제 구현은 Input 컴포넌트를 사용합니다.

/**
 * Controller의 rules prop에 호환되는 타입
 * Controller.rules = Omit<RegisterOptions, 'valueAsNumber' | 'valueAsDate' | 'setValueAs' | 'disabled'>
 */
type ControllerRules = Omit<RegisterOptions<Record<string, unknown>, string>, 'valueAsNumber' | 'valueAsDate' | 'setValueAs' | 'disabled'>;

/**
 * FormFieldSchema.ui에 rows 속성을 포함하는 확장 타입
 * textarea kind에서 행 수 설정을 위해 사용
 */
type TextareaUIConfig = FormFieldSchema['ui'] & { rows?: number };

/**
 * FormFieldSchema.options의 개별 항목 타입 (disabled/divider 포함)
 * schema types에 이미 disabled/divider가 정의되어 있으므로, 직접 참조
 */
type SchemaOptionItem = NonNullable<FormFieldSchema['options']>[number];

/**
 * 캐릭터 목록 - Supabase Storage
 * [업종중립] 프로필 캐릭터 선택 기능
 */
const STORAGE_BASE_URL = 'https://xawypsrotrfoyozhrsbb.supabase.co/storage/v1/object/public/avatars';

const MALE_CHARACTERS = [
  { id: 'man_1', name: '남성 캐릭터 1', url: `${STORAGE_BASE_URL}/male/man_1.jpg`, gender: 'male' },
  { id: 'man_2', name: '남성 캐릭터 2', url: `${STORAGE_BASE_URL}/male/man_2.jpg`, gender: 'male' },
  { id: 'man_3', name: '남성 캐릭터 3', url: `${STORAGE_BASE_URL}/male/man_3.jpg`, gender: 'male' },
  { id: 'man_4', name: '남성 캐릭터 4', url: `${STORAGE_BASE_URL}/male/man_4.jpg`, gender: 'male' },
  { id: 'man_5', name: '남성 캐릭터 5', url: `${STORAGE_BASE_URL}/male/man_5.jpg`, gender: 'male' },
  { id: 'man_6', name: '남성 캐릭터 6', url: `${STORAGE_BASE_URL}/male/man_6.jpg`, gender: 'male' },
  { id: 'man_7', name: '남성 캐릭터 7', url: `${STORAGE_BASE_URL}/male/man_7.jpg`, gender: 'male' },
];

const FEMALE_CHARACTERS: typeof MALE_CHARACTERS = [];

/**
 * ProfileImageButtonGroup Component
 *
 * [업종중립] 프로필 이미지 선택 버튼 그룹 (캐릭터 선택 + 사진 선택)
 * [불변 규칙] CSS 변수 사용
 */
interface ProfileImageButtonGroupProps {
  isDisabled: boolean;
  setFormValue?: UseFormSetValue<Record<string, unknown>>;
  gender?: 'male' | 'female';
}

const ProfileImageButtonGroup: React.FC<ProfileImageButtonGroupProps> = ({
  isDisabled,
  setFormValue,
  gender = 'male',
}) => {
  const [showCharacterMenu, setShowCharacterMenu] = React.useState(false);
  const menuRef = React.useRef<HTMLDivElement>(null);

  // gender에 따라 캐릭터 목록 필터링
  const availableCharacters = gender === 'male' ? MALE_CHARACTERS : FEMALE_CHARACTERS;

  // 외부 클릭 시 메뉴 닫기
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowCharacterMenu(false);
      }
    };

    if (showCharacterMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showCharacterMenu]);

  // 캐릭터 선택 핸들러
  const handleCharacterSelect = (character: typeof MALE_CHARACTERS[0]) => {
    if (setFormValue) {
      // profile_image_url 필드에 캐릭터 URL 설정
      setFormValue('profile_image_url', character.url, {
        shouldValidate: true,
        shouldDirty: true,
      });
      // profile_image 필드에도 캐릭터 URL 설정 (좌측 프로필 이미지 즉시 반영)
      setFormValue('profile_image', character.url, {
        shouldValidate: true,
        shouldDirty: true,
      });
    }
    setShowCharacterMenu(false);
  };

  // 사진 선택 핸들러
  const handlePhotoSelect = () => {
    const fileInput = document.querySelector(
      'input[data-field-name="profile_image"][type="file"]'
    ) as HTMLInputElement;
    if (fileInput) {
      fileInput.click();
    } else {
      console.error('Profile image file input not found');
    }
  };

  return (
    <div
      ref={menuRef}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--spacing-xs)',
        position: 'relative',
      }}
    >
      {/* 버튼 그룹 */}
      <div
        style={{
          display: 'flex',
          gap: 'var(--spacing-xs)',
          marginTop: '-1px',
        }}
      >
        {/* 캐릭터 선택 버튼 */}
        <Button
          type="button"
          variant="outline"
          color="secondary"
          size="sm"
          onClick={() => setShowCharacterMenu(!showCharacterMenu)}
          disabled={isDisabled}
          style={{
            flex: 1,
            height: 'var(--height-control-sm)',
          }}
        >
          캐릭터 선택
        </Button>

        {/* 사진 선택 버튼 */}
        <Button
          type="button"
          variant="solid"
          color="primary"
          size="sm"
          onClick={handlePhotoSelect}
          disabled={isDisabled}
          style={{
            flex: 1,
            height: 'var(--height-control-sm)',
          }}
        >
          사진 선택
        </Button>
      </div>

      {/* 캐릭터 선택 레이어 메뉴 */}
      {showCharacterMenu && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            marginTop: 'var(--spacing-xs)',
            padding: 'var(--spacing-sm)',
            backgroundColor: 'var(--color-background)',
            border: 'var(--border-width-thin) solid var(--color-gray-200)',
            borderRadius: 'var(--border-radius-sm)',
            boxShadow: 'var(--shadow-lg)',
            zIndex: 100,
          }}
        >
          <div
            style={{
              marginBottom: 'var(--spacing-xs)',
              fontSize: 'var(--font-size-sm)',
              fontWeight: 'var(--font-weight-medium)',
              color: 'var(--color-text-secondary)',
            }}
          >
            {gender === 'male' ? '남성' : '여성'} 캐릭터를 선택하세요
          </div>

          {/* 캐릭터 그리드 */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 'var(--spacing-xs)',
            }}
          >
            {availableCharacters.length === 0 ? (
              <div
                style={{
                  gridColumn: '1 / -1',
                  padding: 'var(--spacing-md)',
                  textAlign: 'center',
                  color: 'var(--color-text-tertiary)',
                  fontSize: 'var(--font-size-sm)',
                }}
              >
                등록된 캐릭터가 없습니다.
              </div>
            ) : (
              availableCharacters.map((character) => (
              <div
                key={character.id}
                onClick={() => handleCharacterSelect(character)}
                style={{
                  aspectRatio: '1',
                  borderRadius: 'var(--border-radius-sm)',
                  backgroundColor: 'var(--color-background-secondary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  overflow: 'hidden',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--color-gray-100)';
                  e.currentTarget.style.transform = 'scale(1.05)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--color-background-secondary)';
                  e.currentTarget.style.transform = 'scale(1)';
                }}
              >
                {/* 캐릭터 이미지 */}
                <img
                  src={character.url}
                  alt={character.name}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                  }}
                />
              </div>
              ))
            )}
          </div>

          {/* 안내 메시지 */}
          <div
            style={{
              marginTop: 'var(--spacing-sm)',
              fontSize: 'var(--font-size-xs)',
              color: 'var(--color-text-tertiary)',
              textAlign: 'center',
            }}
          >
            캐릭터는 향후 추가 예정입니다
          </div>
        </div>
      )}
    </div>
  );
};

export interface SchemaFieldProps {
  field: FormFieldSchema;
  register: UseFormRegister<Record<string, unknown>>;
  errors: FieldErrors<Record<string, unknown>>;
  control: Control<Record<string, unknown>>;
  // SDUI v1.1: i18n 번역 (선택적, Loader 단계에서 바인딩되지 않은 경우 사용)
  translations?: Record<string, string>;
  // SDUI v1.1: 동적 필드 값 설정 (setValue 액션용)
  setValue?: UseFormSetValue<Record<string, unknown>>;
  /**
   * SDUI v1.1: API 클라이언트 주입(선택)
   * - schema-engine은 특정 SDK를 직접 import하지 않습니다.
   * - 앱에서 `@api-sdk/core`의 `apiClient`를 주입하는 방식으로 사용합니다.
   */
  apiClient?: { get: (table: string, options?: any) => Promise<any> };
  // Grid의 실제 컬럼 수 (반응형 처리용)
  gridColumns?: number;
  /**
   * 값이 있을 때 인라인 라벨(placeholder를 좌측 라벨로) 표시 여부
   * - 기본값 true: 수정폼 UX 유지
   * - 필터/검색 UI에서는 false로 전달하여 placeholder가 값 입력 시 제거되도록 함
   */
  showInlineLabelWhenHasValue?: boolean;
  /**
   * 폼 컨트롤 사이즈 (xs, sm, md, lg, xl)
   * - 기본값: 'sm' (SchemaTable 필터 UI와 일관성 유지)
   */
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
}

/**
 * SchemaField 컴포넌트
 *
 * FormFieldSchema를 React Hook Form과 통합하여 렌더링합니다.
 * Condition Rule을 지원하여 동적으로 hidden/disabled/required 상태를 제어합니다.
 *
 * ⚠️ 성능 최적화: React.memo로 감싸서 불필요한 리렌더링을 방지합니다.
 * useWatch는 감시 필드가 변하면 해당 SchemaField 컴포넌트가 리렌더되므로,
 * 필드가 100개 이상이면 성능 문제가 발생할 수 있습니다.
 */
const SchemaFieldComponent: React.FC<SchemaFieldProps> = ({
  field,
  register,
  errors,
  control,
  translations = {},
  setValue: setFormValue,
  apiClient,
  gridColumns,
  showInlineLabelWhenHasValue = true,
  size = 'sm',
}) => {
  const { name, kind, ui, options } = field;

  // SDUI v1.1: i18n 키 처리 (Loader 단계에서 바인딩되지 않은 경우)
  // labelKey가 있으면 translations에서 조회, 번역이 없으면 label을 fallback으로 사용
  const label = ui?.labelKey
    ? (translations[ui.labelKey] || ui.label || ui.labelKey)
    : ui?.label;
  const placeholder = ui?.placeholderKey
    ? (translations[ui.placeholderKey] || ui.placeholder || ui.placeholderKey)
    : ui?.placeholder;
  // const description = ui?.descriptionKey ? (translations[ui.descriptionKey] || ui.descriptionKey) : ui?.description; // [Deferred] 향후 사용 예정

  // 1) 조건부 필드 감시
  // 단일 조건 또는 복수 조건에서 참조하는 모든 필드를 감시
  const fieldsToWatch = React.useMemo(() => {
    const fields = new Set<string>();
    if (field.condition) {
      fields.add(field.condition.field);
    }
    if (field.conditions) {
      field.conditions.conditions.forEach((rule) => {
        fields.add(rule.field);
      });
    }
    return Array.from(fields);
  }, [field.condition, field.conditions]);

  // 모든 참조 필드 값 관찰
  // ⚠️ 최적화: 조건이 없는 필드는 useWatch를 호출하지 않음
  // fieldsToWatch.length === 0이면 name: []로 전달하여 폼 전체 구독 방지
  const hasConditions = fieldsToWatch.length > 0;

  const watched = useWatch({
    control,
    name: hasConditions ? fieldsToWatch : [],  // 조건이 없으면 빈 배열로 전달 (폼 전체 구독 방지)
  });

  const watchedValues = React.useMemo(() => {
    if (!hasConditions) return {} as Record<string, unknown>;
    // watched가 배열인 경우 필드명과 매핑
    if (Array.isArray(watched)) {
      return fieldsToWatch.reduce((acc, key, idx) => {
        acc[key] = watched[idx];
        return acc;
      }, {} as Record<string, unknown>);
    }
    // watched가 객체인 경우 (단일 필드)
    return watched as Record<string, unknown>;
  }, [watched, hasConditions, fieldsToWatch]);

  // 2) 조건 평가
  // ⚠️ 중요: getConditionalActions는 field.conditions를 우선 처리하고, 없으면 field.condition을 처리합니다.
  // 따라서 항상 호출해야 하며, field.condition만 체크하면 안 됩니다.
  const conditionalResult = getConditionalActions(field, watchedValues);
  const { isHidden, isRequired, actions: conditionalActions } = conditionalResult;
  // readOnly 필드는 항상 disabled 처리
  const isDisabled = conditionalResult.isDisabled || field.ui?.readOnly === true;

  // SDUI v1.1: 동적 옵션 처리 (setOptions 액션)
  // ⚠️ 중요: dynamicOptions는 API 기반 옵션만 저장하며, 초기값은 undefined입니다.
  // static 옵션은 effectiveOptions에서 직접 사용합니다.
  const [dynamicOptions, setDynamicOptions] = React.useState<Array<{ value: string; labelKey?: string; label?: string }> | undefined>(undefined);

  // effectiveOptions: conditionalActions.setOptions가 있으면 우선, 없으면 field.options
  const effectiveOptions = React.useMemo(() => {
    if (conditionalActions && conditionalActions.setOptions) {
      if (conditionalActions.setOptions.type === 'static' && conditionalActions.setOptions.options) {
        return conditionalActions.setOptions.options;
      }
      // API 기반 옵션은 dynamicOptions 상태로 관리
      if (conditionalActions.setOptions.type === 'api' && dynamicOptions) {
        return dynamicOptions;
      }
    }
    return options;
  }, [conditionalActions?.setOptions, dynamicOptions, options]);

  // SDUI v1.1: setOptions API 호출 처리
  // ⚠️ 중요: 의존성 배열은 endpoint와 type만 추출하여 안정적으로 관리
  const setOptionsConfig = conditionalActions?.setOptions;
  const setOptionsEndpoint = setOptionsConfig?.type === 'api' ? setOptionsConfig.endpoint : undefined;
  const setOptionsType = setOptionsConfig?.type;

  React.useEffect(() => {
    if (setOptionsType === 'api' && setOptionsEndpoint) {
      const endpoint = setOptionsEndpoint; // 타입 가드: 이 시점에서 endpoint는 string
      let mounted = true;
      async function loadOptions() {
        try {
          // ⚠️ 중요: schema-engine은 SDK를 직접 import하지 않고, 앱에서 apiClient를 주입받아 사용합니다.
          if (!apiClient) {
            throw new Error('apiClient is required for setOptions.type="api"');
          }
          const res = await apiClient.get(endpoint);
          const result = res as { data?: unknown[] } | unknown[];
          const data = (result && typeof result === 'object' && 'data' in result) ? (result as { data?: unknown[] }).data ?? result : (Array.isArray(result) ? result : []);

          if (mounted && Array.isArray(data)) {
            setDynamicOptions(
              (data as Array<Record<string, unknown>>).map((item: Record<string, unknown>) => ({
                value: typeof (item.value ?? item.id) === 'string' ? (item.value ?? item.id) as string : String(item),
                label: typeof (item.label ?? item.name) === 'string' ? (item.label ?? item.name) as string : String(item),
                labelKey: typeof item.labelKey === 'string' ? item.labelKey : undefined,
              })),
            );
          }
        } catch (error) {
          // ⚠️ 중요: apiClient가 없으면 옵션 로드 실패 (Zero-Trust 원칙)
          console.error(`[Schema Engine] Failed to load options from API: ${endpoint}. apiClient not available.`, error);
          // 옵션은 기존 field.options 유지 (dynamicOptions는 undefined로 유지)
        }
      }
      loadOptions();
      return () => {
        mounted = false;
      };
    } else {
      // setOptions가 없거나 static 타입이면 dynamicOptions 초기화
      setDynamicOptions(undefined);
    }
  }, [setOptionsEndpoint, setOptionsType]);

  // SDUI v1.1: setValue 액션 처리
  React.useEffect(() => {
    if (conditionalActions?.setValue !== undefined && setFormValue) {
      setFormValue(name, conditionalActions.setValue, {
        shouldValidate: false,
        shouldDirty: false,
      });
    }
  }, [conditionalActions?.setValue, name, setFormValue]);

  // SDUI v1.1: switchComponent 처리
  const effectiveComponentType = conditionalActions?.switchComponent?.to || field.customComponentType;

  if (isHidden) return null;

  // 3) Validation rule 동적 적용
  // ⚠️ 중요: 동적 required는 정적 required보다 우선합니다.
  // BaseRules에 이미 required 옵션이 있어도, Condition Rule에 의한 동적 required가 덮어씁니다.
  const baseRules = buildValidationRules(field);
  const finalRules: ControllerRules = isRequired
    ? { ...baseRules, required: '필수 입력 항목입니다.' }
    : baseRules;

  const error = errors[name]?.message;

  // ⚠️ 중요: Tailwind 클래스를 직접 사용하지 않고, props 기반으로 core-ui에 전달
  // 스키마는 논리적 구조만 정의하고, 스타일은 core-ui가 담당합니다.
  // 기술문서 UI 문서 2.3 "schema-engine ↔ core-ui 통신 방식" 참조
  // Renderer는 layout의 구조적 전달만 수행하고 스타일을 직접 다루지 않아야 합니다.
  // 반응형 처리: Grid의 실제 컬럼 수보다 큰 colSpan은 Grid 컬럼 수로 제한
  const baseColSpan = ui?.colSpan ?? 12;
  const colSpan = gridColumns && baseColSpan > gridColumns ? gridColumns : baseColSpan;
  const rowSpan = ui?.rowSpan;

  // 🍀 4) 각 필드 렌더링에 isDisabled 적용

  // address → AddressInput 사용 (카카오 우편번호 서비스 통합)
  if (kind === 'address') {
    return (
      <FormFieldLayout colSpan={colSpan}>
        <Controller
          name={name}
          control={control}
          rules={finalRules}
          render={({ field: f }) => (
            <AddressInput
              value={(f.value ?? '') as string}
              onChange={(value) => f.onChange(value)}
              onBlur={f.onBlur}
              placeholder={placeholder}
              disabled={isDisabled}
            />
          )}
        />
      </FormFieldLayout>
    );
  }

  // text/email/phone/password → Controller 사용 (reset 후 값 반영을 위해)
  if (['text', 'email', 'phone', 'password'].includes(kind)) {
    const inputType =
      kind === 'email'
        ? 'email'
        : kind === 'phone'
        ? 'tel'
        : kind === 'password'
        ? 'password'
        : 'text';
    return (
      <FormFieldLayout colSpan={colSpan}>
        <Controller
          name={name}
          control={control}
          rules={finalRules}
          render={({ field: f }) => (
            <Input
              type={inputType}
              label={placeholder ? undefined : label}
              placeholder={placeholder}
              error={error}
              disabled={isDisabled}
              fullWidth
              size={size}
              showInlineLabelWhenHasValue={showInlineLabelWhenHasValue}
              value={(f.value ?? '') as string}
              autoComplete={kind === 'password' ? 'new-password' : undefined}
              onChange={(e) => {
                if (import.meta.env?.DEV) {
                  const nativeIsComposing = (e.nativeEvent as InputEvent)?.isComposing;
                  console.log('[IME][SchemaField->Input] change', {
                    field: name,
                    kind,
                    nativeIsComposing,
                    targetValue: e.target.value,
                    prevFormValue: f.value,
                  });
                }
                if (kind === 'phone') {
                  const formatted = formatKoreanPhoneNumber(e.target.value);
                  f.onChange(formatted);
                  return;
                }
                f.onChange(e);
              }}
              onBlur={f.onBlur}
              name={f.name}
              ref={f.ref}
            />
          )}
        />
      </FormFieldLayout>
    );
  }

  // number → NumberInput 사용 (단위 표시 지원)
  if (kind === 'number') {
    // UI에서 unit 속성 확인
    const unit = ui?.unit;

    return (
      <FormFieldLayout colSpan={colSpan}>
        <Controller
          name={name}
          control={control}
          rules={finalRules}
          render={({ field: f }) => (
            <NumberInput
              label={placeholder ? undefined : label}
              placeholder={placeholder}
              error={error}
              disabled={isDisabled}
              fullWidth
              size={size}
              showInlineLabelWhenHasValue={showInlineLabelWhenHasValue}
              unit={unit}
              value={(f.value ?? '') as string}
              onChange={f.onChange}
              onBlur={f.onBlur}
              name={f.name}
              ref={f.ref}
            />
          )}
        />
      </FormFieldLayout>
    );
  }

  // time → TimeInput 사용 (시계 아이콘 + 드롭다운)
  if (kind === 'time') {
    return (
      <FormFieldLayout colSpan={colSpan}>
        <Controller
          name={name}
          control={control}
          rules={finalRules}
          render={({ field: f }) => (
            <TimeInput
              label={placeholder ? undefined : label}
              placeholder={placeholder}
              error={error}
              disabled={isDisabled}
              fullWidth
              size={size}
              showInlineLabelWhenHasValue={showInlineLabelWhenHasValue}
              value={(f.value ?? '') as string}
              onChange={f.onChange}
              onBlur={f.onBlur}
              name={f.name}
              ref={f.ref}
            />
          )}
        />
      </FormFieldLayout>
    );
  }

  // textarea → Controller 사용 (reset 후 값 반영을 위해)
  if (kind === 'textarea') {
    return (
      <FormFieldLayout colSpan={colSpan}>
        <Controller
          name={name}
          control={control}
          rules={finalRules}
          render={({ field: f }) => (
            <Textarea
              label={placeholder ? undefined : label}
              placeholder={placeholder}
              error={error}
              disabled={isDisabled}
              fullWidth
              rows={(ui as TextareaUIConfig)?.rows} // ui.rows 속성 지원 (textarea 행 수 설정)
              value={(f.value ?? '') as string}
              onChange={(e) => {
                if (import.meta.env?.DEV) {
                  const nativeIsComposing = (e.nativeEvent as InputEvent)?.isComposing;
                  console.log('[IME][SchemaField->Textarea] change', {
                    field: name,
                    kind,
                    nativeIsComposing,
                    targetValue: e.target.value,
                    prevFormValue: f.value,
                  });
                }
                f.onChange(e);
              }}
              onBlur={f.onBlur}
              name={f.name}
              ref={f.ref}
            />
          )}
        />
      </FormFieldLayout>
    );
  }

  // select / multiselect → Controller
  if (kind === 'select' || kind === 'multiselect') {
    // options prop 방식으로 변환 (divider 속성 지원)
    const selectOptions = effectiveOptions?.map((opt) => {
      // labelKey가 있으면 translations에서 조회, 번역이 없으면 label을 fallback으로 사용
      const translatedLabel = opt.labelKey
        ? (translations[opt.labelKey] || opt.label || opt.labelKey)
        : (opt.label || opt.value);  // label이 없으면 value를 사용
      return {
        value: opt.value,
        label: translatedLabel,  // 항상 string으로 보장
        disabled: (opt as SchemaOptionItem).disabled,  // divider/disabled는 schema types에 정의됨
        divider: (opt as SchemaOptionItem).divider,    // divider 속성 전달
      };
    });

    return (
      <FormFieldLayout colSpan={colSpan}>
        <Controller
          name={name}
          control={control}
          rules={finalRules}
          render={({ field: f }) => (
            <Select
              label={placeholder || label}
              error={error}
              disabled={isDisabled}
              fullWidth
              size={size}
              showInlineLabelWhenHasValue={showInlineLabelWhenHasValue}
              value={(f.value ?? (kind === 'multiselect' ? [] : '')) as string | number | readonly string[]}
              onChange={f.onChange}
              onBlur={f.onBlur}
              multiple={kind === 'multiselect'}
              options={selectOptions}
              selectedSuffix={name === 'teacher_ids' ? '명' : '개'}
            />
          )}
        />
      </FormFieldLayout>
    );
  }

  // radio → Controller (여러 옵션 중 하나 선택)
  if (kind === 'radio') {
    return (
      <FormFieldLayout colSpan={colSpan}>
        <FormField
          label={label}
          error={error}
          required={isRequired}
        >
          <Controller
            name={name}
            control={control}
            rules={finalRules}
            render={({ field: f }) => (
              <div>
                {effectiveOptions?.map((opt) => {
                  // labelKey가 있으면 translations에서 조회, 번역이 없으면 label을 fallback으로 사용
                  const translatedLabel = opt.labelKey
                    ? (translations[opt.labelKey] || opt.label || opt.labelKey)
                    : opt.label;
                  return (
                    <Radio
                      key={opt.value}
                      label={translatedLabel}
                      value={opt.value}
                      checked={f.value === opt.value}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                        if (e.target.checked) {
                          f.onChange(opt.value);
                        }
                      }}
                      onBlur={f.onBlur}
                      disabled={isDisabled}
                      fullWidth
                    />
                  );
                })}
              </div>
            )}
          />
        </FormField>
      </FormFieldLayout>
    );
  }

  // checkbox
  if (kind === 'checkbox') {
    return (
      <FormFieldLayout colSpan={colSpan}>
        <Controller
          name={name}
          control={control}
          rules={finalRules}
          render={({ field: f }) => (
            <Checkbox
              label={label}
              checked={!!f.value}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => f.onChange(e.target.checked)}
              disabled={isDisabled}
              fullWidth
            />
          )}
        />
      </FormFieldLayout>
    );
  }

  // date → DateInput 사용 (직접 입력 + 캘린더 하이브리드)
  if (kind === 'date') {
    return (
      <FormFieldLayout colSpan={colSpan}>
        <Controller
          name={name}
          control={control}
          rules={finalRules}
          render={({ field: f }) => (
            <DateInput
              label={label}
              value={(f.value ?? '') as string}
              onChange={f.onChange}
              onBlur={f.onBlur}
              placeholder={placeholder}
              disabled={isDisabled}
              error={error}
              fullWidth
              size={size}
            />
          )}
        />
      </FormFieldLayout>
    );
  }

  // datetime
  if (kind === 'datetime') {
    return (
      <FormFieldLayout colSpan={colSpan}>
        <Controller
          name={name}
          control={control}
          rules={finalRules}
          render={({ field: f }) => (
            <DatePicker
              label={label}
              value={f.value as string | Date | undefined}
              onChange={f.onChange}
              disabled={isDisabled}
              error={error}
              fullWidth
              size={size}
              showInlineLabelWhenHasValue={showInlineLabelWhenHasValue}
              dateTime={true}
            />
          )}
        />
      </FormFieldLayout>
    );
  }

  // dateRange (프리셋 버튼 + 시작일/종료일 DatePicker)
  if (kind === 'dateRange') {
    // 로컬 시간 기준 YYYY-MM-DD 형식 변환 함수 (KST 대응)
    const formatLocalDate = (date: Date): string => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    // 프리셋 목록
    const presets = [
      { label: '오늘', days: 0 },
      { label: '어제', days: 1 },
      { label: '일주일', days: 7 },
      { label: '한달', days: 30 },
    ];

    return (
      <FormFieldLayout colSpan={colSpan}>
        <Controller
          name={name}
          control={control}
          rules={finalRules}
          render={({ field: f }) => {
            const currentValue = (f.value as { start?: string; end?: string }) || {};

            // 프리셋과 현재 날짜 범위 일치 여부 확인 함수
            const isPresetSelected = (presetDays: number): boolean => {
              if (!currentValue.start || !currentValue.end) return false;

              const today = new Date();
              let expectedStart: string;
              let expectedEnd: string;

              if (presetDays === 0) {
                expectedStart = formatLocalDate(today);
                expectedEnd = formatLocalDate(today);
              } else if (presetDays === 1) {
                const yesterday = new Date(today);
                yesterday.setDate(yesterday.getDate() - 1);
                expectedStart = formatLocalDate(yesterday);
                expectedEnd = formatLocalDate(yesterday);
              } else {
                const startDate = new Date(today);
                startDate.setDate(startDate.getDate() - presetDays + 1);
                expectedStart = formatLocalDate(startDate);
                expectedEnd = formatLocalDate(today);
              }

              return currentValue.start === expectedStart && currentValue.end === expectedEnd;
            };

            // 프리셋 버튼 클릭 핸들러
            const handlePresetClick = (presetDays: number) => {
              // 이미 선택된 프리셋을 다시 클릭하면 선택 해제
              if (isPresetSelected(presetDays)) {
                f.onChange({ start: '', end: '' });
                return;
              }

              const today = new Date();
              let startDate: Date;
              let endDate: Date;

              if (presetDays === 0) {
                startDate = today;
                endDate = today;
              } else if (presetDays === 1) {
                const yesterday = new Date(today);
                yesterday.setDate(yesterday.getDate() - 1);
                startDate = yesterday;
                endDate = yesterday;
              } else {
                const start = new Date(today);
                start.setDate(start.getDate() - presetDays + 1);
                startDate = start;
                endDate = today;
              }

              f.onChange({
                start: formatLocalDate(startDate),
                end: formatLocalDate(endDate),
              });
            };

            return (
              <div style={{ display: 'flex', gap: 'var(--spacing-sm)', alignItems: 'center' }}>
                {/* 기간 프리셋 버튼 */}
                <div style={{ display: 'flex', gap: 'var(--spacing-xs)', flexShrink: 0 }}>
                  {presets.map((preset) => (
                    <Button
                      key={preset.label}
                      type="button"
                      variant="outline"
                      size="md"
                      selected={isPresetSelected(preset.days)}
                      disabled={isDisabled}
                      onClick={() => handlePresetClick(preset.days)}
                    >
                      {preset.label}
                    </Button>
                  ))}
                </div>
                {/* 날짜 선택 */}
                <div style={{ display: 'flex', gap: 'var(--spacing-xs)', alignItems: 'center', flex: 1, minWidth: 'var(--width-daterange-container)' }}>
                  <div style={{ flex: 1, minWidth: 'var(--width-datepicker-input)' }}>
                    <DatePicker
                      value={currentValue.start || ''}
                      onChange={(val) => f.onChange({ ...currentValue, start: val })}
                      label="시작일"
                      disabled={isDisabled}
                      error={error}
                      fullWidth
                      size={size}
                      showInlineLabelWhenHasValue={showInlineLabelWhenHasValue}
                    />
                  </div>
                  <span style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>~</span>
                  <div style={{ flex: 1, minWidth: 'var(--width-datepicker-input)' }}>
                    <DatePicker
                      value={currentValue.end || ''}
                      onChange={(val) => f.onChange({ ...currentValue, end: val })}
                      label="종료일"
                      disabled={isDisabled}
                      error={error}
                      fullWidth
                      size={size}
                      showInlineLabelWhenHasValue={showInlineLabelWhenHasValue}
                    />
                  </div>
                </div>
              </div>
            );
          }}
        />
      </FormFieldLayout>
    );
  }

  // file (이미지 파일 첨부)
  if (kind === 'file') {
    // profile_image 필드인 경우 버튼 없이 preview만 표시
    const isPreviewOnly = name === 'profile_image';

    return (
      <FormFieldLayout colSpan={colSpan} rowSpan={rowSpan}>
        <Controller
          name={name}
          control={control}
          rules={finalRules}
          render={({ field: f }) => {
            // 초기값이 URL인 경우 preview 초기값으로 설정 (http 또는 / 로 시작하는 경로)
            const isUrlValue = (val: unknown): val is string =>
              typeof val === 'string' && (val.startsWith('http') || val.startsWith('/'));
            const initialPreview = isUrlValue(f.value) ? f.value : null;
            const [preview, setPreview] = React.useState<string | null>(initialPreview);
            const [isHovering, setIsHovering] = React.useState(false);
            const fileInputRef = React.useRef<HTMLInputElement>(null);

            // defaultValue가 URL 문자열인 경우 초기 preview로 설정 (값이 변경될 때)
            React.useEffect(() => {
              if (isUrlValue(f.value)) {
                setPreview(f.value);
              }
            }, [f.value]);

            const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
              const file = e.target.files?.[0];
              if (file) {
                // 파일 객체 저장
                f.onChange(file);

                // 이미지 미리보기
                if (file.type.startsWith('image/')) {
                  const reader = new FileReader();
                  reader.onloadend = () => {
                    setPreview(reader.result as string);
                  };
                  reader.readAsDataURL(file);
                } else {
                  setPreview(null);
                }
              }
            };

            const handleButtonClick = () => {
              fileInputRef.current?.click();
            };

            return (
              <div style={{ width: '100%' }}>
                {/* 숨겨진 file input */}
                <input
                  ref={fileInputRef}
                  type="file"
                  name={name}
                  data-field-name={name}
                  accept="image/*"
                  onChange={handleFileChange}
                  disabled={isDisabled}
                  style={{ display: 'none' }}
                />

                {/* 커스텀 이미지 영역 */}
                <div
                  onMouseEnter={() => !isPreviewOnly && setIsHovering(true)}
                  onMouseLeave={() => !isPreviewOnly && setIsHovering(false)}
                  style={{
                    position: 'relative',
                    border: 'var(--border-width-thin) solid var(--color-gray-200)',
                    borderRadius: 'var(--border-radius-sm)',
                    minHeight: '300px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: 'var(--color-background-secondary)',
                    overflow: 'visible',
                    cursor: isDisabled || isPreviewOnly ? 'default' : 'pointer',
                    opacity: isDisabled ? 0.6 : 1,
                    boxSizing: 'border-box',
                  }}
                  onClick={!isDisabled && !isPreviewOnly ? handleButtonClick : undefined}
                >
                  {preview ? (
                    <>
                      <img
                        src={preview}
                        alt="프로필 이미지"
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                          position: 'absolute',
                          top: '0',
                          left: '0',
                          borderRadius: 'var(--border-radius-sm)',
                        }}
                      />
                      {/* 이미지 위 호버 오버레이 - preview only면 표시하지 않음 */}
                      {!isPreviewOnly && isHovering && !isDisabled && (
                        <div style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          right: 0,
                          bottom: 0,
                          backgroundColor: 'rgba(0, 0, 0, 0.5)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          zIndex: 1,
                        }}>
                          <Button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleButtonClick();
                            }}
                            size="sm"
                            variant="solid"
                            color="primary"
                          >
                            파일 선택
                          </Button>
                        </div>
                      )}
                    </>
                  ) : (
                    <div style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 'var(--spacing-md)',
                      padding: 'var(--spacing-lg)',
                    }}>
                      {/* 루시드 프로필 아이콘 */}
                      <svg
                        width="128"
                        height="128"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="var(--color-gray-300)"
                        strokeWidth="0.75"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <circle cx="12" cy="8" r="5" />
                        <path d="M20 21a8 8 0 1 0-16 0" />
                      </svg>
                      {/* preview only 모드가 아닐 때만 버튼 표시 */}
                      {!isPreviewOnly && (
                        <Button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleButtonClick();
                          }}
                          disabled={isDisabled}
                          size="sm"
                          variant="solid"
                          color="primary"
                        >
                          파일 선택
                        </Button>
                      )}
                    </div>
                  )}
                </div>

                {error && (
                  <div style={{
                    marginTop: 'var(--spacing-xs)',
                    fontSize: 'var(--font-size-sm)',
                    color: 'var(--color-error)',
                  }}>
                    {error}
                  </div>
                )}
              </div>
            );
          }}
        />
      </FormFieldLayout>
    );
  }

  // profile_image_button 특수 처리 (캐릭터 선택 + 사진 선택)
  if (kind === 'custom' && (name === 'profile_image_button' || effectiveComponentType === 'profile_image_button')) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const gender = useWatch({ control, name: 'gender' }) as 'male' | 'female' | undefined;

    return (
      <FormFieldLayout colSpan={colSpan} rowSpan={rowSpan}>
        <ProfileImageButtonGroup
          isDisabled={isDisabled}
          setFormValue={setFormValue}
          gender={gender || 'male'}
        />
      </FormFieldLayout>
    );
  }

  // SDUI v1.1: Custom Widget 지원 (동적 로딩)
  if (kind === 'custom' && effectiveComponentType && effectiveComponentType !== 'profile_image_button') {
    return (
      <CustomWidgetField
        componentType={effectiveComponentType}
        field={field}
        colSpan={colSpan}
        control={control}
        errors={errors}
        isDisabled={isDisabled}
        finalRules={finalRules}
        translations={translations}
      />
    );
  }

  return null;
};

/**
 * Custom Widget Field Component
 *
 * SDUI v1.1: Custom Widget을 동적으로 로드하여 렌더링합니다.
 */
const CustomWidgetField: React.FC<{
  componentType: string;
  field: FormFieldSchema;
  colSpan: number;
  control: Control<Record<string, unknown>>;
  errors: FieldErrors<Record<string, unknown>>;
  isDisabled: boolean;
  finalRules: ControllerRules;
  translations?: Record<string, string>;
}> = ({ componentType, field, colSpan, control, errors, isDisabled, finalRules, translations: _translations = {} }) => {
  const [CustomComponent, setCustomComponent] = React.useState<React.ComponentType<Record<string, unknown>> | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<Error | null>(null);

  React.useEffect(() => {
    let mounted = true;

    async function loadComponent() {
      try {
        setLoading(true);
        setError(null);

        // SDUI v1.1: Widget Not Found 처리 강화
        const Component = await loadWidget(componentType);

        if (mounted) {
          if (!Component) {
            // Widget이 레지스트리에 없거나 로드 실패
            const registeredWidgets = await import('../widgets/registry').then(m => m.getRegisteredWidgets());
            setError(new Error(
              `Widget "${componentType}" not found in registry. ` +
              `Registered widgets: ${registeredWidgets.length > 0 ? registeredWidgets.join(', ') : 'none'}. ` +
              `Please register the widget using registerWidget() or check the componentType.`
            ));
            setCustomComponent(null);
          } else {
            setCustomComponent(() => Component);
            setError(null);
          }
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err : new Error(String(err)));
          setCustomComponent(null);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadComponent();

    return () => {
      mounted = false;
    };
  }, [componentType]);

  if (loading) {
    return (
      <FormFieldLayout colSpan={colSpan}>
        <div>위젯 로딩 중: {componentType}...</div>
      </FormFieldLayout>
    );
  }

  if (error || !CustomComponent) {
    return (
      <FormFieldLayout colSpan={colSpan}>
        <Card
          variant="outlined"
          padding="md"
          style={{
            borderColor: 'var(--color-error)',
            backgroundColor: 'var(--color-error-light)',
          }}
        >
          <div>
            <strong style={{ color: 'var(--color-error)', display: 'block', marginBottom: 'var(--spacing-xs)' }}>
              위젯 로드 실패: {componentType}
            </strong>
            {error && (
              <div style={{ marginTop: 'var(--spacing-xs)', fontSize: 'var(--font-size-sm)', color: 'var(--color-error)' }}>
                {error.message}
              </div>
            )}
            <div style={{ marginTop: 'var(--spacing-xs)', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
              이 필드는 렌더링되지 않습니다. 스키마의 customComponentType을 확인하거나 위젯을 등록해주세요.
            </div>
          </div>
        </Card>
      </FormFieldLayout>
    );
  }

  // Custom Widget에 전달할 props
  const widgetProps = {
    name: field.name,
    label: field.ui?.label,
    labelKey: field.ui?.labelKey,
    placeholder: field.ui?.placeholder,
    placeholderKey: field.ui?.placeholderKey,
    disabled: isDisabled,
    error: errors[field.name]?.message,
    fullWidth: true, // 모든 입력 필드는 기본적으로 fullWidth
    control,
    rules: finalRules,
    value: undefined, // Controller에서 관리
    onChange: undefined, // Controller에서 관리
    // 추가 필드 속성 전달
    defaultValue: field.defaultValue,
    options: field.options,
  };

  return (
    <FormFieldLayout colSpan={colSpan}>
      <Controller
        name={field.name}
        control={control}
        rules={finalRules}
        render={({ field: f }) => (
          <CustomComponent
            {...widgetProps}
            value={f.value}
            onChange={f.onChange}
            onBlur={f.onBlur}
          />
        )}
      />
    </FormFieldLayout>
  );
};

// ⚠️ 성능 최적화: React.memo로 감싸서 불필요한 리렌더링 방지
export const SchemaField = React.memo(SchemaFieldComponent);

