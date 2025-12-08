/**
 * Core Storage Types
 *
 * 파일 업로드/권한/폴더 구조 공통 시스템(Supabase Storage 매핑)
 * [불변 규칙] Core Layer는 Industry 모듈에 의존하지 않음
 */

export interface FileMetadata {
  id: string;
  tenant_id: string;
  file_path: string;  // {tenant_id}/{module}/{file_id}
  file_name: string;
  file_size: number;
  mime_type: string;
  module?: string;  // 'consultation', 'review', 'post' 등
  entity_id?: string;  // 관련 엔티티의 ID
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
