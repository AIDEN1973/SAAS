/**
 * useWeatherSignals Hook
 *
 * 프론트 자동화 문서 1.2.3 섹션 참조
 *
 * 정본 규칙:
 * - 프론트는 날씨 상황 신호만 수집
 * - 안내문 생성/발송은 서버(StudentTaskCard 생성)에서 처리
 * - 프론트는 알림 생성/실행을 주도하지 않음
 */

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getApiContext } from '@api-sdk/core';
import { apiClient } from '@api-sdk/core';

export interface WeatherCondition {
  condition: 'rain' | 'snow' | 'storm' | 'normal';
  intensity: 'light' | 'moderate' | 'heavy';
}

export interface WeatherSignals {
  condition: 'heavy_rain' | 'heavy_snow' | 'storm' | null;
  intensity: 'light' | 'moderate' | 'heavy' | null;
  bannerHint: string | null;
}

/**
 * 날씨 상황 신호 수집 Hook
 *
 * 정본 규칙:
 * - 프론트는 weather signal만 생성
 * - 서버 배치/트리거가 heavy rain을 근거로 StudentTaskCard 생성
 * - 프론트는 알림 생성/실행을 주도하지 않음
 */
export function useWeatherSignals() {
  const context = getApiContext();
  const tenantId = context.tenantId;

  // 날씨 API 호출 (서버 API를 통해)
  const { data: weather } = useQuery({
    queryKey: ['weather', tenantId],
    queryFn: async () => {
      if (!tenantId) return null;

      // 서버 API를 통해 날씨 정보 조회 (클라이언트에서 직접 외부 API 호출 금지)
      // TODO: 실제 날씨 API 엔드포인트 구현 필요
      // 예: const response = await apiClient.get('weather');
      // 현재는 null 반환 (구현 예정)
      return null;
    },
    enabled: !!tenantId,
    refetchInterval: 30 * 60 * 1000, // 30분마다 갱신
  });

  // 정본: 프론트는 weather signal만 생성
  const weatherSignals = useMemo<WeatherSignals>(() => {
    if (!weather) {
      return {
        condition: null,
        intensity: null,
        bannerHint: null,
      };
    }

    const weatherData = weather as WeatherCondition;

    // heavy rain 감지
    if (weatherData.condition === 'rain' && weatherData.intensity === 'heavy') {
      return {
        condition: 'heavy_rain',
        intensity: weatherData.intensity,
        bannerHint: '오늘은 비가 많이 옵니다. 하원 시 안전에 주의하세요.',
      };
    }

    // heavy snow 감지
    if (weatherData.condition === 'snow' && weatherData.intensity === 'heavy') {
      return {
        condition: 'heavy_snow',
        intensity: weatherData.intensity,
        bannerHint: '오늘은 눈이 많이 옵니다. 하원 시 안전에 주의하세요.',
      };
    }

    // storm 감지
    if (weatherData.condition === 'storm') {
      return {
        condition: 'storm',
        intensity: 'heavy',
        bannerHint: '오늘은 폭풍이 예상됩니다. 하원 시 안전에 주의하세요.',
      };
    }

    return {
      condition: null,
      intensity: null,
      bannerHint: null,
    };
  }, [weather]);

  return { weatherSignals };
}

