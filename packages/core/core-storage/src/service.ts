/**
 * Core Storage Service
 *
 * 파일 업로드/권한 관리 (Supabase Storage 매핑)
 * [불변 규칙] Core Layer는 Industry 모듈에 의존하지 않음
 *
 * ⚠️ 주의: 테넌트별 폴더 구조: `{tenant_id}/{module}/{file_id}`
 * RLS 기반 권한 관리
 */

import { createServerClient } from '@lib/supabase-client/server';
import { withTenant } from '@lib/supabase-client/db';
import type {
  FileMetadata,
  UploadFileInput,
  FileFilter,
} from './types';

export class StorageService {
  private supabase = createServerClient();

  /**
   * 파일 업로드
   */
  async uploadFile(
    tenantId: string,
    input: UploadFileInput
  ): Promise<FileMetadata> {
    const fileId = crypto.randomUUID();
    const module = input.module || 'general';
    const folder = input.folder || '';
    const filePath = `${tenantId}/${module}${folder ? `/${folder}` : ''}/${fileId}`;

    const { data, error } = await this.supabase.storage
      .from('files')
      .upload(filePath, input.file, {
        contentType: input.file.type || 'application/octet-stream',
        upsert: false,
      });

    if (error) {
      throw new Error(`Failed to upload file: ${error.message}`);
    }

    // 파일 메타데이터 저장
    const { data: metadata, error: metadataError } = await this.supabase
      .from('file_metadata')
      .insert({
        tenant_id: tenantId,
        file_path: filePath,
        file_name: input.file_name,
        file_size: input.file.size,
        mime_type: input.file.type || 'application/octet-stream',
        module: input.module,
        entity_id: input.entity_id,
        created_by: null, // TODO: auth.uid()에서 가져오기
      })
      .select()
      .single();

    if (metadataError) {
      throw new Error(`Failed to save file metadata: ${metadataError.message}`);
    }

    return metadata as FileMetadata;
  }

  /**
   * 파일 다운로드 URL 생성
   */
  async getFileUrl(
    tenantId: string,
    fileId: string,
    expiresIn: number = 3600
  ): Promise<string> {
    const { data: metadata } = await withTenant(
      this.supabase
        .from('file_metadata')
        .select('file_path')
        .eq('id', fileId),
      tenantId
    ).single();

    if (!metadata) {
      throw new Error('File not found');
    }

    const { data } = await this.supabase.storage
      .from('files')
      .createSignedUrl(metadata.file_path, expiresIn);

    if (!data) {
      throw new Error('Failed to create signed URL');
    }

    return data.signedUrl;
  }

  /**
   * 파일 목록 조회
   */
  async getFiles(
    tenantId: string,
    filter?: FileFilter
  ): Promise<FileMetadata[]> {
    let query = withTenant(
      this.supabase
        .from('file_metadata')
        .select('*'),
      tenantId
    );

    if (filter?.module) {
      query = query.eq('module', filter.module);
    }

    if (filter?.entity_id) {
      query = query.eq('entity_id', filter.entity_id);
    }

    query = query.order('created_at', { ascending: false });

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch files: ${error.message}`);
    }

    return (data || []) as FileMetadata[];
  }

  /**
   * 파일 삭제
   */
  async deleteFile(tenantId: string, fileId: string): Promise<void> {
    const { data: metadata } = await withTenant(
      this.supabase
        .from('file_metadata')
        .select('file_path')
        .eq('id', fileId),
      tenantId
    ).single();

    if (!metadata) {
      throw new Error('File not found');
    }

    // Storage에서 파일 삭제
    const { error: storageError } = await this.supabase.storage
      .from('files')
      .remove([metadata.file_path]);

    if (storageError) {
      throw new Error(`Failed to delete file from storage: ${storageError.message}`);
    }

    // 메타데이터 삭제
    const { error: metadataError } = await withTenant(
      this.supabase
        .from('file_metadata')
        .delete()
        .eq('id', fileId),
      tenantId
    );

    if (metadataError) {
      throw new Error(`Failed to delete file metadata: ${metadataError.message}`);
    }
  }
}

/**
 * Default Service Instance
 */
export const storageService = new StorageService();
