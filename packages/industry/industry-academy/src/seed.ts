/**
 * Industry Academy Seed Service
 *
 * 학원 업종 전용 초기 데이터 생성
 * [불변 규칙] Industry Layer는 Core Layer를 import하여 사용합니다.
 * [불변 규칙] 모든 쿼리는 withTenant()를 사용하여 tenant_id 필터를 강제합니다.
 * [불변 규칙] INSERT 시에는 row object 내에 tenant_id 필드를 직접 포함합니다.
 */

import { createServerClient } from '@lib/supabase-client/server';
import { withTenant } from '@lib/supabase-client/db';
import type { CreateClassInput } from './types';

export class AcademySeedService {
  private supabase = createServerClient();

  /**
   * 학원 업종 초기 데이터 생성
   *
   * [불변 규칙] 테넌트 생성 후 호출되어야 합니다.
   * [불변 규칙] 기본 반 1개를 생성하여 즉시 운영 가능하도록 합니다.
   *
   * @param tenantId 테넌트 ID
   * @param ownerUserId 소유자 사용자 ID (created_by로 사용)
   */
  async seedTenantData(tenantId: string, ownerUserId: string): Promise<void> {
    // 1. 기본 반 생성
    await this.createDefaultClass(tenantId, ownerUserId);
  }

  /**
   * 기본 반 생성
   *
   * [불변 규칙] 신규 테넌트가 즉시 운영 가능하도록 기본 반 1개를 생성합니다.
   * 사용자는 나중에 수정/삭제할 수 있습니다.
   */
  private async createDefaultClass(tenantId: string, ownerUserId: string): Promise<void> {
    const defaultClass: CreateClassInput = {
      name: '기본 반',
      subject: undefined,
      grade: undefined,
      day_of_week: 'monday',
      start_time: '14:00:00',
      end_time: '15:30:00',
      capacity: 20,
      color: '#3b82f6', // 기본 파란색
      room: undefined,
      notes: '신규 테넌트 생성 시 자동으로 생성된 기본 반입니다. 수정하거나 삭제할 수 있습니다.',
      status: 'active', // 명시적으로 active 상태 설정
    };

    const { error } = await withTenant(
      this.supabase
        .from('academy_classes')
        .insert({
          tenant_id: tenantId,
          ...defaultClass,
          created_by: ownerUserId,
        }),
      tenantId
    );

    if (error) {
      // 기본 반 생성 실패해도 전체 시드를 중단하지 않음 (선택 기능)
      console.warn(`[AcademySeedService] 기본 반 생성 실패: ${error.message}`);
    }
  }
}

/**
 * Default Service Instance
 */
export const academySeedService = new AcademySeedService();

