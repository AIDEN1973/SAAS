/**
 * Meta-Schema Validator
 *
 * [불�? 규칙] ?�키�?구조???�음 ?�계?�서 검�?
 * - 개발(local dev)
 * - CI 빌드 ?�계
 * - ?�넌??배포 ?? * - Schema Registry???�록 ?�점
 */
import { SchemaVersion } from './types';
/**
 * Schema Version 체크
 *
 * SDUI v1.1: minClient�??�용?�여 ?�라?�언??버전 ?�환??체크
 */
export declare function checkSchemaVersion(schema: SchemaVersion, clientVersion: string): {
    compatible: boolean;
    requiresUpdate?: boolean;
    requiresMigration?: boolean;
};
//# sourceMappingURL=validator.d.ts.map