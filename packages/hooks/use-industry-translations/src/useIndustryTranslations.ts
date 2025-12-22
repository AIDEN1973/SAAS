/**
 * useIndustryTranslations Hook
 *
 * Automation & AI Industry-Neutral Rule (SSOT): Industry Adapter를 통한 translations 생성
 * 스키마의 labelKey를 업종별 Label로 변환하여 translations 객체를 생성합니다.
 *
 * [불변 규칙] 모든 SchemaForm 사용 시 이 훅을 사용하여 translations를 생성해야 합니다.
 */

import { useMemo } from 'react';
import { getApiContext } from '@api-sdk/core';
import type { FormSchema } from '@schema-engine';
import { getAcademyLabelFromI18n } from '@industry/academy';

// Industry Adapter 동적 import (업종별로 다른 Adapter 사용)
async function getIndustryAdapter(industryType: string | null | undefined) {
  if (industryType === 'academy') {
    const { getAcademyLabelFromI18n } = await import('@industry/academy');
    return { getLabelFromI18n: getAcademyLabelFromI18n };
  }
  // TODO: 다른 업종 추가 시 여기에 추가
  // if (industryType === 'salon') {
  //   const { getSalonLabelFromI18n } = await import('@industry/salon');
  //   return { getLabelFromI18n: getSalonLabelFromI18n };
  // }

  // 기본값: Academy Adapter (하위 호환성)
  const { getAcademyLabelFromI18n } = await import('@industry/academy');
  return { getLabelFromI18n: getAcademyLabelFromI18n };
}

/**
 * 스키마에서 사용된 모든 labelKey를 수집하여 Industry Adapter로 변환
 */
function collectLabelKeys(schema: FormSchema): Set<string> {
  const labelKeys = new Set<string>();

  if (schema.form?.fields) {
    schema.form.fields.forEach((field) => {
      if (field.ui?.labelKey) {
        labelKeys.add(field.ui.labelKey);
      }
      if (field.ui?.descriptionKey) {
        labelKeys.add(field.ui.descriptionKey);
      }
      if (field.ui?.placeholderKey) {
        labelKeys.add(field.ui.placeholderKey);
      }
      if (field.ui?.tooltipKey) {
        labelKeys.add(field.ui.tooltipKey);
      }
      // options의 labelKey도 수집
      if (field.options) {
        field.options.forEach((opt) => {
          if (opt.labelKey) {
            labelKeys.add(opt.labelKey);
          }
        });
      }
    });
  }

  if (schema.form?.submit?.labelKey) {
    labelKeys.add(schema.form.submit.labelKey);
  }

  return labelKeys;
}

/**
 * Industry Adapter를 사용하여 translations 객체 생성
 */
export function useIndustryTranslations(schema: FormSchema | null | undefined): Record<string, string> {
  const context = getApiContext();
  const industryType = context.industryType;

  return useMemo(() => {
    if (!schema || schema.type !== 'form' || !schema.form) {
      return {};
    }

    // Industry Adapter 사용 (업종별로 다른 Adapter 사용)
    // 현재는 Academy만 지원, 향후 다른 업종 추가 시 조건부 처리 필요
    // 정적 import를 사용하여 브라우저 환경에서 동작 보장
    const getLabelFromI18n = getAcademyLabelFromI18n;

    const labelKeys = collectLabelKeys(schema);
    const translationMap: Record<string, string> = {};

    labelKeys.forEach((labelKey) => {
      translationMap[labelKey] = getLabelFromI18n(labelKey);
    });

    return translationMap;
  }, [schema, industryType]);
}

