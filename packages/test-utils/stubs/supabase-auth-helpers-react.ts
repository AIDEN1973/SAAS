/**
 * Stub for @supabase/auth-helpers-react
 *
 * This package is listed as a peer dependency but not installed.
 * This stub allows Vite to resolve the import so vi.mock() can intercept it in tests.
 */

export function useSupabaseClient() {
  return {
    functions: {
      invoke: async () => ({ data: null, error: null }),
    },
    from: () => ({
      select: () => ({ data: null, error: null }),
    }),
  };
}

export function useSession() {
  return { data: null, error: null, isLoading: false };
}

export function useUser() {
  return null;
}
