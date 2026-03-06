/**
 * useProactiveAlerts Hook Unit Tests
 *
 * Test scope:
 * - useProactiveAlerts: query hook for fetching proactive alerts
 * - useMarkAlertAsRead: mutation hook for marking alerts as read
 * - useDismissAlert: mutation hook for dismissing alerts
 * - useProactiveAlertTriggers: query hook for fetching triggers
 * - useCreateProactiveAlertTrigger: mutation hook for creating triggers
 * - useUpdateProactiveAlertTrigger: mutation hook for updating triggers
 * - useDeleteProactiveAlertTrigger: mutation hook for deleting triggers
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
  useProactiveAlerts,
  useMarkAlertAsRead,
  useDismissAlert,
  useProactiveAlertTriggers,
  useCreateProactiveAlertTrigger,
  useUpdateProactiveAlertTrigger,
  useDeleteProactiveAlertTrigger,
} from '../index';
import type { ProactiveAlert, ProactiveAlertTrigger } from '../index';

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

function createMockAlert(overrides?: Partial<ProactiveAlert>): ProactiveAlert {
  return {
    id: 'alert-1',
    tenant_id: TENANT_ID,
    trigger_id: 'trigger-1',
    trigger_type: 'attendance_drop',
    title: 'Attendance Drop Detected',
    message: 'Attendance dropped by 20%',
    severity: 'warning',
    recommended_actions: [
      { action: 'send_notification', label: 'Send Notification', params: {} },
    ],
    detected_data: { drop_percent: 20 },
    is_read: false,
    is_dismissed: false,
    created_at: '2026-03-01T00:00:00Z',
    read_at: null,
    dismissed_at: null,
    ...overrides,
  };
}

function createMockTrigger(overrides?: Partial<ProactiveAlertTrigger>): ProactiveAlertTrigger {
  return {
    id: 'trigger-1',
    tenant_id: TENANT_ID,
    name: 'Attendance Drop Trigger',
    description: 'Detects attendance drops',
    trigger_type: 'attendance_drop',
    config: { threshold_percent: 20, period_days: 7 },
    is_active: true,
    last_triggered_at: null,
    last_check_at: null,
    created_at: '2026-02-01T00:00:00Z',
    updated_at: '2026-02-01T00:00:00Z',
    ...overrides,
  };
}

// ============================================================================
// Tests: useProactiveAlerts (Query Hook)
// ============================================================================

describe('useProactiveAlerts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns alert data on success', async () => {
    const mockAlerts = [createMockAlert(), createMockAlert({ id: 'alert-2' })];

    mockApiClient.get.mockResolvedValue({
      data: mockAlerts,
      error: null,
    });

    const { result } = renderHook(() => useProactiveAlerts(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(mockAlerts);
    expect(mockApiClient.get).toHaveBeenCalledWith('proactive_alerts', {
      filters: {},
      orderBy: { column: 'created_at', ascending: false },
    });
  });

  it('applies onlyUnread filter when specified', async () => {
    mockApiClient.get.mockResolvedValue({
      data: [],
      error: null,
    });

    const { result } = renderHook(() => useProactiveAlerts({ onlyUnread: true }), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockApiClient.get).toHaveBeenCalledWith('proactive_alerts', {
      filters: { is_read: false, is_dismissed: false },
      orderBy: { column: 'created_at', ascending: false },
    });
  });

  it('returns empty array when API returns null data', async () => {
    mockApiClient.get.mockResolvedValue({
      data: null,
      error: null,
    });

    const { result } = renderHook(() => useProactiveAlerts(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual([]);
  });

  it('is disabled when tenantId is empty', async () => {
    vi.mocked(apiSdk.getApiContext).mockReturnValueOnce({
      tenantId: '',
      industryType: 'academy',
    } as ReturnType<typeof apiSdk.getApiContext>);

    const { result } = renderHook(() => useProactiveAlerts(), {
      wrapper: createWrapper(),
    });

    expect(result.current.fetchStatus).toBe('idle');
    expect(mockApiClient.get).not.toHaveBeenCalled();
  });

  it('throws on API error', async () => {
    mockApiClient.get.mockResolvedValue({
      data: null,
      error: { message: 'Server error' },
    });

    const { result } = renderHook(() => useProactiveAlerts(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error?.message).toBe('Server error');
  });
});

// ============================================================================
// Tests: useMarkAlertAsRead (Mutation Hook)
// ============================================================================

describe('useMarkAlertAsRead', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('marks an alert as read on success', async () => {
    const updatedAlert = createMockAlert({ is_read: true, read_at: '2026-03-06T00:00:00Z' });

    mockApiClient.patch.mockResolvedValue({
      data: updatedAlert,
      error: null,
    });

    const { result } = renderHook(() => useMarkAlertAsRead(), {
      wrapper: createWrapper(),
    });

    result.current.mutate('alert-1');

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(updatedAlert);
    expect(mockApiClient.patch).toHaveBeenCalledWith(
      'proactive_alerts',
      'alert-1',
      expect.objectContaining({ is_read: true, read_at: expect.any(String) }),
    );
  });

  it('fails on API error', async () => {
    mockApiClient.patch.mockResolvedValue({
      data: null,
      error: { message: 'Alert not found' },
    });

    const { result } = renderHook(() => useMarkAlertAsRead(), {
      wrapper: createWrapper(),
    });

    result.current.mutate('nonexistent-alert');

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error?.message).toBe('Alert not found');
  });
});

// ============================================================================
// Tests: useDismissAlert (Mutation Hook)
// ============================================================================

describe('useDismissAlert', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('dismisses an alert on success', async () => {
    const dismissedAlert = createMockAlert({ is_dismissed: true, dismissed_at: '2026-03-06T00:00:00Z' });

    mockApiClient.patch.mockResolvedValue({
      data: dismissedAlert,
      error: null,
    });

    const { result } = renderHook(() => useDismissAlert(), {
      wrapper: createWrapper(),
    });

    result.current.mutate('alert-1');

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(dismissedAlert);
    expect(mockApiClient.patch).toHaveBeenCalledWith(
      'proactive_alerts',
      'alert-1',
      expect.objectContaining({ is_dismissed: true, dismissed_at: expect.any(String) }),
    );
  });

  it('fails on API error', async () => {
    mockApiClient.patch.mockResolvedValue({
      data: null,
      error: { message: 'Permission denied' },
    });

    const { result } = renderHook(() => useDismissAlert(), {
      wrapper: createWrapper(),
    });

    result.current.mutate('alert-1');

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error?.message).toBe('Permission denied');
  });
});

// ============================================================================
// Tests: useProactiveAlertTriggers (Query Hook)
// ============================================================================

describe('useProactiveAlertTriggers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns trigger data on success', async () => {
    const mockTriggers = [createMockTrigger(), createMockTrigger({ id: 'trigger-2', name: 'Billing Overdue' })];

    mockApiClient.get.mockResolvedValue({
      data: mockTriggers,
      error: null,
    });

    const { result } = renderHook(() => useProactiveAlertTriggers(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(mockTriggers);
    expect(mockApiClient.get).toHaveBeenCalledWith('proactive_alert_triggers', {
      orderBy: { column: 'created_at', ascending: false },
    });
  });

  it('is disabled when tenantId is empty', async () => {
    vi.mocked(apiSdk.getApiContext).mockReturnValueOnce({
      tenantId: '',
      industryType: 'academy',
    } as ReturnType<typeof apiSdk.getApiContext>);

    const { result } = renderHook(() => useProactiveAlertTriggers(), {
      wrapper: createWrapper(),
    });

    expect(result.current.fetchStatus).toBe('idle');
    expect(mockApiClient.get).not.toHaveBeenCalled();
  });

  it('throws on API error', async () => {
    mockApiClient.get.mockResolvedValue({
      data: null,
      error: { message: 'Fetch failed' },
    });

    const { result } = renderHook(() => useProactiveAlertTriggers(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error?.message).toBe('Fetch failed');
  });
});

// ============================================================================
// Tests: useCreateProactiveAlertTrigger (Mutation Hook)
// ============================================================================

describe('useCreateProactiveAlertTrigger', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a trigger on success', async () => {
    const createdTrigger = createMockTrigger({ id: 'new-trigger' });

    mockApiClient.post.mockResolvedValue({
      data: createdTrigger,
      error: null,
    });

    const { result } = renderHook(() => useCreateProactiveAlertTrigger(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({
      name: 'New Trigger',
      trigger_type: 'filter_tag_spike',
      config: { tag_ids: ['tag-1'], threshold_percent: 50 },
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(createdTrigger);
    expect(mockApiClient.post).toHaveBeenCalledWith('proactive_alert_triggers', {
      name: 'New Trigger',
      trigger_type: 'filter_tag_spike',
      config: { tag_ids: ['tag-1'], threshold_percent: 50 },
    });
  });

  it('fails on API error', async () => {
    mockApiClient.post.mockResolvedValue({
      data: null,
      error: { message: 'Duplicate trigger name' },
    });

    const { result } = renderHook(() => useCreateProactiveAlertTrigger(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({
      name: 'Duplicate',
      trigger_type: 'attendance_drop',
      config: {},
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error?.message).toBe('Duplicate trigger name');
  });
});

// ============================================================================
// Tests: useUpdateProactiveAlertTrigger (Mutation Hook)
// ============================================================================

describe('useUpdateProactiveAlertTrigger', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('updates a trigger on success', async () => {
    const updatedTrigger = createMockTrigger({ config: { threshold_percent: 60 } });

    mockApiClient.patch.mockResolvedValue({
      data: updatedTrigger,
      error: null,
    });

    const { result } = renderHook(() => useUpdateProactiveAlertTrigger(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({
      id: 'trigger-1',
      config: { threshold_percent: 60 },
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(updatedTrigger);
    expect(mockApiClient.patch).toHaveBeenCalledWith(
      'proactive_alert_triggers',
      'trigger-1',
      { config: { threshold_percent: 60 } },
    );
  });

  it('fails on API error', async () => {
    mockApiClient.patch.mockResolvedValue({
      data: null,
      error: { message: 'Trigger not found' },
    });

    const { result } = renderHook(() => useUpdateProactiveAlertTrigger(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({ id: 'nonexistent', is_active: false });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error?.message).toBe('Trigger not found');
  });
});

// ============================================================================
// Tests: useDeleteProactiveAlertTrigger (Mutation Hook)
// ============================================================================

describe('useDeleteProactiveAlertTrigger', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deletes a trigger on success', async () => {
    mockApiClient.delete.mockResolvedValue({
      data: null,
      error: null,
    });

    const { result } = renderHook(() => useDeleteProactiveAlertTrigger(), {
      wrapper: createWrapper(),
    });

    result.current.mutate('trigger-1');

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockApiClient.delete).toHaveBeenCalledWith('proactive_alert_triggers', 'trigger-1');
  });

  it('fails on API error', async () => {
    mockApiClient.delete.mockResolvedValue({
      data: null,
      error: { message: 'Cannot delete active trigger' },
    });

    const { result } = renderHook(() => useDeleteProactiveAlertTrigger(), {
      wrapper: createWrapper(),
    });

    result.current.mutate('trigger-1');

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error?.message).toBe('Cannot delete active trigger');
  });
});
