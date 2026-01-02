/**
 * CORS 헤더 공통 유틸리티
 *
 * [목적] Edge Functions에서 공통으로 사용하는 CORS 헤더 정의
 */

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};
