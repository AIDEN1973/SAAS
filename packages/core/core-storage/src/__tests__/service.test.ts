/**
 * Core Storage Service Unit Tests
 *
 * Core Layer의 파일 업로드/URL 생성/조회/삭제 검증
 * Supabase Storage + file_metadata 테이블 모킹하여 단위 테스트 수행
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockFrom, mockStorageFrom } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
  mockStorageFrom: vi.fn(),
}));

vi.mock('@lib/supabase-client/server', () => ({
  createServerClient: () => ({
    from: mockFrom,
    storage: { from: mockStorageFrom },
  }),
}));

vi.mock('@lib/supabase-client/db', () => ({
  withTenant: (query: unknown) => query,
}));

function createChainMock(resolvedData: unknown = [], resolvedError: unknown = null) {
  const chain: Record<string, unknown> = {};
  const methods = [
    'select', 'insert', 'update', 'delete', 'eq', 'neq', 'in', 'is',
    'gte', 'lte', 'gt', 'lt', 'order', 'limit', 'range', 'ilike', 'or',
    'not', 'contains', 'filter', 'textSearch', 'maybeSingle', 'csv',
    'match', 'like', 'upsert',
  ];
  for (const method of methods) {
    chain[method] = vi.fn(() => chain);
  }
  chain.single = vi.fn(() => ({ data: resolvedData, error: resolvedError }));
  Object.defineProperty(chain, 'then', {
    value: (resolve: (val: unknown) => void) => {
      resolve({ data: resolvedData, error: resolvedError });
    },
  });
  return chain;
}

import { StorageService } from '../service';

const TENANT_ID = 'test-tenant-id';

const mockFileMetadata = {
  id: 'file-1',
  tenant_id: TENANT_ID,
  file_path: `${TENANT_ID}/general/test-uuid`,
  file_name: 'document.pdf',
  file_size: 1024,
  mime_type: 'application/pdf',
  module: 'general',
  entity_id: undefined,
  created_by: null,
  created_at: '2026-03-01T00:00:00Z',
};

function createMockFile(
  name: string = 'document.pdf',
  type: string = 'application/pdf',
  size: number = 1024
): File {
  // Blob.size is a read-only getter, so we use a plain object mock
  return { name, size, type, lastModified: Date.now() } as unknown as File;
}

describe('StorageService', () => {
  let service: StorageService;

  beforeEach(() => {
    service = new StorageService();
    vi.clearAllMocks();
    vi.stubGlobal('crypto', { randomUUID: () => 'test-uuid' });
  });

  // ─── uploadFile ──────────────────────────────────────────────

  describe('uploadFile', () => {
    it('파일 업로드 성공 (path = tenantId/module/uuid)', async () => {
      const mockFile = createMockFile();

      // Storage upload mock
      mockStorageFrom.mockReturnValue({
        upload: vi.fn().mockResolvedValue({
          data: { path: `${TENANT_ID}/general/test-uuid` },
          error: null,
        }),
      });

      // file_metadata insert mock
      const metadataChain = createChainMock(mockFileMetadata);
      mockFrom.mockReturnValue(metadataChain);

      const result = await service.uploadFile(TENANT_ID, {
        file: mockFile,
        file_name: 'document.pdf',
        module: 'general',
      });

      expect(mockStorageFrom).toHaveBeenCalledWith('files');
      expect(mockFrom).toHaveBeenCalledWith('file_metadata');
      expect(metadataChain.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          tenant_id: TENANT_ID,
          file_path: `${TENANT_ID}/general/test-uuid`,
          file_name: 'document.pdf',
          module: 'general',
        })
      );
      expect(result).toEqual(mockFileMetadata);
    });

    it('folder 지정 시 경로에 포함', async () => {
      const mockFile = createMockFile();
      const expectedPath = `${TENANT_ID}/consultation/reports/test-uuid`;

      mockStorageFrom.mockReturnValue({
        upload: vi.fn().mockResolvedValue({
          data: { path: expectedPath },
          error: null,
        }),
      });

      const metadataWithFolder = { ...mockFileMetadata, file_path: expectedPath };
      const metadataChain = createChainMock(metadataWithFolder);
      mockFrom.mockReturnValue(metadataChain);

      const result = await service.uploadFile(TENANT_ID, {
        file: mockFile,
        file_name: 'report.pdf',
        module: 'consultation',
        folder: 'reports',
      });

      // Verify storage upload was called with the folder-included path
      const storageUploadFn = mockStorageFrom.mock.results[0].value.upload;
      expect(storageUploadFn).toHaveBeenCalledWith(
        expectedPath,
        mockFile,
        expect.objectContaining({ upsert: false })
      );
      expect(result.file_path).toBe(expectedPath);
    });

    it('module 미지정 시 기본값 general 사용', async () => {
      const mockFile = createMockFile();

      mockStorageFrom.mockReturnValue({
        upload: vi.fn().mockResolvedValue({
          data: { path: `${TENANT_ID}/general/test-uuid` },
          error: null,
        }),
      });

      const metadataChain = createChainMock(mockFileMetadata);
      mockFrom.mockReturnValue(metadataChain);

      await service.uploadFile(TENANT_ID, {
        file: mockFile,
        file_name: 'document.pdf',
        // module is omitted
      });

      const storageUploadFn = mockStorageFrom.mock.results[0].value.upload;
      expect(storageUploadFn).toHaveBeenCalledWith(
        `${TENANT_ID}/general/test-uuid`,
        expect.anything(),
        expect.anything()
      );
    });

    it('storage upload 실패 시 에러 throw', async () => {
      const mockFile = createMockFile();

      mockStorageFrom.mockReturnValue({
        upload: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'Storage limit exceeded' },
        }),
      });

      await expect(
        service.uploadFile(TENANT_ID, {
          file: mockFile,
          file_name: 'document.pdf',
        })
      ).rejects.toThrow('Failed to upload file: Storage limit exceeded');
    });

    it('metadata insert 실패 시 에러 throw', async () => {
      const mockFile = createMockFile();

      mockStorageFrom.mockReturnValue({
        upload: vi.fn().mockResolvedValue({
          data: { path: `${TENANT_ID}/general/test-uuid` },
          error: null,
        }),
      });

      const metadataChain = createChainMock(null, { message: 'Metadata insert failed' });
      mockFrom.mockReturnValue(metadataChain);

      await expect(
        service.uploadFile(TENANT_ID, {
          file: mockFile,
          file_name: 'document.pdf',
        })
      ).rejects.toThrow('Failed to save file metadata: Metadata insert failed');
    });
  });

  // ─── getFileUrl ──────────────────────────────────────────────

  describe('getFileUrl', () => {
    it('기본 만료시간(3600s)으로 서명 URL 생성 성공', async () => {
      // file_metadata query to get file_path
      const metadataChain = createChainMock({ file_path: `${TENANT_ID}/general/test-uuid` });
      mockFrom.mockReturnValue(metadataChain);

      // storage createSignedUrl
      mockStorageFrom.mockReturnValue({
        createSignedUrl: vi.fn().mockResolvedValue({
          data: { signedUrl: 'https://storage.example.com/signed-url' },
          error: null,
        }),
      });

      const result = await service.getFileUrl(TENANT_ID, 'file-1');

      expect(mockFrom).toHaveBeenCalledWith('file_metadata');
      expect(metadataChain.select).toHaveBeenCalledWith('file_path');
      expect(metadataChain.eq).toHaveBeenCalledWith('id', 'file-1');
      expect(mockStorageFrom).toHaveBeenCalledWith('files');

      const createSignedUrlFn = mockStorageFrom.mock.results[0].value.createSignedUrl;
      expect(createSignedUrlFn).toHaveBeenCalledWith(
        `${TENANT_ID}/general/test-uuid`,
        3600
      );
      expect(result).toBe('https://storage.example.com/signed-url');
    });

    it('커스텀 만료시간으로 서명 URL 생성', async () => {
      const metadataChain = createChainMock({ file_path: `${TENANT_ID}/general/test-uuid` });
      mockFrom.mockReturnValue(metadataChain);

      mockStorageFrom.mockReturnValue({
        createSignedUrl: vi.fn().mockResolvedValue({
          data: { signedUrl: 'https://storage.example.com/signed-url-7200' },
          error: null,
        }),
      });

      const result = await service.getFileUrl(TENANT_ID, 'file-1', 7200);

      const createSignedUrlFn = mockStorageFrom.mock.results[0].value.createSignedUrl;
      expect(createSignedUrlFn).toHaveBeenCalledWith(
        `${TENANT_ID}/general/test-uuid`,
        7200
      );
      expect(result).toBe('https://storage.example.com/signed-url-7200');
    });

    it('파일을 찾을 수 없으면 에러 throw', async () => {
      // metadata returns null (file not found)
      const metadataChain = createChainMock(null);
      mockFrom.mockReturnValue(metadataChain);

      await expect(service.getFileUrl(TENANT_ID, 'nonexistent'))
        .rejects.toThrow('File not found');
    });
  });

  // ─── getFiles ────────────────────────────────────────────────

  describe('getFiles', () => {
    it('파일 목록 조회 성공', async () => {
      const chain = createChainMock([mockFileMetadata]);
      mockFrom.mockReturnValue(chain);

      const result = await service.getFiles(TENANT_ID);

      expect(mockFrom).toHaveBeenCalledWith('file_metadata');
      expect(chain.select).toHaveBeenCalledWith('*');
      expect(chain.order).toHaveBeenCalledWith('created_at', { ascending: false });
      expect(result).toEqual([mockFileMetadata]);
    });

    it('module 필터 적용', async () => {
      const chain = createChainMock([mockFileMetadata]);
      mockFrom.mockReturnValue(chain);

      await service.getFiles(TENANT_ID, { module: 'consultation' });

      expect(chain.eq).toHaveBeenCalledWith('module', 'consultation');
    });

    it('entity_id 필터 적용', async () => {
      const chain = createChainMock([mockFileMetadata]);
      mockFrom.mockReturnValue(chain);

      await service.getFiles(TENANT_ID, { entity_id: 'entity-123' });

      expect(chain.eq).toHaveBeenCalledWith('entity_id', 'entity-123');
    });

    it('조회 실패 시 에러 throw', async () => {
      const chain = createChainMock(null, { message: 'DB error' });
      mockFrom.mockReturnValue(chain);

      await expect(service.getFiles(TENANT_ID))
        .rejects.toThrow('Failed to fetch files: DB error');
    });
  });

  // ─── deleteFile ──────────────────────────────────────────────

  describe('deleteFile', () => {
    it('파일 삭제 성공 (storage + metadata 모두 삭제)', async () => {
      // Step 1: metadata query to get file_path
      const metadataSelectChain = createChainMock({ file_path: `${TENANT_ID}/general/test-uuid` });

      // Step 3: metadata delete chain
      const metadataDeleteChain = createChainMock(null, null);

      // mockFrom returns different chains depending on the call sequence
      let fromCallCount = 0;
      mockFrom.mockImplementation(() => {
        fromCallCount++;
        if (fromCallCount === 1) return metadataSelectChain; // select file_path
        return metadataDeleteChain; // delete metadata
      });

      // Step 2: storage remove
      mockStorageFrom.mockReturnValue({
        remove: vi.fn().mockResolvedValue({ data: [], error: null }),
      });

      await service.deleteFile(TENANT_ID, 'file-1');

      // Verify metadata lookup
      expect(metadataSelectChain.select).toHaveBeenCalledWith('file_path');
      expect(metadataSelectChain.eq).toHaveBeenCalledWith('id', 'file-1');

      // Verify storage removal
      expect(mockStorageFrom).toHaveBeenCalledWith('files');
      const removeFn = mockStorageFrom.mock.results[0].value.remove;
      expect(removeFn).toHaveBeenCalledWith([`${TENANT_ID}/general/test-uuid`]);

      // Verify metadata deletion
      expect(metadataDeleteChain.delete).toHaveBeenCalled();
      expect(metadataDeleteChain.eq).toHaveBeenCalledWith('id', 'file-1');
    });

    it('storage 삭제 실패 시 에러 throw', async () => {
      const metadataSelectChain = createChainMock({ file_path: `${TENANT_ID}/general/test-uuid` });
      mockFrom.mockReturnValue(metadataSelectChain);

      mockStorageFrom.mockReturnValue({
        remove: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'Storage removal failed' },
        }),
      });

      await expect(service.deleteFile(TENANT_ID, 'file-1'))
        .rejects.toThrow('Failed to delete file from storage: Storage removal failed');
    });

    it('metadata 삭제 실패 시 에러 throw', async () => {
      // Step 1: metadata query succeeds
      const metadataSelectChain = createChainMock({ file_path: `${TENANT_ID}/general/test-uuid` });

      // Step 3: metadata delete fails
      const metadataDeleteChain = createChainMock(null, { message: 'Metadata delete failed' });

      let fromCallCount = 0;
      mockFrom.mockImplementation(() => {
        fromCallCount++;
        if (fromCallCount === 1) return metadataSelectChain;
        return metadataDeleteChain;
      });

      // Step 2: storage remove succeeds
      mockStorageFrom.mockReturnValue({
        remove: vi.fn().mockResolvedValue({ data: [], error: null }),
      });

      await expect(service.deleteFile(TENANT_ID, 'file-1'))
        .rejects.toThrow('Failed to delete file metadata: Metadata delete failed');
    });
  });
});
