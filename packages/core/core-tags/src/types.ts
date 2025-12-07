/**
 * Core Tags Types
 * 
 * ê³µí†µ ?œê¹… ?œìŠ¤??(?™ìƒ ?œê·¸, ê³ ê° ?œê·¸, ë§¤ë¬¼ ?œê·¸ ??
 * [ë¶ˆë? ê·œì¹™] Core Layer??Industry ëª¨ë“ˆ???˜ì¡´?˜ì? ?ŠìŒ
 */

export type EntityType = 'student' | 'customer' | 'property' | 'donor' | 'other';

export interface Tag {
  id: string;
  tenant_id: string;
  name: string;
  color: string;
  description?: string;
  entity_type?: EntityType;  // ?…ì¢…ë³??”í‹°???€??(? íƒ??
  created_at: string;
}

export interface TagAssignment {
  id: string;
  tenant_id: string;
  entity_id: string;  // student_id, customer_id ??
  entity_type: EntityType;
  tag_id: string;
  created_at: string;
}

export interface CreateTagInput {
  name: string;
  color?: string;
  description?: string;
  entity_type?: EntityType;
}

export interface TagFilter {
  entity_type?: EntityType;
  entity_id?: string;
}

