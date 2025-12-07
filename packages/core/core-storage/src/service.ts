/**
 * Core Storage Service
 * 
 * ?Œì¼ ?…ë¡œ??ê¶Œí•œ ?œë¹„??(Supabase Storage ?˜í•‘)
 * [ë¶ˆë? ê·œì¹™] Core Layer??Industry ëª¨ë“ˆ???˜ì¡´?˜ì? ?ŠìŒ
 * 
 * ? ï¸ ì£¼ì˜: ?Œë„Œ?¸ë³„ ?´ë” êµ¬ì¡°: `{tenant_id}/{module}/{file_id}`
 * RLS ê¸°ë°˜ ê¶Œí•œ ê´€ë¦?
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
   * ?Œì¼ ?…ë¡œ??
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

    // ?Œì¼ ë©”í??°ì´???€??
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
        created_by: null, // TODO: auth.uid()?ì„œ ê°€?¸ì˜¤ê¸?
      })
      .select()
      .single();

    if (metadataError) {
      throw new Error(`Failed to save file metadata: ${metadataError.message}`);
    }

    return metadata as FileMetadata;
  }

  /**
   * ?Œì¼ ?¤ìš´ë¡œë“œ URL ?ì„±
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
   * ?Œì¼ ëª©ë¡ ì¡°íšŒ
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
   * ?Œì¼ ?? œ
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

    // Storage?ì„œ ?Œì¼ ?? œ
    const { error: storageError } = await this.supabase.storage
      .from('files')
      .remove([metadata.file_path]);

    if (storageError) {
      throw new Error(`Failed to delete file from storage: ${storageError.message}`);
    }

    // ë©”í??°ì´???? œ
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

