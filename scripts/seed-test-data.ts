/**
 * E2E 테스트를 위한 시드 데이터 생성 스크립트
 *
 * [실행 방법]
 * npm run seed:test
 *
 * [생성 데이터]
 * - 테스트 사용자 (관리자, 일반 사용자)
 * - 테스트 테넌트
 * - 샘플 학생 데이터
 * - 샘플 출석 데이터
 * - 샘플 청구서 데이터
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// 테스트 환경 변수 로드 (기존 환경 변수 덮어쓰기)
dotenv.config({ path: '.env.test', override: true });

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Supabase 환경 변수가 설정되지 않았습니다.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

interface TestUser {
  email: string;
  password: string;
  role: 'admin' | 'user';
  name: string;
}

const testUsers: TestUser[] = [
  {
    email: process.env.TEST_ADMIN_EMAIL || 'admin@example.com',
    password: process.env.TEST_ADMIN_PASSWORD || 'AdminPassword123!',
    role: 'admin',
    name: '테스트 관리자',
  },
  {
    email: process.env.TEST_REGULAR_EMAIL || 'user@example.com',
    password: process.env.TEST_REGULAR_PASSWORD || 'UserPassword123!',
    role: 'user',
    name: '테스트 사용자',
  },
  {
    email: process.env.TEST_USER_EMAIL || 'test@example.com',
    password: process.env.TEST_USER_PASSWORD || 'TestPassword123!',
    role: 'admin',
    name: '기본 테스트 사용자',
  },
];

/**
 * 테스트 사용자 생성
 */
async function createTestUsers() {
  console.log('📝 테스트 사용자 생성 중...');

  for (const user of testUsers) {
    try {
      // Supabase Auth에 사용자 생성
      const { data, error } = await supabase.auth.signUp({
        email: user.email,
        password: user.password,
        options: {
          data: {
            name: user.name,
            role: user.role,
          },
        },
      });

      if (error) {
        if (error.message.includes('already registered')) {
          console.log(`   ⏭️  ${user.email} - 이미 존재함 (스킵)`);
        } else {
          console.error(`   ❌ ${user.email} - 실패: ${error.message}`);
        }
      } else {
        console.log(`   ✅ ${user.email} - 생성 완료`);
      }
    } catch (err) {
      console.error(`   ❌ ${user.email} - 에러:`, err);
    }
  }
}

/**
 * 테스트 테넌트 생성
 */
async function createTestTenant() {
  console.log('\n🏢 테스트 테넌트 생성 중...');

  // UUID 형식 사용 (이미 UUID인 경우 그대로, 아니면 생성)
  const tenantId = process.env.TEST_TENANT_ID || '00000000-0000-0000-0000-000000000001';
  const tenantName = process.env.TEST_TENANT_NAME || '테스트 학원';

  try {
    // 테넌트가 이미 존재하는지 확인
    const { data: existing } = await supabase
      .from('tenants')
      .select('id')
      .eq('id', tenantId)
      .single();

    if (existing) {
      console.log(`   ⏭️  ${tenantName} (${tenantId}) - 이미 존재함 (스킵)`);
      return tenantId;
    }

    // 테넌트 생성 (settings 컬럼 제거)
    const { error } = await supabase.from('tenants').insert([
      {
        id: tenantId,
        name: tenantName,
        industry_type: 'academy',
      },
    ]);

    if (error) {
      console.error(`   ❌ 테넌트 생성 실패: ${error.message}`);
      return null;
    } else {
      console.log(`   ✅ ${tenantName} (${tenantId}) - 생성 완료`);
      return tenantId;
    }
  } catch (err) {
    console.error(`   ❌ 테넌트 생성 에러:`, err);
    return null;
  }
}

/**
 * 샘플 학생 데이터 생성
 */
async function createSampleStudents(tenantId: string | null) {
  console.log('\n👨‍🎓 샘플 학생 데이터 생성 중...');

  if (!tenantId) {
    console.error('   ❌ 테넌트 ID가 없어 학생 데이터를 생성할 수 없습니다.');
    return;
  }

  const students = [
    { name: '김철수', grade: 1, status: 'active' },
    { name: '이영희', grade: 2, status: 'active' },
    { name: '박민수', grade: 3, status: 'active' },
    { name: '정수진', grade: 1, status: 'inactive' },
    { name: '최지훈', grade: 2, status: 'active' },
  ];

  for (const student of students) {
    try {
      // Person 생성
      const { data: person, error: personError } = await supabase
        .from('persons')
        .insert([
          {
            tenant_id: tenantId,
            name: student.name,
            person_type: 'student',
          },
        ])
        .select()
        .single();

      if (personError) {
        console.error(`   ❌ ${student.name} - Person 생성 실패: ${personError.message}`);
        continue;
      }

      // Academy Student 생성
      const { error: academyError } = await supabase.from('academy_students').insert([
        {
          person_id: person.id,
          grade: student.grade,
          status: student.status,
        },
      ]);

      if (academyError) {
        console.error(`   ❌ ${student.name} - Academy Student 생성 실패: ${academyError.message}`);
      } else {
        console.log(`   ✅ ${student.name} (${student.grade}학년, ${student.status}) - 생성 완료`);
      }
    } catch (err) {
      console.error(`   ❌ ${student.name} - 에러:`, err);
    }
  }
}

/**
 * 메인 실행 함수
 */
async function main() {
  console.log('🚀 E2E 테스트 시드 데이터 생성 시작\n');
  console.log(`📍 Supabase URL: ${supabaseUrl}`);
  console.log(`📍 환경: ${process.env.NODE_ENV || 'test'}\n`);

  try {
    await createTestUsers();
    const tenantId = await createTestTenant();
    await createSampleStudents(tenantId);

    console.log('\n✨ 시드 데이터 생성 완료!');
    console.log('\n📋 생성된 테스트 계정:');
    testUsers.forEach((user) => {
      console.log(`   • ${user.email} / ${user.password} (${user.role})`);
    });
  } catch (error) {
    console.error('\n❌ 시드 데이터 생성 중 오류 발생:', error);
    process.exit(1);
  }
}

// 스크립트 실행
main();
