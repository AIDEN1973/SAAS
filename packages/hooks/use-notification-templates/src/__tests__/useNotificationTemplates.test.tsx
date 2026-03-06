/**
 * useNotificationTemplates Hook Unit Tests
 *
 * Test scope:
 * - useNotificationTemplates: query hook for fetching notification templates
 * - fetchNotificationTemplates: exported standalone function
 * - useCreateNotificationTemplate: mutation hook for creating templates
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
  },
  getApiContext: vi.fn(() => ({
    tenantId: 'test-tenant-id',
    industryType: 'academy',
  })),
}));

// ============================================================================
// Imports (after mocks due to hoisting)
// ============================================================================

import {
  useNotificationTemplates,
  useCreateNotificationTemplate,
  fetchNotificationTemplates,
} from '../useNotificationTemplates';
import type { NotificationTemplate, CreateNotificationTemplateInput } from '../useNotificationTemplates';

// ============================================================================
// Test Helpers
// ============================================================================

const TENANT_ID = 'test-tenant-id';

const mockApiClient = apiSdk.apiClient as {
  get: ReturnType<typeof vi.fn>;
  post: ReturnType<typeof vi.fn>;
  patch: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
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

function createMockTemplate(overrides?: Partial<NotificationTemplate>): NotificationTemplate {
  return {
    id: 'template-1',
    name: 'Welcome Message',
    channel: 'kakao',
    content: 'Welcome to our academy, {{student_name}}!',
    created_at: '2026-02-01T00:00:00Z',
    updated_at: '2026-02-01T00:00:00Z',
    ...overrides,
  };
}

// ============================================================================
// Tests: fetchNotificationTemplates (Standalone Function)
// ============================================================================

describe('fetchNotificationTemplates', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns templates on success', async () => {
    const mockTemplates = [
      createMockTemplate(),
      createMockTemplate({ id: 'template-2', name: 'Reminder', channel: 'sms' }),
    ];

    mockApiClient.get.mockResolvedValue({
      data: mockTemplates,
      error: null,
    });

    const result = await fetchNotificationTemplates(TENANT_ID);

    expect(result).toEqual(mockTemplates);
    expect(mockApiClient.get).toHaveBeenCalledWith('notification_templates', {
      filters: {},
      orderBy: { column: 'created_at', ascending: false },
    });
  });

  it('returns empty array when tenantId is empty', async () => {
    const result = await fetchNotificationTemplates('');

    expect(result).toEqual([]);
    expect(mockApiClient.get).not.toHaveBeenCalled();
  });

  it('applies channel filter', async () => {
    mockApiClient.get.mockResolvedValue({
      data: [],
      error: null,
    });

    await fetchNotificationTemplates(TENANT_ID, { channel: 'sms' });

    expect(mockApiClient.get).toHaveBeenCalledWith('notification_templates', {
      filters: { channel: 'sms' },
      orderBy: { column: 'created_at', ascending: false },
    });
  });

  it('applies name filter', async () => {
    mockApiClient.get.mockResolvedValue({
      data: [],
      error: null,
    });

    await fetchNotificationTemplates(TENANT_ID, { name: 'Welcome' });

    expect(mockApiClient.get).toHaveBeenCalledWith('notification_templates', {
      filters: { name: 'Welcome' },
      orderBy: { column: 'created_at', ascending: false },
    });
  });

  it('returns empty array on null data', async () => {
    mockApiClient.get.mockResolvedValue({
      data: null,
      error: null,
    });

    const result = await fetchNotificationTemplates(TENANT_ID);

    expect(result).toEqual([]);
  });

  it('returns empty array when table does not exist (graceful)', async () => {
    mockApiClient.get.mockResolvedValue({
      data: null,
      error: { message: 'relation "notification_templates" does not exist' },
    });

    const result = await fetchNotificationTemplates(TENANT_ID);

    expect(result).toEqual([]);
  });

  it('returns empty array on generic error (catch fallback)', async () => {
    mockApiClient.get.mockRejectedValue(new Error('Network error'));

    const result = await fetchNotificationTemplates(TENANT_ID);

    expect(result).toEqual([]);
  });

  it('returns empty array on non-relation error message containing "does not exist"', async () => {
    mockApiClient.get.mockResolvedValue({
      data: null,
      error: { message: 'column "foo" does not exist' },
    });

    const result = await fetchNotificationTemplates(TENANT_ID);

    expect(result).toEqual([]);
  });
});

// ============================================================================
// Tests: useNotificationTemplates (Query Hook)
// ============================================================================

describe('useNotificationTemplates', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns template data on success', async () => {
    const mockTemplates = [createMockTemplate()];

    mockApiClient.get.mockResolvedValue({
      data: mockTemplates,
      error: null,
    });

    const { result } = renderHook(() => useNotificationTemplates(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(mockTemplates);
  });

  it('passes filter to fetchNotificationTemplates', async () => {
    mockApiClient.get.mockResolvedValue({
      data: [],
      error: null,
    });

    const { result } = renderHook(
      () => useNotificationTemplates({ channel: 'email' }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockApiClient.get).toHaveBeenCalledWith('notification_templates', {
      filters: { channel: 'email' },
      orderBy: { column: 'created_at', ascending: false },
    });
  });

  it('is disabled when tenantId is empty', async () => {
    vi.mocked(apiSdk.getApiContext).mockReturnValueOnce({
      tenantId: '',
      industryType: 'academy',
    } as ReturnType<typeof apiSdk.getApiContext>);

    const { result } = renderHook(() => useNotificationTemplates(), {
      wrapper: createWrapper(),
    });

    expect(result.current.fetchStatus).toBe('idle');
    expect(mockApiClient.get).not.toHaveBeenCalled();
  });
});

// ============================================================================
// Tests: useCreateNotificationTemplate (Mutation Hook)
// ============================================================================

describe('useCreateNotificationTemplate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a template on success', async () => {
    const createdTemplate = createMockTemplate({ id: 'new-template', name: 'New Template' });

    mockApiClient.post.mockResolvedValue({
      data: createdTemplate,
      error: null,
    });

    const { result } = renderHook(() => useCreateNotificationTemplate(), {
      wrapper: createWrapper(),
    });

    const input: CreateNotificationTemplateInput = {
      name: 'New Template',
      channel: 'sms',
      content: 'Hello {{student_name}}',
    };

    result.current.mutate(input);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(createdTemplate);
    expect(mockApiClient.post).toHaveBeenCalledWith('notification_templates', {
      tenant_id: TENANT_ID,
      name: 'New Template',
      channel: 'sms',
      content: 'Hello {{student_name}}',
    });
  });

  it('uses default channel (kakao_at) when channel is not provided', async () => {
    const createdTemplate = createMockTemplate({ id: 'new-template' });

    mockApiClient.post.mockResolvedValue({
      data: createdTemplate,
      error: null,
    });

    const { result } = renderHook(() => useCreateNotificationTemplate(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({
      name: 'Kakao Template',
      content: 'Hello!',
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockApiClient.post).toHaveBeenCalledWith('notification_templates', {
      tenant_id: TENANT_ID,
      name: 'Kakao Template',
      channel: 'kakao_at',
      content: 'Hello!',
    });
  });

  it('fails on API error', async () => {
    mockApiClient.post.mockResolvedValue({
      data: null,
      error: { message: 'Duplicate template name' },
    });

    const { result } = renderHook(() => useCreateNotificationTemplate(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({
      name: 'Duplicate',
      content: 'content',
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error?.message).toBe('Duplicate template name');
  });

  it('throws when tenantId is missing', async () => {
    vi.mocked(apiSdk.getApiContext).mockReturnValue({
      tenantId: '',
      industryType: 'academy',
    } as ReturnType<typeof apiSdk.getApiContext>);

    const { result } = renderHook(() => useCreateNotificationTemplate(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({
      name: 'Template',
      content: 'content',
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error?.message).toBe('tenantId is required');
  });
});
