/**
 * Core Storage Types
 * 
 * ?Œì¼ ?…ë¡œ??ê¶Œí•œ/?´ë” êµ¬ì¡° ê³µí†µ??(Supabase Storage ?˜í•‘)
 * [ë¶ˆë? ê·œì¹™] Core Layer??Industry ëª¨ë“ˆ???˜ì¡´?˜ì? ?ŠìŒ
 */

export interface FileMetadata {
  id: string;
  tenant_id: string;
  file_path: string;  // {tenant_id}/{module}/{file_id}
  file_name: string;
  file_size: number;
  mime_type: string;
  module?: string;  // 'consultation', 'review', 'post' ??
  entity_id?: string;  // ê´€???”í‹°??ID
  created_by?: string;
  created_at: string;
}

export interface UploadFileInput {
  file: File | Blob;
  file_name: string;
  module?: string;
  entity_id?: string;
  folder?: string;
}

export interface FileFilter {
  module?: string;
  entity_id?: string;
}

