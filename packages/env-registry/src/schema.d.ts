import { z } from 'zod';
export declare const envServerSchema: z.ZodObject<{
    SUPABASE_URL: z.ZodString;
    SUPABASE_ANON_KEY: z.ZodString;
    SERVICE_ROLE_KEY: z.ZodString;
    SUPABASE_READ_REPLICA_URL: z.ZodOptional<z.ZodString>;
    NODE_ENV: z.ZodEnum<["development", "staging", "production"]>;
    PAYMENT_ALIMBANK_API_URL: z.ZodOptional<z.ZodString>;
    PAYMENT_ALIMBANK_API_KEY: z.ZodOptional<z.ZodString>;
    PAYMENT_WEBHOOK_SECRET: z.ZodOptional<z.ZodString>;
    PAYMENT_WEBHOOK_ROLE_KEY: z.ZodOptional<z.ZodString>;
    BILLING_BATCH_ROLE_KEY: z.ZodOptional<z.ZodString>;
    ANALYTICS_ROLE_KEY: z.ZodOptional<z.ZodString>;
    CUSTOM_DOMAIN_VERIFY_SECRET: z.ZodOptional<z.ZodString>;
    AWS_LAMBDA_ANALYTICS_FUNCTION_NAME: z.ZodOptional<z.ZodString>;
    CLOUDFLARE_WORKER_ANALYTICS_URL: z.ZodOptional<z.ZodString>;
    KAKAO_REST_API_KEY: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    SUPABASE_URL: string;
    SUPABASE_ANON_KEY: string;
    SERVICE_ROLE_KEY: string;
    NODE_ENV: "development" | "staging" | "production";
    SUPABASE_READ_REPLICA_URL?: string | undefined;
    PAYMENT_ALIMBANK_API_URL?: string | undefined;
    PAYMENT_ALIMBANK_API_KEY?: string | undefined;
    PAYMENT_WEBHOOK_SECRET?: string | undefined;
    PAYMENT_WEBHOOK_ROLE_KEY?: string | undefined;
    BILLING_BATCH_ROLE_KEY?: string | undefined;
    ANALYTICS_ROLE_KEY?: string | undefined;
    CUSTOM_DOMAIN_VERIFY_SECRET?: string | undefined;
    AWS_LAMBDA_ANALYTICS_FUNCTION_NAME?: string | undefined;
    CLOUDFLARE_WORKER_ANALYTICS_URL?: string | undefined;
    KAKAO_REST_API_KEY?: string | undefined;
}, {
    SUPABASE_URL: string;
    SUPABASE_ANON_KEY: string;
    SERVICE_ROLE_KEY: string;
    NODE_ENV: "development" | "staging" | "production";
    SUPABASE_READ_REPLICA_URL?: string | undefined;
    PAYMENT_ALIMBANK_API_URL?: string | undefined;
    PAYMENT_ALIMBANK_API_KEY?: string | undefined;
    PAYMENT_WEBHOOK_SECRET?: string | undefined;
    PAYMENT_WEBHOOK_ROLE_KEY?: string | undefined;
    BILLING_BATCH_ROLE_KEY?: string | undefined;
    ANALYTICS_ROLE_KEY?: string | undefined;
    CUSTOM_DOMAIN_VERIFY_SECRET?: string | undefined;
    AWS_LAMBDA_ANALYTICS_FUNCTION_NAME?: string | undefined;
    CLOUDFLARE_WORKER_ANALYTICS_URL?: string | undefined;
    KAKAO_REST_API_KEY?: string | undefined;
}>;
export declare const envClientSchema: z.ZodObject<{
    NEXT_PUBLIC_SUPABASE_URL: z.ZodString;
    NEXT_PUBLIC_SUPABASE_ANON_KEY: z.ZodString;
    NEXT_PUBLIC_KAKAO_JS_KEY: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    NEXT_PUBLIC_SUPABASE_URL: string;
    NEXT_PUBLIC_SUPABASE_ANON_KEY: string;
    NEXT_PUBLIC_KAKAO_JS_KEY?: string | undefined;
}, {
    NEXT_PUBLIC_SUPABASE_URL: string;
    NEXT_PUBLIC_SUPABASE_ANON_KEY: string;
    NEXT_PUBLIC_KAKAO_JS_KEY?: string | undefined;
}>;
export declare const envCommonSchema: z.ZodObject<{
    APP_NAME: z.ZodOptional<z.ZodString>;
    APP_VERSION: z.ZodOptional<z.ZodString>;
    INDUSTRY_MODE: z.ZodOptional<z.ZodEnum<["academy", "salon", "realestate", "gym", "ngo"]>>;
}, "strip", z.ZodTypeAny, {
    APP_NAME?: string | undefined;
    APP_VERSION?: string | undefined;
    INDUSTRY_MODE?: "academy" | "salon" | "realestate" | "gym" | "ngo" | undefined;
}, {
    APP_NAME?: string | undefined;
    APP_VERSION?: string | undefined;
    INDUSTRY_MODE?: "academy" | "salon" | "realestate" | "gym" | "ngo" | undefined;
}>;
export type EnvServer = z.infer<typeof envServerSchema>;
export type EnvClient = z.infer<typeof envClientSchema>;
export type EnvCommon = z.infer<typeof envCommonSchema>;
//# sourceMappingURL=schema.d.ts.map