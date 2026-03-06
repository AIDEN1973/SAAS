/**
 * useTenantFeature Hook Unit Tests
 *
 * 테스트 범위:
 * - useTenantFeature: 테넌트 기능 조회 Hook (성공, 에러, null, disabled)
 * - useUpdateTenantFeature: 기능 업데이트 Mutation (기존 업데이트, 새로 생성, 에러)
 */

import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ReactNode } from 'react';
import * as apiSdk from '@api-sdk/core';

// ============================================================================
// Mocks
// ============================================================================

vi.mock('@api-sdk/core', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    callRPC: vi.fn(),
  },
  getApiContext: vi.fn(() => ({
    tenantId: 'test-tenant-id',
    industryType: 'academy',
  })),
}));

// ============================================================================
// Imports (after mocks due to hoisting)
// ============================================================================

import { useTenantFeature, useUpdateTenantFeature, type TenantFeature } from '../useTenantFeature';

// ============================================================================
// Test Helpers
// ============================================================================

const TENANT_ID = 'test-tenant-id';

const mockApiClient = apiSdk.apiClient as {
  get: ReturnType<typeof vi.fn>;
  post: ReturnType<typeof vi.fn>;
  patch: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
  callRPC: ReturnType<typeof vi.fn>;
};

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    );
  };
}

function createMockFeature(overrides?: Partial<TenantFeature>): TenantFeature {
  return {
    id: 'feature-1',
    tenant_id: TENANT_ID,
    feature_key: 'ai',
    enabled: true,
    quota: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

// ============================================================================
// Tests: useTenantFeature (Query)
// ============================================================================

describe('useTenantFeature', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('성공 시 테넌트 기능 데이터를 반환한다', async () => {
    const mockFeature = createMockFeature();

    mockApiClient.get.mockResolvedValue({
      data: [mockFeature],
      error: null,
    });

    const { result } = renderHook(() => useTenantFeature('ai'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(mockFeature);
  });

  it('올바른 파라미터로 API를 호출한다', async () => {
    mockApiClient.get.mockResolvedValue({ data: [], error: null });

    const { result } = renderHook(() => useTenantFeature('ai'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockApiClient.get).toHaveBeenCalledWith('tenant_features', {
      filters: { feature_key: 'ai' },
    });
  });

  it('데이터가 비어있으면 null을 반환한다', async () => {
    mockApiClient.get.mockResolvedValue({
      data: [],
      error: null,
    });

    const { result } = renderHook(() => useTenantFeature('nonexistent'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toBeNull();
  });

  it('data가 null이면 null을 반환한다', async () => {
    mockApiClient.get.mockResolvedValue({
      data: null,
      error: null,
    });

    const { result } = renderHook(() => useTenantFeature('ai'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toBeNull();
  });

  it('PGRST116 에러 시 null을 반환한다 (레코드 미존재)', async () => {
    mockApiClient.get.mockResolvedValue({
      data: null,
      error: { code: 'PGRST116', message: 'No rows found' },
    });

    const { result } = renderHook(() => useTenantFeature('ai'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toBeNull();
  });

  it('일반 API 에러 시 에러를 반환한다', async () => {
    mockApiClient.get.mockResolvedValue({
      data: null,
      error: { code: 'PGRST301', message: 'Permission denied' },
    });

    const { result } = renderHook(() => useTenantFeature('ai'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error?.message).toBe('Permission denied');
  });

  it('tenantId가 없으면 쿼리가 비활성화된다', async () => {
    vi.mocked(apiSdk.getApiContext).mockReturnValueOnce({
      tenantId: '',
      industryType: 'academy',
    } as ReturnType<typeof apiSdk.getApiContext>);

    const { result } = renderHook(() => useTenantFeature('ai'), {
      wrapper: createWrapper(),
    });

    expect(result.current.fetchStatus).toBe('idle');
    expect(mockApiClient.get).not.toHaveBeenCalled();
  });

  it('다른 feature_key로 호출할 수 있다', async () => {
    const mockFeature = createMockFeature({ feature_key: 'chatops', enabled: false });

    mockApiClient.get.mockResolvedValue({
      data: [mockFeature],
      error: null,
    });

    const { result } = renderHook(() => useTenantFeature('chatops'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.feature_key).toBe('chatops');
    expect(result.current.data?.enabled).toBe(false);
    expect(mockApiClient.get).toHaveBeenCalledWith('tenant_features', {
      filters: { feature_key: 'chatops' },
    });
  });
});

// ============================================================================
// Tests: useUpdateTenantFeature (Mutation)
// ============================================================================

describe('useUpdateTenantFeature', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('기존 기능이 있으면 업데이트한다', async () => {
    const existingFeature = createMockFeature();
    const updatedFeature = createMockFeature({ enabled: false });

    // 기존 기능 조회
    mockApiClient.get.mockResolvedValue({
      data: [existingFeature],
      error: null,
    });

    // 업데이트
    mockApiClient.patch.mockResolvedValue({
      data: updatedFeature,
      error: null,
    });

    const { result } = renderHook(() => useUpdateTenantFeature('ai'), {
      wrapper: createWrapper(),
    });

    result.current.mutate(false);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockApiClient.patch).toHaveBeenCalledWith(
      'tenant_features',
      'feature-1',
      {
        enabled: false,
        updated_at: expect.any(String),
      },
    );
  });

  it('기존 기능이 없으면 새로 생성한다', async () => {
    const newFeature = createMockFeature({ id: 'new-feature' });

    // 기존 기능 조회 - 없음
    mockApiClient.get.mockResolvedValue({
      data: [],
      error: null,
    });

    // 생성
    mockApiClient.post.mockResolvedValue({
      data: newFeature,
      error: null,
    });

    const { result } = renderHook(() => useUpdateTenantFeature('ai'), {
      wrapper: createWrapper(),
    });

    result.current.mutate(true);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockApiClient.post).toHaveBeenCalledWith('tenant_features', {
      tenant_id: TENANT_ID,
      feature_key: 'ai',
      enabled: true,
      quota: null,
    });
  });

  it('get 응답의 data가 null일 때 새로 생성한다', async () => {
    const newFeature = createMockFeature();

    mockApiClient.get.mockResolvedValue({
      data: null,
      error: null,
    });

    mockApiClient.post.mockResolvedValue({
      data: newFeature,
      error: null,
    });

    const { result } = renderHook(() => useUpdateTenantFeature('ai'), {
      wrapper: createWrapper(),
    });

    result.current.mutate(true);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockApiClient.post).toHaveBeenCalled();
    expect(mockApiClient.patch).not.toHaveBeenCalled();
  });

  it('업데이트 API 에러 시 mutation이 실패한다', async () => {
    const existingFeature = createMockFeature();

    mockApiClient.get.mockResolvedValue({
      data: [existingFeature],
      error: null,
    });

    mockApiClient.patch.mockResolvedValue({
      data: null,
      error: { message: 'Update failed' },
    });

    const { result } = renderHook(() => useUpdateTenantFeature('ai'), {
      wrapper: createWrapper(),
    });

    result.current.mutate(false);

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error?.message).toBe('Update failed');
  });

  it('생성 API 에러 시 mutation이 실패한다', async () => {
    mockApiClient.get.mockResolvedValue({
      data: [],
      error: null,
    });

    mockApiClient.post.mockResolvedValue({
      data: null,
      error: { message: 'Create failed' },
    });

    const { result } = renderHook(() => useUpdateTenantFeature('ai'), {
      wrapper: createWrapper(),
    });

    result.current.mutate(true);

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error?.message).toBe('Create failed');
  });

  it('tenantId가 없으면 에러를 throw한다', async () => {
    vi.mocked(apiSdk.getApiContext).mockReturnValue({
      tenantId: '',
      industryType: 'academy',
    } as ReturnType<typeof apiSdk.getApiContext>);

    const { result } = renderHook(() => useUpdateTenantFeature('ai'), {
      wrapper: createWrapper(),
    });

    result.current.mutate(true);

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error?.message).toBe('Tenant ID is required');
  });
});
