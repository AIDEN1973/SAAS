/**
 * Schema Migration
 *
 * SDUI v1.1: 이전 버전 스키마를 새 구조로 자동 변환
 *
 * 기술문서: SDUI 기술문서 v1.1 - 6. Schema Migration
 */

import type { BaseSchema } from '../types';

export interface MigrationRule {
  fromVersion: string;
  toVersion: string;
  rules: {
    renameFields?: Record<string, string>;  // 필드명 변경
    addDefaults?: Record<string, any>;       // 기본값 추가
    removeFields?: string[];                // 필드 제거
    transformFields?: Array<{               // 필드 변환
      name: string;
      transform: (value: any) => any;
    }>;
  };
}

/**
 * Schema Migration
 *
 * 스키마 버전에 따라 자동으로 마이그레이션을 수행합니다.
 *
 * @param schema - 원본 스키마
 * @param targetVersion - 목표 버전
 * @returns 마이그레이션된 스키마
 */
export function migrateSchema(schema: BaseSchema, targetVersion: string): BaseSchema {
  // TODO: Migration Rule 정의 및 적용
  // 현재는 스키마를 그대로 반환 (마이그레이션 규칙이 없으므로 변경 없음)

  // 향후 마이그레이션 규칙 적용
  const migrationRules: MigrationRule[] = [
    // 예: 1.0.0 → 1.1.0
    {
      fromVersion: '1.0.0',
      toVersion: '1.1.0',
      rules: {
        renameFields: {
          // 'phoneNumber': 'contact_phone',
        },
        addDefaults: {
          // 'status': 'active',
        },
      },
    },
  ];

  // 현재 버전에서 목표 버전까지 마이그레이션 규칙 적용
  let migratedSchema = { ...schema };

  for (const rule of migrationRules) {
    if (compareVersion(schema.version, rule.fromVersion) >= 0 &&
        compareVersion(rule.toVersion, targetVersion) <= 0) {
      migratedSchema = applyMigrationRule(migratedSchema, rule);
    }
  }

  // 버전 업데이트
  migratedSchema.version = targetVersion;

  return migratedSchema;
}

/**
 * Migration Rule 적용
 */
function applyMigrationRule(schema: BaseSchema, rule: MigrationRule): BaseSchema {
  const migrated = { ...schema };

  // 필드명 변경
  if (rule.rules.renameFields && 'fields' in migrated && Array.isArray(migrated.fields)) {
    migrated.fields = migrated.fields.map((field: any) => {
      const newName = rule.rules.renameFields![field.name];
      if (newName) {
        return { ...field, name: newName };
      }
      return field;
    });
  }

  // 기본값 추가
  if (rule.rules.addDefaults && 'fields' in migrated && Array.isArray(migrated.fields)) {
    migrated.fields = migrated.fields.map((field: any) => {
      const defaultValue = rule.rules.addDefaults![field.name];
      if (defaultValue !== undefined && field.defaultValue === undefined) {
        return { ...field, defaultValue };
      }
      return field;
    });
  }

  // 필드 제거
  if (rule.rules.removeFields && 'fields' in migrated && Array.isArray(migrated.fields)) {
    migrated.fields = migrated.fields.filter(
      (field: any) => !rule.rules.removeFields!.includes(field.name)
    );
  }

  return migrated;
}

/**
 * 버전 비교 함수
 *
 * @returns -1: v1 < v2, 0: v1 === v2, 1: v1 > v2
 */
function compareVersion(v1: string, v2: string): number {
  const [major1, minor1, patch1] = v1.split('.').map(Number);
  const [major2, minor2, patch2] = v2.split('.').map(Number);

  if (major1 !== major2) return major1 - major2;
  if (minor1 !== minor2) return minor1 - minor2;
  return patch1 - patch2;
}
