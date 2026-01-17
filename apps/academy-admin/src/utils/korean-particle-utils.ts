/**
 * Korean Particle Utilities (한국어 조사 처리 유틸리티)
 *
 * [불변 규칙] 업종 중립 용어와 함께 사용하여 올바른 조사 적용
 * [불변 규칙] 모든 앱에서 공용으로 사용 가능
 *
 * @example
 * ```typescript
 * import { withParticle, p } from '../utils';
 * import { useIndustryTerms } from '@hooks/use-industry-terms';
 *
 * const terms = useIndustryTerms();
 *
 * // 방법 1: withParticle 함수 사용
 * withParticle(terms.PERSON_LABEL_PRIMARY, '이', '가'); // "학생이" 또는 "회원이"
 * withParticle(terms.TAG_LABEL, '을', '를');            // "태그를"
 *
 * // 방법 2: p 단축 함수 사용 (템플릿 리터럴에서 편리)
 * `${terms.PERSON_LABEL_PRIMARY}${p.이가(terms.PERSON_LABEL_PRIMARY)} 등록되었습니다.`
 * // "학생이 등록되었습니다." 또는 "회원이 등록되었습니다."
 * ```
 */

/**
 * 한글 종성(받침) 유무 확인
 *
 * @param char 마지막 글자
 * @returns 받침이 있으면 true, 없으면 false
 */
function hasFinalConsonant(char: string): boolean {
  if (!char) return false;

  const charCode = char.charCodeAt(0);

  // 한글 유니코드 범위 체크 (가-힣: 0xAC00-0xD7A3)
  if (charCode < 0xAC00 || charCode > 0xD7A3) {
    // 숫자인 경우 특별 처리
    if (charCode >= 0x30 && charCode <= 0x39) {
      // 0, 1, 3, 6, 7, 8은 받침 있는 것처럼 처리
      // 2, 4, 5, 9는 받침 없는 것처럼 처리
      const digit = charCode - 0x30;
      return [0, 1, 3, 6, 7, 8].includes(digit);
    }
    // 한글이 아니면 받침 없음으로 처리 (영어 등)
    return false;
  }

  // 한글 종성 계산: (charCode - 0xAC00) % 28
  // 0이면 받침 없음, 1-27이면 받침 있음
  return (charCode - 0xAC00) % 28 !== 0;
}

/**
 * 단어의 마지막 글자 가져오기
 *
 * @param word 단어
 * @returns 마지막 글자
 */
function getLastChar(word: string): string {
  if (!word || typeof word !== 'string') return '';
  return word.trim().slice(-1);
}

/**
 * 받침 유무에 따라 적절한 조사 반환
 *
 * @param word 단어
 * @param withFinal 받침 있을 때 조사 (예: '이', '은', '을', '과')
 * @param withoutFinal 받침 없을 때 조사 (예: '가', '는', '를', '와')
 * @returns 적절한 조사
 *
 * @example
 * ```typescript
 * getParticle('학생', '이', '가');  // '이'
 * getParticle('회원', '이', '가');  // '이'
 * getParticle('강사', '가', '가');  // '가' (받침 없음)
 * getParticle('태그', '를', '를');  // '를' (받침 없음)
 * ```
 */
export function getParticle(
  word: string,
  withFinal: string,
  withoutFinal: string
): string {
  const lastChar = getLastChar(word);
  return hasFinalConsonant(lastChar) ? withFinal : withoutFinal;
}

/**
 * 단어에 조사를 붙여서 반환
 *
 * @param word 단어
 * @param withFinal 받침 있을 때 조사
 * @param withoutFinal 받침 없을 때 조사
 * @returns 단어 + 조사
 *
 * @example
 * ```typescript
 * withParticle('학생', '이', '가');  // '학생이'
 * withParticle('회원', '을', '를');  // '회원을'
 * withParticle('수업', '은', '는');  // '수업은'
 * ```
 */
export function withParticle(
  word: string,
  withFinal: string,
  withoutFinal: string
): string {
  return word + getParticle(word, withFinal, withoutFinal);
}

/**
 * 조사 단축 함수 모음 (p = particles)
 *
 * 템플릿 리터럴에서 간편하게 사용할 수 있는 단축 함수들
 *
 * @example
 * ```typescript
 * import { p } from '../utils';
 *
 * const name = '학생';
 * console.log(`${name}${p.이가(name)} 등록되었습니다.`);  // "학생이 등록되었습니다."
 * console.log(`${name}${p.을를(name)} 삭제합니다.`);      // "학생을 삭제합니다."
 * console.log(`${name}${p.은는(name)} 활성 상태입니다.`); // "학생은 활성 상태입니다."
 * ```
 */
export const p = {
  /** 이/가 (주격 조사) - 학생이, 회원이, 강사가 */
  이가: (word: string): string => getParticle(word, '이', '가'),

  /** 을/를 (목적격 조사) - 학생을, 회원을, 강사를 */
  을를: (word: string): string => getParticle(word, '을', '를'),

  /** 은/는 (보조사) - 학생은, 회원은, 강사는 */
  은는: (word: string): string => getParticle(word, '은', '는'),

  /** 과/와 (접속 조사) - 학생과, 회원과, 강사와 */
  과와: (word: string): string => getParticle(word, '과', '와'),

  /** 아/야 (호격 조사) - 철수야, 영희야 */
  아야: (word: string): string => getParticle(word, '아', '야'),

  /** 으로/로 (방향/도구 조사) - 학원으로, 집으로, 버스로 */
  으로로: (word: string): string => {
    const lastChar = getLastChar(word);
    const charCode = lastChar.charCodeAt(0);

    // 한글이 아닌 경우 '로' 반환
    if (charCode < 0xAC00 || charCode > 0xD7A3) return '로';

    const final = (charCode - 0xAC00) % 28;
    // 받침 없거나 ㄹ 받침(8)이면 '로', 그 외는 '으로'
    return final === 0 || final === 8 ? '로' : '으로';
  },

  /** 이라/라 (서술격 조사) - 학생이라, 강사라 */
  이라라: (word: string): string => getParticle(word, '이라', '라'),

  /** 이란/란 (화제 조사) - 학생이란, 강사란 */
  이란란: (word: string): string => getParticle(word, '이란', '란'),

  /** 이나/나 (선택 조사) - 학생이나, 강사나 */
  이나나: (word: string): string => getParticle(word, '이나', '나'),

  /** 이에요/예요 (종결 어미) - 학생이에요, 강사예요 */
  이에요예요: (word: string): string => getParticle(word, '이에요', '예요'),

  /** 이었/였 (과거 서술) - 학생이었, 강사였 */
  이었였: (word: string): string => getParticle(word, '이었', '였'),
};

/**
 * 조사가 포함된 문장 템플릿 생성 헬퍼
 *
 * 자주 사용되는 문장 패턴을 미리 정의하여 일관성 보장
 *
 * @example
 * ```typescript
 * import { templates } from '../utils';
 *
 * templates.registered('학생');           // "학생이 등록되었습니다."
 * templates.deleted('상담 내역');          // "상담 내역이 삭제되었습니다."
 * templates.saved('정보');                 // "정보가 저장되었습니다."
 * templates.notFound('학생');              // "학생을 찾을 수 없습니다."
 * templates.confirmDelete('학생');         // "학생을 삭제하시겠습니까?"
 * templates.manage('태그');                // "태그를 관리합니다."
 * ```
 */
export const templates = {
  /** {entity}이/가 등록되었습니다. */
  registered: (entity: string): string =>
    `${entity}${p.이가(entity)} 등록되었습니다.`,

  /** {entity}이/가 삭제되었습니다. */
  deleted: (entity: string): string =>
    `${entity}${p.이가(entity)} 삭제되었습니다.`,

  /** {entity}이/가 수정되었습니다. */
  updated: (entity: string): string =>
    `${entity}${p.이가(entity)} 수정되었습니다.`,

  /** {entity}이/가 저장되었습니다. */
  saved: (entity: string): string =>
    `${entity}${p.이가(entity)} 저장되었습니다.`,

  /** {entity}을/를 찾을 수 없습니다. */
  notFound: (entity: string): string =>
    `${entity}${p.을를(entity)} 찾을 수 없습니다.`,

  /** {entity}을/를 불러올 수 없습니다. */
  loadFailed: (entity: string): string =>
    `${entity}${p.을를(entity)} 불러올 수 없습니다.`,

  /** {entity}을/를 삭제하시겠습니까? */
  confirmDelete: (entity: string): string =>
    `${entity}${p.을를(entity)} 삭제하시겠습니까?`,

  /** {entity}을/를 관리합니다. */
  manage: (entity: string): string =>
    `${entity}${p.을를(entity)} 관리합니다.`,

  /** {entity}을/를 선택하세요. */
  select: (entity: string): string =>
    `${entity}${p.을를(entity)} 선택하세요.`,

  /** {entity}이/가 없습니다. */
  empty: (entity: string): string =>
    `${entity}${p.이가(entity)} 없습니다.`,

  /** {entity} 목록 */
  list: (entity: string): string =>
    `${entity} 목록`,

  /** {entity} 관리 */
  management: (entity: string): string =>
    `${entity}관리`,

  /** {entity} 등록 */
  registration: (entity: string): string =>
    `${entity}등록`,

  /** {entity} 통계 */
  statistics: (entity: string): string =>
    `${entity}통계`,

  /** {entity} 상세 */
  detail: (entity: string): string =>
    `${entity} 상세`,

  /** {entity} 정보 */
  info: (entity: string): string =>
    `${entity} 정보`,
};

/**
 * 서브사이드바 메뉴 라벨 동적 생성 헬퍼
 *
 * 업종 중립 용어와 함께 사용하여 메뉴 라벨 생성
 *
 * @example
 * ```typescript
 * import { useIndustryTerms } from '@hooks/use-industry-terms';
 * import { menuLabels } from '../utils';
 *
 * const terms = useIndustryTerms();
 *
 * menuLabels.list(terms.PERSON_LABEL_PRIMARY);       // "학생목록"
 * menuLabels.add(terms.PERSON_LABEL_PRIMARY);        // "학생등록"
 * menuLabels.statistics(terms.PERSON_LABEL_PRIMARY); // "학생통계"
 * menuLabels.management(terms.PERSON_LABEL_PRIMARY); // "학생관리"
 * ```
 */
export const menuLabels = {
  /** {entity}목록 */
  list: (entity: string): string => `${entity}목록`,

  /** {entity}등록 */
  add: (entity: string): string => `${entity}등록`,

  /** {entity}통계 */
  statistics: (entity: string): string => `${entity}통계`,

  /** {entity}관리 */
  management: (entity: string): string => `${entity}관리`,

  /** {entity} 기록 */
  history: (entity: string): string => `${entity} 기록`,

  /** {entity} 설정 */
  settings: (entity: string): string => `${entity} 설정`,

  /** {entity} 분석 */
  analysis: (entity: string): string => `${entity} 분석`,
};
