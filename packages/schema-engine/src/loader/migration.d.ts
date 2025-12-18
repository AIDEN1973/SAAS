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
        renameFields?: Record<string, string>;
        addDefaults?: Record<string, unknown>;
        removeFields?: string[];
        transformFields?: Array<{
            name: string;
            transform: (value: unknown) => unknown;
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
export declare function migrateSchema(schema: BaseSchema, targetVersion: string): BaseSchema;
//# sourceMappingURL=migration.d.ts.map