/**
 * 전체 학생 목록 페이지
 *
 * 아키텍처 문서 3.1.4 섹션 참조
 *
 * 이 페이지는 업무 홈이 아닌 "고급/상세 조회 기능"이며,
 * 기본 진입 동선은 학생 홈(TaskCard)에서 "전체 학생 보기" 버튼을 통해서만 가능하다.
 *
 * [불변 규칙] api-sdk를 통해서만 API 요청
 * [불변 규칙] SDUI 스키마 기반 화면 자동 생성
 * [불변 규칙] Zero-Trust: UI는 tenantId를 직접 전달하지 않음, Context에서 자동 가져옴
 */

// StudentsPage의 내용을 그대로 사용
export { StudentsPage as StudentsListPage } from './StudentsPage';

