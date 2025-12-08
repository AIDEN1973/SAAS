/**
 * Schema Registry Hooks
 * 
 * [불변 규칙] Zero-Trust: 모든 요청은 Supabase RLS를 통해 권한 검증
 */

export { useIsSuperAdmin } from './useIsSuperAdmin';
export {
  useSchemaList,
  useSchema,
  useCreateSchema,
  useUpdateSchema,
  useActivateSchema,
  useDeleteSchema,
  type SchemaRegistryEntry,
  type CreateSchemaInput,
  type UpdateSchemaInput,
} from './useSchemaRegistry';

