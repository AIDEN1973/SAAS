/**
 * Schema Migration
 * 
 * SDUI v1.1: ?¤ë˜???¤í‚¤ë§ˆë? ??êµ¬ì¡°ë¡??ë™ ë³€??
 * 
 * ê¸°ìˆ ë¬¸ì„œ: SDUI ê¸°ìˆ ë¬¸ì„œ v1.1 - 6. Schema Migration
 */

import type { BaseSchema } from '../types';

export interface MigrationRule {
  fromVersion: string;
  toVersion: string;
  rules: {
    renameFields?: Record<string, string>;  // ?„ë“œëª?ë³€ê²?
    addDefaults?: Record<string, any>;       // ê¸°ë³¸ê°?ì¶”ê?
    removeFields?: string[];                // ?„ë“œ ?œê±°
    transformFields?: Array<{               // ?„ë“œ ë³€??
      name: string;
      transform: (value: any) => any;
    }>;
  };
}

/**
 * Schema Migration
 * 
 * ?¤í‚¤ë§?ë²„ì „???°ë¼ ?ë™?¼ë¡œ ë§ˆì´ê·¸ë ˆ?´ì…˜???˜í–‰?©ë‹ˆ??
 * 
 * @param schema - ?ë³¸ ?¤í‚¤ë§?
 * @param targetVersion - ëª©í‘œ ë²„ì „
 * @returns ë§ˆì´ê·¸ë ˆ?´ì…˜???¤í‚¤ë§?
 */
export function migrateSchema(schema: BaseSchema, targetVersion: string): BaseSchema {
  // TODO: Migration Rule ?•ì˜ ë°??ìš©
  // ?„ì¬???¤í‚¤ë§ˆë? ê·¸ë?ë¡?ë°˜í™˜ (ë§ˆì´ê·¸ë ˆ?´ì…˜ ê·œì¹™???†ìœ¼ë©?ë³€ê²??†ìŒ)
  
  // ?ˆì‹œ ë§ˆì´ê·¸ë ˆ?´ì…˜ ê·œì¹™ ?ìš©
  const migrationRules: MigrationRule[] = [
    // ?? 1.0.0 ??1.1.0
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
  
  // ?„ì¬ ë²„ì „?ì„œ ëª©í‘œ ë²„ì „ê¹Œì? ë§ˆì´ê·¸ë ˆ?´ì…˜ ê·œì¹™ ?ìš©
  let migratedSchema = { ...schema };
  
  for (const rule of migrationRules) {
    if (compareVersion(schema.version, rule.fromVersion) >= 0 && 
        compareVersion(rule.toVersion, targetVersion) <= 0) {
      migratedSchema = applyMigrationRule(migratedSchema, rule);
    }
  }
  
  // ë²„ì „ ?…ë°?´íŠ¸
  migratedSchema.version = targetVersion;
  
  return migratedSchema;
}

/**
 * Migration Rule ?ìš©
 */
function applyMigrationRule(schema: BaseSchema, rule: MigrationRule): BaseSchema {
  const migrated = { ...schema };
  
  // ?„ë“œëª?ë³€ê²?
  if (rule.rules.renameFields && 'fields' in migrated && Array.isArray(migrated.fields)) {
    migrated.fields = migrated.fields.map((field: any) => {
      const newName = rule.rules.renameFields![field.name];
      if (newName) {
        return { ...field, name: newName };
      }
      return field;
    });
  }
  
  // ê¸°ë³¸ê°?ì¶”ê?
  if (rule.rules.addDefaults && 'fields' in migrated && Array.isArray(migrated.fields)) {
    migrated.fields = migrated.fields.map((field: any) => {
      const defaultValue = rule.rules.addDefaults![field.name];
      if (defaultValue !== undefined && field.defaultValue === undefined) {
        return { ...field, defaultValue };
      }
      return field;
    });
  }
  
  // ?„ë“œ ?œê±°
  if (rule.rules.removeFields && 'fields' in migrated && Array.isArray(migrated.fields)) {
    migrated.fields = migrated.fields.filter(
      (field: any) => !rule.rules.removeFields!.includes(field.name)
    );
  }
  
  return migrated;
}

/**
 * ë²„ì „ ë¹„êµ ?¨ìˆ˜
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

