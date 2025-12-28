#!/usr/bin/env tsx
/**
 * Intent 카탈로그 문서 생성 스크립트
 *
 * packages/chatops-intents/src/registry.ts에서 모든 Intent 정보를 추출하여
 * 챗봇.md 파일의 섹션 9를 업데이트합니다.
 */

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const REGISTRY_PATH = join(process.cwd(), 'packages/chatops-intents/src/registry.ts');
const DOC_PATH = join(process.cwd(), 'docu/챗봇.md');

const registryContent = readFileSync(REGISTRY_PATH, 'utf-8');

// Intent 정보 추출
interface IntentInfo {
  key: string;
  description: string;
  automation_level: string;
  execution_class?: string;
  event_type?: string;
  event_type_by_purpose?: Record<string, string>;
  params: string[];
  response_fields?: string[];
  warnings?: string[];
}

const intents: IntentInfo[] = [];
const lines = registryContent.split('\n');

let currentIntent: Partial<IntentInfo> | null = null;
let inBlock = false;
let braceCount = 0;
let inParamsSchema = false;
let inResponseSchema = false;
let paramsBraceCount = 0;
let responseBraceCount = 0;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i].trim();

  // Intent 키 찾기
  const keyMatch = line.match(/^'([a-z_]+\.[a-z_]+\.[a-z_]+)':\s*\{/);
  if (keyMatch) {
    currentIntent = { key: keyMatch[1], params: [], warnings: [] };
    inBlock = true;
    braceCount = 1;
    inParamsSchema = false;
    inResponseSchema = false;
    continue;
  }

  if (inBlock && currentIntent) {
    braceCount += (line.match(/\{/g) || []).length;
    braceCount -= (line.match(/\}/g) || []).length;

    // description 추출
    const descMatch = line.match(/description:\s*'([^']+)'/);
    if (descMatch) {
      currentIntent.description = descMatch[1];
    }

    // automation_level 추출
    const levelMatch = line.match(/automation_level:\s*'([^']+)'/);
    if (levelMatch) {
      currentIntent.automation_level = levelMatch[1];
    }

    // execution_class 추출
    const execMatch = line.match(/execution_class:\s*'([^']+)'/);
    if (execMatch) {
      currentIntent.execution_class = execMatch[1];
    }

    // event_type 추출
    const eventMatch = line.match(/event_type:\s*'([^']+)'/);
    if (eventMatch) {
      currentIntent.event_type = eventMatch[1];
    }

    // event_type_by_purpose 추출 (간단한 형태만)
    if (line.includes('event_type_by_purpose:')) {
      inParamsSchema = false;
      inResponseSchema = false;
    }

    // paramsSchema 시작
    if (line.includes('paramsSchema:')) {
      inParamsSchema = true;
      paramsBraceCount = 0;
    }

    if (inParamsSchema) {
      paramsBraceCount += (line.match(/\{/g) || []).length;
      paramsBraceCount -= (line.match(/\}/g) || []).length;

      // 파라미터 필드 추출 (더 정확한 파싱)
      // 예: class_id: z.string().uuid().optional(),
      // 예: date: z.string().optional(), // YYYY-MM-DD 형식
      const paramMatch = line.match(/^\s*(\w+):\s*z\./);
      if (paramMatch && !line.includes('paramsSchema') && !line.trim().startsWith('//')) {
        currentIntent.params = currentIntent.params || [];
        const paramName = paramMatch[1];
        const fullLine = line.trim();
        const optional = fullLine.includes('.optional()');
        const isUuid = fullLine.includes('.uuid()');
        const isArray = fullLine.includes('z.array(');
        const isEnum = fullLine.includes('z.enum(');
        const isInt = fullLine.includes('.int()');
        const isPositive = fullLine.includes('.positive()');

        let paramType = 'unknown';
        let paramDesc = '';

        // 주석 추출 (라인 끝의 주석)
        const commentMatch = line.match(/\/\/\s*(.+)$/);
        if (commentMatch) {
          paramDesc = commentMatch[1].trim();
        }

        if (isEnum) {
          const enumMatch = fullLine.match(/z\.enum\(\[(.*?)\]/);
          if (enumMatch) {
            paramType = `enum[${enumMatch[1].replace(/'/g, '').trim()}]`;
          } else {
            paramType = 'enum';
          }
        } else if (isArray) {
          const arrayMatch = fullLine.match(/z\.array\(z\.(\w+)/);
          if (arrayMatch) {
            const innerType = arrayMatch[1];
            if (innerType === 'string') {
              paramType = isUuid ? 'array<uuid>' : 'array<string>';
            } else {
              paramType = `array<${innerType}>`;
            }
          } else {
            paramType = 'array';
          }
        } else if (isUuid) {
          paramType = 'uuid';
        } else if (fullLine.includes('z.string()')) {
          paramType = 'string';
        } else if (fullLine.includes('z.number()')) {
          if (isInt) {
            paramType = isPositive ? 'integer (positive)' : 'integer';
          } else {
            paramType = 'number';
          }
        } else if (fullLine.includes('z.boolean()')) {
          paramType = 'boolean';
        } else if (fullLine.includes('z.object(')) {
          paramType = 'object';
        } else if (fullLine.includes('z.record(')) {
          paramType = 'record';
        }

        const paramDescText = paramDesc ? ` - ${paramDesc}` : '';
        currentIntent.params.push(`${paramName}${optional ? '?' : ''}: ${paramType}${paramDescText}`);
      }

      if (paramsBraceCount === 0 && inParamsSchema) {
        inParamsSchema = false;
      }
    }

    // responseSchema 시작
    if (line.includes('responseSchema:')) {
      inResponseSchema = true;
      responseBraceCount = 0;
    }

    if (inResponseSchema) {
      responseBraceCount += (line.match(/\{/g) || []).length;
      responseBraceCount -= (line.match(/\}/g) || []).length;

      // 응답 필드 추출
      const responseMatch = line.match(/(\w+):\s*z\./);
      if (responseMatch && !line.includes('responseSchema')) {
        currentIntent.response_fields = currentIntent.response_fields || [];
        currentIntent.response_fields.push(responseMatch[1]);
      }

      if (responseBraceCount === 0 && inResponseSchema) {
        inResponseSchema = false;
      }
    }

    // warnings 추출
    const warningsMatch = line.match(/warnings:\s*\[(.*?)\]/s);
    if (warningsMatch) {
      const warningsText = warningsMatch[1];
      const warningMatches = warningsText.match(/'([^']+)'/g);
      if (warningMatches) {
        currentIntent.warnings = warningMatches.map(m => m.replace(/'/g, ''));
      }
    }

    // Intent 블록 종료
    if (braceCount === 0) {
      if (currentIntent.key && currentIntent.description && currentIntent.automation_level) {
        intents.push(currentIntent as IntentInfo);
      }
      currentIntent = null;
      inBlock = false;
    }
  }
}

// 도메인별로 그룹화
const domainMap: Record<string, IntentInfo[]> = {};
for (const intent of intents) {
  const domain = intent.key.split('.')[0];
  if (!domainMap[domain]) {
    domainMap[domain] = [];
  }
  domainMap[domain].push(intent);
}

// 문서 생성
const domainNames: Record<string, string> = {
  attendance: '출결(Attendance)',
  billing: '수납/청구(Billing)',
  message: '메시지/공지(Messaging)',
  student: '학생 라이프사이클(Student)',
  class: '반/수업/시간표(Class/Schedule)',
  schedule: '반/수업/시간표(Class/Schedule)',
  note: '상담/학습/메모 + AI(Notes/AI)',
  ai: '상담/학습/메모 + AI(Notes/AI)',
  report: '리포트/대시보드(Reports)',
  policy: '정책/권한/시스템(System)',
  rbac: '정책/권한/시스템(System)',
  system: '정책/권한/시스템(System)',
};

// 통계 계산
const l0Count = intents.filter(i => i.automation_level === 'L0').length;
const l1Count = intents.filter(i => i.automation_level === 'L1').length;
const l2aCount = intents.filter(i => i.automation_level === 'L2' && i.execution_class === 'A').length;
const l2bCount = intents.filter(i => i.automation_level === 'L2' && i.execution_class === 'B').length;
const l2Total = l2aCount + l2bCount;
const totalCount = intents.length;
const l0Percent = ((l0Count / totalCount) * 100).toFixed(1);
const l1Percent = ((l1Count / totalCount) * 100).toFixed(1);
const l2aPercent = ((l2aCount / totalCount) * 100).toFixed(1);
const l2bPercent = ((l2bCount / totalCount) * 100).toFixed(1);
const l2Percent = ((l2Total / totalCount) * 100).toFixed(1);
const ratioL0 = Math.round((l0Count / l1Count) * 10) / 10;
const ratioL1 = 1;
const ratioL2 = Math.round((l2Total / l1Count) * 10) / 10;

let docContent = `9. Intent 카탈로그 (전체 ${totalCount}개)

⚠️ **SSOT**: 이 목록은 packages/chatops-intents/src/registry.ts의 Intent Registry를 기반으로 자동 생성됩니다.
- 코드 Registry가 SSOT이며, 이 문서는 참조용입니다.
- 새 Intent 추가 시: Registry에 먼저 등록하고, 이 문서는 자동으로 업데이트됩니다.

**표기 규칙:**
- **Level**: L0 (조회/초안), L1 (TaskCard 생성), L2 (승인 후 실행)
- **L2 분류**: L2-A (알림/발송), L2-B (도메인 변경, 현재는 L1로 강등)
- **Params**: 핵심 필드만 요약 (상세 Zod 스키마는 Registry 참조)
- **Response**: L0 Intent의 응답 구조 (L1/L2는 TaskCard 생성)
- **Event Type**: L2-A Intent의 event_type 매핑 (AUTOMATION_EVENT_CATALOG에 존재해야 함)

**📊 전체 통계 (Registry 기준):**
- 총 Intent: **${totalCount}개**
- L0 (조회/초안): **${l0Count}개** (${l0Percent}%)
- L1 (TaskCard 생성): **${l1Count}개** (${l1Percent}%)
- L2-A (알림/발송): **${l2aCount}개** (${l2aPercent}%)
- L2-B (도메인 변경): **${l2bCount}개** (${l2bPercent}%)
- L2 합계: **${l2Total}개** (${l2Percent}%)
- 비율 (L0:L1:L2): **${ratioL0}:${ratioL1}:${ratioL2}**

`;

// 도메인별로 문서 생성 (고유한 섹션 번호 할당)
const domainOrder = ['attendance', 'billing', 'message', 'student', 'class', 'schedule', 'note', 'ai', 'report', 'policy', 'rbac', 'system'];
const domainSectionMap: Record<string, string> = {
  attendance: 'A',
  billing: 'B',
  message: 'M',
  student: 'S',
  class: 'C',
  schedule: 'C', // class와 동일 섹션
  note: 'N',
  ai: 'N', // note와 동일 섹션
  report: 'R',
  policy: 'P',
  rbac: 'P', // policy와 동일 섹션
  system: 'P', // policy와 동일 섹션
};

// 이미 처리된 도메인 추적 (중복 방지)
const processedDomains = new Set<string>();

for (const domain of domainOrder) {
  if (!domainMap[domain] || processedDomains.has(domain)) {
    continue;
  }

  const domainIntents = domainMap[domain];
  const domainName = domainNames[domain] || domain;
  const sectionLetter = domainSectionMap[domain] || domain.charAt(0).toUpperCase();

  // 동일 섹션에 속하는 도메인들 통합
  const relatedDomains = Object.keys(domainSectionMap).filter(d => domainSectionMap[d] === sectionLetter && domainMap[d]);
  const allIntents = relatedDomains.flatMap(d => domainMap[d] || []);
  const totalCount = allIntents.length;

  // 통합된 도메인 이름 생성
  let combinedDomainName = domainName;
  if (relatedDomains.length > 1) {
    const names = relatedDomains.map(d => domainNames[d] || d).filter((v, i, a) => a.indexOf(v) === i);
    combinedDomainName = names.join(' / ');
  }

  const l0Intents = allIntents.filter(i => i.automation_level === 'L0');
  const l1Intents = allIntents.filter(i => i.automation_level === 'L1');
  const l2Intents = allIntents.filter(i => i.automation_level === 'L2');

  docContent += `\n## 9-${sectionLetter}. ${combinedDomainName} 도메인 (${totalCount}개)\n\n`;

  // 관련 도메인들을 처리 완료로 표시
  relatedDomains.forEach(d => processedDomains.add(d));

  if (l0Intents.length > 0) {
    docContent += `### 조회/초안(L0) - ${l0Intents.length}개\n\n`;
    for (const intent of l0Intents) {
      docContent += `#### ${intent.key} (L0)\n\n`;
      docContent += `**설명**: ${intent.description}\n\n`;
      if (intent.params.length > 0) {
        docContent += `**파라미터**:\n`;
        for (const param of intent.params) {
          docContent += `- ${param}\n`;
        }
        docContent += `\n`;
      }
      if (intent.response_fields && intent.response_fields.length > 0) {
        docContent += `**응답 필드**: ${intent.response_fields.join(', ')}\n\n`;
      }
      docContent += `**기능**: 이 Intent는 데이터 조회만 수행하며, 상태 변경이 없습니다. 즉시 결과를 반환합니다.\n\n`;
      docContent += `---\n\n`;
    }
  }

  if (l1Intents.length > 0) {
    docContent += `### 업무화(L1) - ${l1Intents.length}개\n\n`;
    for (const intent of l1Intents) {
      docContent += `#### ${intent.key} (L1)\n\n`;
      docContent += `**설명**: ${intent.description}\n\n`;
      if (intent.params.length > 0) {
        docContent += `**파라미터**:\n`;
        for (const param of intent.params) {
          docContent += `- ${param}\n`;
        }
        docContent += `\n`;
      }
      docContent += `**기능**: 이 Intent는 TaskCard를 생성하여 업무로 등록합니다. 실제 실행은 사용자가 TaskCard를 확인하고 승인한 후 수행됩니다.\n\n`;
      docContent += `---\n\n`;
    }
  }

  if (l2Intents.length > 0) {
    docContent += `### 승인 실행(L2) - ${l2Intents.length}개\n\n`;
    for (const intent of l2Intents) {
      const execClass = intent.execution_class === 'A' ? 'L2-A' : 'L2-B';
      docContent += `#### ${intent.key} (${execClass})\n\n`;
      docContent += `**설명**: ${intent.description}\n\n`;
      if (intent.params.length > 0) {
        docContent += `**파라미터**:\n`;
        for (const param of intent.params) {
          docContent += `- ${param}\n`;
        }
        docContent += `\n`;
      }
      if (intent.execution_class === 'A') {
        if (intent.event_type) {
          docContent += `**Event Type**: ${intent.event_type}\n\n`;
          docContent += `⚠️ **P0-D2**: 이 event_type은 AUTOMATION_EVENT_CATALOG에 존재해야 합니다. 미등록 시 Fail-Closed로 실행이 차단됩니다.\n\n`;
        }
        if (intent.event_type_by_purpose) {
          docContent += `**Event Type 매핑** (purpose별):\n`;
          for (const [purpose, eventType] of Object.entries(intent.event_type_by_purpose)) {
            docContent += `- ${purpose} → ${eventType}\n`;
          }
          docContent += `\n⚠️ **P0-D2**: 모든 event_type은 AUTOMATION_EVENT_CATALOG에 존재해야 합니다.\n\n`;
        }
        docContent += `**기능**: 이 Intent는 알림/발송 계열 작업을 수행합니다. Policy 경로는 \`auto_notification.<event_type>.*\` 형식을 사용합니다.\n\n`;
      } else {
        docContent += `⚠️ **L2-B 분류**: 도메인 변경 계열\n\n`;
        docContent += `⚠️ **P0**: Domain Action Catalog가 SSOT로 확정되기 전까지는 항상 L1로 강등(Fail-Closed)됩니다.\n`;
        docContent += `- TaskCard 생성(업무화)까지만 수행하고 자동 실행은 금지됩니다.\n`;
        docContent += `- 자동 실행 활성화 조건: Domain Action Catalog에 action_key 등록, RBAC 룰/정책 경로/감사 규칙 SSOT 정의, 핸들러가 Catalog 존재를 런타임에서 검증\n\n`;
        docContent += `**기능**: 이 Intent는 도메인 데이터를 변경하는 작업을 수행합니다. 현재는 TaskCard 생성까지만 수행됩니다.\n\n`;
      }
      if (intent.warnings && intent.warnings.length > 0) {
        docContent += `**경고 사항**:\n`;
        for (const warning of intent.warnings) {
          docContent += `- ${warning}\n`;
        }
        docContent += `\n`;
      }
      docContent += `---\n\n`;
    }
  }
}

// 챗봇.md 파일 읽기
const docFileContent = readFileSync(DOC_PATH, 'utf-8');

// 섹션 9 찾기 및 교체
let section9Start = docFileContent.indexOf('9. 구현 가능한 기능 전체 목록');
if (section9Start < 0) {
  section9Start = docFileContent.indexOf('9. Intent 카탈로그');
}
if (section9Start < 0) {
  section9Start = docFileContent.indexOf('\n9.');
}

// 섹션 9의 끝 찾기 - "10." 또는 "## 10." 또는 "11." 또는 "## 11." 패턴
let section9End = docFileContent.indexOf('\n10. ', section9Start);
if (section9End < 0) {
  section9End = docFileContent.indexOf('\n## 10. ', section9Start);
}
if (section9End < 0) {
  section9End = docFileContent.indexOf('\n10.', section9Start);
}
if (section9End < 0) {
  section9End = docFileContent.indexOf('\n## 10.', section9Start);
}
if (section9End < 0) {
  section9End = docFileContent.indexOf('\n11. ', section9Start);
}
if (section9End < 0) {
  section9End = docFileContent.indexOf('\n## 11. ', section9Start);
}
if (section9End < 0) {
  section9End = docFileContent.indexOf('\n11.', section9Start);
}
if (section9End < 0) {
  section9End = docFileContent.indexOf('\n## 11.', section9Start);
}
const actualSection9End = section9End > 0 ? section9End : docFileContent.length;

if (section9Start < 0) {
  console.error('섹션 9를 찾을 수 없습니다.');
  process.exit(1);
}

const beforeSection9 = docFileContent.substring(0, section9Start);
const afterSection9 = docFileContent.substring(actualSection9End);

const newDocContent = beforeSection9 + docContent + afterSection9;

writeFileSync(DOC_PATH, newDocContent, 'utf-8');
console.log(`✅ 챗봇.md 섹션 9 업데이트 완료: ${intents.length}개 Intent 상세 설명 추가`);

