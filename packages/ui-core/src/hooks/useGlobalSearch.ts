/**
 * useGlobalSearch Hook
 *
 * 글로벌 검색 기능을 위한 React Hook (Phase 2: PostgreSQL FTS 기반)
 * [불변 규칙] 검색 디바운스 적용 (300ms)
 * [불변 규칙] 빈 검색어는 API 호출하지 않음
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import type { SearchResult, SearchEntityType } from '../components/GlobalSearchResults';

/**
 * 검색 입력 파라미터
 */
export interface SearchInput {
  query: string;
  entity_types?: SearchEntityType[];
  limit?: number;
}

/**
 * 기본 검색 엔티티 타입
 */
export const DEFAULT_SEARCH_ENTITY_TYPES: SearchEntityType[] = [
  'student',
  'teacher',
  'class',
  'guardian',
  'consultation',
  'announcement',
  'tag',
];

/**
 * 엔티티 타입별 기본 라벨 (업종 중립)
 * [불변 규칙] UI-Core는 업종 중립적 기본값만 제공
 * [불변 규칙] 업종별 라벨은 App에서 IndustryTerms를 통해 오버라이드
 */
export const SEARCH_ENTITY_TYPE_LABELS: Record<SearchEntityType, string> = {
  student: 'Primary Person',
  teacher: 'Secondary Person',
  class: 'Group',
  guardian: 'Guardian',
  consultation: 'Consultation',
  announcement: 'Announcement',
  tag: 'Tag',
};

/**
 * 엔티티 타입별 아이콘 이름 (Phosphor Icons)
 */
export const SEARCH_ENTITY_TYPE_ICONS: Record<SearchEntityType, string> = {
  student: 'User',
  teacher: 'Chalkboard',
  class: 'Chalkboard',
  guardian: 'Users',
  consultation: 'ChatCircle',
  announcement: 'Megaphone',
  tag: 'Tag',
};

export interface UseGlobalSearchOptions {
  /** 디바운스 시간 (ms), 기본값: 300 */
  debounceMs?: number;
  /** 기본 검색 엔티티 타입 */
  defaultEntityTypes?: SearchEntityType[];
  /** 기본 결과 제한 */
  defaultLimit?: number;
  /** 테넌트 ID (필수) */
  tenantId: string;
  /** 검색 API 호출 함수 */
  onSearch: (input: SearchInput) => Promise<SearchResult[]>;
}

export interface UseGlobalSearchReturn {
  /** 검색어 */
  query: string;
  /** 검색어 변경 */
  setQuery: (query: string) => void;
  /** 검색 결과 */
  results: SearchResult[];
  /** 로딩 상태 */
  loading: boolean;
  /** 에러 상태 */
  error: string | null;
  /** 검색 실행 (디바운스 없이 즉시) */
  search: () => Promise<void>;
  /** 검색 결과 초기화 */
  clear: () => void;
  /** 검색 엔티티 타입 필터 */
  entityTypes: SearchEntityType[];
  /** 검색 엔티티 타입 필터 변경 */
  setEntityTypes: (types: SearchEntityType[]) => void;
  /** 검색 결과 그룹화 (엔티티 타입별) */
  groupedResults: Record<SearchEntityType, SearchResult[]>;
  /** 검색 결과 개수 */
  resultCount: number;
  /** 검색창 열림 상태 */
  isOpen: boolean;
  /** 검색창 열기 */
  open: () => void;
  /** 검색창 닫기 */
  close: () => void;
}

/**
 * 글로벌 검색 Hook
 */
export function useGlobalSearch(options: UseGlobalSearchOptions): UseGlobalSearchReturn {
  const {
    debounceMs = 300,
    defaultEntityTypes = DEFAULT_SEARCH_ENTITY_TYPES,
    defaultLimit = 20,
    onSearch,
  } = options;

  const [query, setQueryState] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [entityTypes, setEntityTypes] = useState<SearchEntityType[]>(defaultEntityTypes);
  const [isOpen, setIsOpen] = useState(false);

  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // 검색 실행
  const executeSearch = useCallback(async (searchQuery: string) => {
    const trimmedQuery = searchQuery.trim();

    // 빈 검색어 처리
    if (!trimmedQuery) {
      setResults([]);
      setError(null);
      return;
    }

    // 이전 요청 취소
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    setLoading(true);
    setError(null);

    try {
      const searchResults = await onSearch({
        query: trimmedQuery,
        entity_types: entityTypes,
        limit: defaultLimit,
      });

      // 요청이 취소되지 않았는지 확인
      if (!abortControllerRef.current?.signal.aborted) {
        setResults(searchResults);
      }
    } catch (err) {
      if (!abortControllerRef.current?.signal.aborted) {
        const errorMessage = err instanceof Error ? err.message : '검색 중 오류가 발생했습니다.';
        setError(errorMessage);
        setResults([]);
      }
    } finally {
      if (!abortControllerRef.current?.signal.aborted) {
        setLoading(false);
      }
    }
  }, [entityTypes, defaultLimit, onSearch]);

  // 디바운스된 검색
  const setQuery = useCallback((newQuery: string) => {
    setQueryState(newQuery);

    // 이전 디바운스 타이머 취소
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // 빈 검색어는 즉시 결과 초기화
    if (!newQuery.trim()) {
      setResults([]);
      setError(null);
      return;
    }

    // 디바운스 적용
    debounceTimerRef.current = setTimeout(() => {
      void executeSearch(newQuery);
    }, debounceMs);
  }, [debounceMs, executeSearch]);

  // 즉시 검색 (디바운스 없이)
  const search = useCallback(async () => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    await executeSearch(query);
  }, [query, executeSearch]);

  // 초기화
  const clear = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setQueryState('');
    setResults([]);
    setError(null);
  }, []);

  // 검색창 열기/닫기
  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => {
    setIsOpen(false);
    clear();
  }, [clear]);

  // 엔티티 타입 변경 시 재검색
  useEffect(() => {
    if (query.trim()) {
      void executeSearch(query);
    }
    // executeSearch는 의도적으로 의존성에서 제외 (무한 루프 방지)
    // eslint-disable-next-line
  }, [entityTypes, query]);

  // 컴포넌트 언마운트 시 정리
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // 결과 그룹화
  const groupedResults = results.reduce<Record<SearchEntityType, SearchResult[]>>(
    (acc, result) => {
      if (!acc[result.entity_type]) {
        acc[result.entity_type] = [];
      }
      acc[result.entity_type].push(result);
      return acc;
    },
    {} as Record<SearchEntityType, SearchResult[]>
  );

  return {
    query,
    setQuery,
    results,
    loading,
    error,
    search,
    clear,
    entityTypes,
    setEntityTypes,
    groupedResults,
    resultCount: results.length,
    isOpen,
    open,
    close,
  };
}
