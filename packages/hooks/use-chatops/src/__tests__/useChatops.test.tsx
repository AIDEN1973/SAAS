/**
 * useChatOps Hook Unit Tests
 *
 * Test targets:
 * - useChatOps: React Query mutation hook for sending ChatOps messages
 * - sendChatOpsMessageStreaming: SSE-based streaming function
 * - fetchChatOpsSessions: server session list query
 * - fetchChatOpsMessages: server message list query
 * - deleteChatOpsServerSession: server session deletion
 * - updateChatOpsSessionSummary: server session summary update
 *
 * [SSOT] apiClient.invokeFunction call pattern validation
 * [SSOT] api-sdk mediated data access only
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import type { ReactNode } from 'react';

// ===== Hoisted mock variables =====
const {
  mockInvokeFunction,
  mockApiGet,
  mockApiPatch,
  mockApiDelete,
  mockGetApiContext,
  mockMaskPII,
  mockCreateClient,
} = vi.hoisted(() => ({
  mockInvokeFunction: vi.fn(),
  mockApiGet: vi.fn(),
  mockApiPatch: vi.fn(),
  mockApiDelete: vi.fn(),
  mockGetApiContext: vi.fn(() => ({
    tenantId: 'test-tenant-id',
    industryType: 'academy',
  })),
  mockMaskPII: vi.fn((data: unknown) => data),
  mockCreateClient: vi.fn(() => ({
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: {
          session: {
            access_token: 'test-access-token',
          },
        },
      }),
    },
  })),
}));

// ===== Module mocks =====
vi.mock('@api-sdk/core', () => ({
  apiClient: {
    get: mockApiGet,
    post: vi.fn(),
    patch: mockApiPatch,
    delete: mockApiDelete,
    callRPC: vi.fn(),
    invokeFunction: (...args: unknown[]) => mockInvokeFunction(...args),
  },
  getApiContext: mockGetApiContext,
}));

vi.mock('@core/pii-utils', () => ({
  maskPII: mockMaskPII,
}));

vi.mock('@lib/supabase-client', () => ({
  createClient: mockCreateClient,
}));

vi.mock('@env-registry/client', () => ({
  envClient: {
    NEXT_PUBLIC_SUPABASE_URL: 'http://localhost:54321',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-anon-key',
  },
}));

// Import AFTER mocks
import {
  useChatOps,
  sendChatOpsMessageStreaming,
  fetchChatOpsSessions,
  fetchChatOpsMessages,
  deleteChatOpsServerSession,
  updateChatOpsSessionSummary,
} from '../useChatOps';
import type {
  ChatOpsResponse,
  ChatOpsServerSession,
  ChatOpsServerMessage,
} from '../useChatOps';

// ===== Test Wrapper =====
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
  return {
    queryClient,
    wrapper: ({ children }: { children: ReactNode }) =>
      React.createElement(QueryClientProvider, { client: queryClient }, children),
  };
}

// ===== Mock Data =====
const mockChatOpsResponse: ChatOpsResponse = {
  response: 'Hello! How can I help you?',
  intent: {
    intent_key: 'greeting',
    automation_level: 'L0',
  },
};

const mockSessions: ChatOpsServerSession[] = [
  {
    id: 'session-1',
    tenant_id: 'test-tenant-id',
    user_id: 'user-1',
    summary: 'First session',
    created_at: '2026-03-01T00:00:00Z',
    updated_at: '2026-03-01T01:00:00Z',
  },
  {
    id: 'session-2',
    tenant_id: 'test-tenant-id',
    user_id: 'user-1',
    summary: null,
    created_at: '2026-03-02T00:00:00Z',
    updated_at: '2026-03-02T01:00:00Z',
  },
];

const mockMessages: ChatOpsServerMessage[] = [
  {
    id: 1,
    session_id: 'session-1',
    tenant_id: 'test-tenant-id',
    user_id: 'user-1',
    role: 'user',
    content: 'Hello',
    intent_key: null,
    automation_level: null,
    execution_class: null,
    created_at: '2026-03-01T00:00:00Z',
  },
  {
    id: 2,
    session_id: 'session-1',
    tenant_id: 'test-tenant-id',
    user_id: 'user-1',
    role: 'assistant',
    content: 'Hi there!',
    intent_key: 'greeting',
    automation_level: 'L0',
    execution_class: null,
    created_at: '2026-03-01T00:00:01Z',
  },
];

// ============================================================================
// useChatOps Hook Tests
// ============================================================================

describe('useChatOps', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetApiContext.mockReturnValue({
      tenantId: 'test-tenant-id',
      industryType: 'academy',
    });
  });

  afterEach(() => {
    cleanup();
  });

  describe('mutation hook', () => {
    it('sends a message successfully via invokeFunction', async () => {
      mockInvokeFunction.mockResolvedValue({
        data: mockChatOpsResponse,
        error: null,
      });

      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useChatOps(), { wrapper });

      await act(async () => {
        await result.current.mutateAsync({
          sessionId: 'session-1',
          message: 'Hello',
        });
      });

      expect(mockInvokeFunction).toHaveBeenCalledWith('chatops', {
        session_id: 'session-1',
        message: 'Hello',
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });
      expect(result.current.data).toEqual(mockChatOpsResponse);
    });

    it('trims the message before sending', async () => {
      mockInvokeFunction.mockResolvedValue({
        data: mockChatOpsResponse,
        error: null,
      });

      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useChatOps(), { wrapper });

      await act(async () => {
        await result.current.mutateAsync({
          sessionId: 'session-1',
          message: '  Hello  ',
        });
      });

      expect(mockInvokeFunction).toHaveBeenCalledWith('chatops', {
        session_id: 'session-1',
        message: 'Hello',
      });
    });

    it('throws error when tenantId is missing', async () => {
      mockGetApiContext.mockReturnValue({ tenantId: '', industryType: 'academy' });

      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useChatOps(), { wrapper });

      await expect(
        result.current.mutateAsync({
          sessionId: 'session-1',
          message: 'Hello',
        })
      ).rejects.toThrow('Tenant ID is required');
    });

    it('throws error when sessionId is empty', async () => {
      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useChatOps(), { wrapper });

      await expect(
        result.current.mutateAsync({
          sessionId: '',
          message: 'Hello',
        })
      ).rejects.toThrow('Session ID is required');
    });

    it('throws error when message is empty', async () => {
      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useChatOps(), { wrapper });

      await expect(
        result.current.mutateAsync({
          sessionId: 'session-1',
          message: '   ',
        })
      ).rejects.toThrow('Message is required');
    });

    it('throws error when API returns error response', async () => {
      mockInvokeFunction.mockResolvedValue({
        data: null,
        error: { message: 'Edge Function error' },
      });

      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useChatOps(), { wrapper });

      await expect(
        result.current.mutateAsync({
          sessionId: 'session-1',
          message: 'Hello',
        })
      ).rejects.toThrow('Edge Function error');
    });

    it('throws error when API returns null data', async () => {
      mockInvokeFunction.mockResolvedValue({
        data: null,
        error: null,
      });

      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useChatOps(), { wrapper });

      await expect(
        result.current.mutateAsync({
          sessionId: 'session-1',
          message: 'Hello',
        })
      ).rejects.toThrow('ChatOps 응답이 없습니다.');
    });

    it('calls maskPII on error for safe logging', async () => {
      const testError = new Error('Some sensitive error');
      mockInvokeFunction.mockRejectedValue(testError);

      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useChatOps(), { wrapper });

      try {
        await result.current.mutateAsync({
          sessionId: 'session-1',
          message: 'Hello',
        });
      } catch {
        // Expected to throw
      }

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(mockMaskPII).toHaveBeenCalled();
    });

    it('returns intent data with L2 execution class', async () => {
      const l2Response: ChatOpsResponse = {
        response: 'Scheduling confirmed',
        intent: {
          intent_key: 'schedule_class',
          automation_level: 'L2',
          execution_class: 'A',
          params: { class_id: 'cls-1', date: '2026-03-10' },
        },
        task_card_id: 'task-card-1',
      };

      mockInvokeFunction.mockResolvedValue({
        data: l2Response,
        error: null,
      });

      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useChatOps(), { wrapper });

      await act(async () => {
        await result.current.mutateAsync({
          sessionId: 'session-1',
          message: 'Schedule a class',
        });
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.intent?.automation_level).toBe('L2');
      expect(result.current.data?.intent?.execution_class).toBe('A');
      expect(result.current.data?.task_card_id).toBe('task-card-1');
    });
  });
});

// ============================================================================
// fetchChatOpsSessions Tests
// ============================================================================

describe('fetchChatOpsSessions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetApiContext.mockReturnValue({
      tenantId: 'test-tenant-id',
      industryType: 'academy',
    });
  });

  it('fetches sessions successfully', async () => {
    mockApiGet.mockResolvedValue({
      data: mockSessions,
      error: null,
    });

    const result = await fetchChatOpsSessions();

    expect(mockApiGet).toHaveBeenCalledWith('chatops_sessions', {
      select: 'id, tenant_id, user_id, summary, created_at, updated_at',
      orderBy: { column: 'updated_at', ascending: false },
      limit: 50,
    });
    expect(result).toEqual(mockSessions);
  });

  it('uses custom limit parameter', async () => {
    mockApiGet.mockResolvedValue({
      data: [],
      error: null,
    });

    await fetchChatOpsSessions(10);

    expect(mockApiGet).toHaveBeenCalledWith('chatops_sessions', expect.objectContaining({
      limit: 10,
    }));
  });

  it('returns empty array when tenantId is missing', async () => {
    mockGetApiContext.mockReturnValue({ tenantId: null });

    const result = await fetchChatOpsSessions();

    expect(result).toEqual([]);
    expect(mockApiGet).not.toHaveBeenCalled();
  });

  it('throws error on API failure', async () => {
    mockApiGet.mockResolvedValue({
      data: null,
      error: { message: 'Database error' },
    });

    await expect(fetchChatOpsSessions()).rejects.toThrow('Database error');
  });

  it('returns empty array when data is null', async () => {
    mockApiGet.mockResolvedValue({
      data: null,
      error: null,
    });

    const result = await fetchChatOpsSessions();
    expect(result).toEqual([]);
  });
});

// ============================================================================
// fetchChatOpsMessages Tests
// ============================================================================

describe('fetchChatOpsMessages', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetApiContext.mockReturnValue({
      tenantId: 'test-tenant-id',
      industryType: 'academy',
    });
  });

  it('fetches messages for a session successfully', async () => {
    mockApiGet.mockResolvedValue({
      data: mockMessages,
      error: null,
    });

    const result = await fetchChatOpsMessages('session-1');

    expect(mockApiGet).toHaveBeenCalledWith('chatops_messages', {
      select: 'id, session_id, tenant_id, user_id, role, content, intent_key, automation_level, execution_class, created_at',
      filters: { session_id: 'session-1' },
      orderBy: { column: 'created_at', ascending: true },
      limit: 100,
    });
    expect(result).toEqual(mockMessages);
  });

  it('uses custom limit parameter', async () => {
    mockApiGet.mockResolvedValue({
      data: [],
      error: null,
    });

    await fetchChatOpsMessages('session-1', 20);

    expect(mockApiGet).toHaveBeenCalledWith('chatops_messages', expect.objectContaining({
      limit: 20,
    }));
  });

  it('returns empty array when sessionId is empty', async () => {
    const result = await fetchChatOpsMessages('');

    expect(result).toEqual([]);
    expect(mockApiGet).not.toHaveBeenCalled();
  });

  it('returns empty array when tenantId is missing', async () => {
    mockGetApiContext.mockReturnValue({ tenantId: null });

    const result = await fetchChatOpsMessages('session-1');

    expect(result).toEqual([]);
    expect(mockApiGet).not.toHaveBeenCalled();
  });

  it('throws error on API failure', async () => {
    mockApiGet.mockResolvedValue({
      data: null,
      error: { message: 'Network error' },
    });

    await expect(fetchChatOpsMessages('session-1')).rejects.toThrow('Network error');
  });
});

// ============================================================================
// deleteChatOpsServerSession Tests
// ============================================================================

describe('deleteChatOpsServerSession', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetApiContext.mockReturnValue({
      tenantId: 'test-tenant-id',
      industryType: 'academy',
    });
  });

  it('deletes a session successfully', async () => {
    mockApiDelete.mockResolvedValue({
      data: null,
      error: null,
    });

    await deleteChatOpsServerSession('session-1');

    expect(mockApiDelete).toHaveBeenCalledWith('chatops_sessions', 'session-1');
  });

  it('throws error when sessionId is empty', async () => {
    await expect(deleteChatOpsServerSession('')).rejects.toThrow('Session ID is required');
  });

  it('silently skips when tenantId is missing', async () => {
    mockGetApiContext.mockReturnValue({ tenantId: null });

    await deleteChatOpsServerSession('session-1');

    expect(mockApiDelete).not.toHaveBeenCalled();
  });

  it('throws error on API failure', async () => {
    mockApiDelete.mockResolvedValue({
      data: null,
      error: { message: 'Delete failed' },
    });

    await expect(deleteChatOpsServerSession('session-1')).rejects.toThrow('Delete failed');
  });
});

// ============================================================================
// updateChatOpsSessionSummary Tests
// ============================================================================

describe('updateChatOpsSessionSummary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetApiContext.mockReturnValue({
      tenantId: 'test-tenant-id',
      industryType: 'academy',
    });
  });

  it('updates session summary successfully', async () => {
    mockApiPatch.mockResolvedValue({
      data: null,
      error: null,
    });

    await updateChatOpsSessionSummary('session-1', 'Updated summary');

    expect(mockApiPatch).toHaveBeenCalledWith('chatops_sessions', 'session-1', {
      summary: 'Updated summary',
    });
  });

  it('truncates summary to 200 characters', async () => {
    mockApiPatch.mockResolvedValue({
      data: null,
      error: null,
    });

    const longSummary = 'A'.repeat(300);
    await updateChatOpsSessionSummary('session-1', longSummary);

    expect(mockApiPatch).toHaveBeenCalledWith('chatops_sessions', 'session-1', {
      summary: 'A'.repeat(200),
    });
  });

  it('throws error when sessionId is empty', async () => {
    await expect(updateChatOpsSessionSummary('', 'summary')).rejects.toThrow(
      'Session ID is required'
    );
  });

  it('silently skips when tenantId is missing', async () => {
    mockGetApiContext.mockReturnValue({ tenantId: null });

    await updateChatOpsSessionSummary('session-1', 'summary');

    expect(mockApiPatch).not.toHaveBeenCalled();
  });

  it('throws error on API failure', async () => {
    mockApiPatch.mockResolvedValue({
      data: null,
      error: { message: 'Update failed' },
    });

    await expect(
      updateChatOpsSessionSummary('session-1', 'summary')
    ).rejects.toThrow('Update failed');
  });
});

// ============================================================================
// sendChatOpsMessageStreaming Tests
// ============================================================================

describe('sendChatOpsMessageStreaming', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetApiContext.mockReturnValue({
      tenantId: 'test-tenant-id',
      industryType: 'academy',
    });
    // Reset the global fetch mock
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('throws error when tenantId is empty', async () => {
    const onChunk = vi.fn();
    const onComplete = vi.fn();
    const onError = vi.fn();

    await expect(
      sendChatOpsMessageStreaming('', 'session-1', 'Hello', onChunk, onComplete, onError)
    ).rejects.toThrow('Tenant ID is required');
  });

  it('throws error when sessionId is empty', async () => {
    const onChunk = vi.fn();
    const onComplete = vi.fn();
    const onError = vi.fn();

    await expect(
      sendChatOpsMessageStreaming('test-tenant-id', '', 'Hello', onChunk, onComplete, onError)
    ).rejects.toThrow('Session ID is required');
  });

  it('throws error when message is empty or whitespace', async () => {
    const onChunk = vi.fn();
    const onComplete = vi.fn();
    const onError = vi.fn();

    await expect(
      sendChatOpsMessageStreaming('test-tenant-id', 'session-1', '   ', onChunk, onComplete, onError)
    ).rejects.toThrow('Message is required');
  });

  it('processes SSE content and done events correctly', async () => {
    const onChunk = vi.fn();
    const onComplete = vi.fn();
    const onError = vi.fn();
    const onStatus = vi.fn();

    // Create a mock ReadableStream
    const sseData = [
      'data: {"type":"status","message":"Processing..."}\n\n',
      'data: {"type":"content","content":"Hello "}\n\n',
      'data: {"type":"content","content":"world!"}\n\n',
      'data: {"type":"done","response":"Hello world!"}\n\n',
    ].join('');

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(sseData));
        controller.close();
      },
    });

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      body: stream,
    });
    vi.stubGlobal('fetch', mockFetch);

    await sendChatOpsMessageStreaming(
      'test-tenant-id',
      'session-1',
      'Hello',
      onChunk,
      onComplete,
      onError,
      onStatus
    );

    expect(onStatus).toHaveBeenCalledWith('Processing...');
    expect(onChunk).toHaveBeenCalledWith('Hello ');
    expect(onChunk).toHaveBeenCalledWith('world!');
    expect(onComplete).toHaveBeenCalledWith('Hello world!');
    expect(onError).not.toHaveBeenCalled();
  });

  it('handles HTTP error response', async () => {
    const onChunk = vi.fn();
    const onComplete = vi.fn();
    const onError = vi.fn();

    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
    });
    vi.stubGlobal('fetch', mockFetch);

    await expect(
      sendChatOpsMessageStreaming(
        'test-tenant-id',
        'session-1',
        'Hello',
        onChunk,
        onComplete,
        onError
      )
    ).rejects.toThrow('HTTP error! status: 500');

    expect(onError).toHaveBeenCalledWith('HTTP error! status: 500');
  });

  it('handles SSE error events', async () => {
    const onChunk = vi.fn();
    const onComplete = vi.fn();
    const onError = vi.fn();

    const sseData = 'data: {"type":"error","error":"Internal error"}\n\n';
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(sseData));
        controller.close();
      },
    });

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      body: stream,
    });
    vi.stubGlobal('fetch', mockFetch);

    await sendChatOpsMessageStreaming(
      'test-tenant-id',
      'session-1',
      'Hello',
      onChunk,
      onComplete,
      onError
    );

    expect(onError).toHaveBeenCalledWith('Internal error');
  });

  it('sends request with stream: true parameter', async () => {
    const onChunk = vi.fn();
    const onComplete = vi.fn();
    const onError = vi.fn();

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode('data: {"type":"done","response":"Done"}\n\n'));
        controller.close();
      },
    });

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      body: stream,
    });
    vi.stubGlobal('fetch', mockFetch);

    await sendChatOpsMessageStreaming(
      'test-tenant-id',
      'session-1',
      'Hello',
      onChunk,
      onComplete,
      onError
    );

    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:54321/functions/v1/chatops',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-access-token',
        }),
        body: JSON.stringify({
          session_id: 'session-1',
          message: 'Hello',
          stream: true,
        }),
      })
    );
  });
});
