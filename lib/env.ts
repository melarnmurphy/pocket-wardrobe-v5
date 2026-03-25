import { z } from "zod";

const optionalUrl = z.preprocess((value) => {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length ? trimmed : undefined;
}, z.string().url().optional());

const optionalString = z.preprocess((value) => {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length ? trimmed : undefined;
}, z.string().min(1).optional());

const optionalCsvString = z.preprocess((value) => {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length ? trimmed : undefined;
}, z.string().min(1).optional());

const publicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  NEXT_PUBLIC_PREMIUM_UPGRADE_URL: optionalUrl
});

const serverEnvSchema = publicEnvSchema.extend({
  PIPELINE_SERVICE_URL: z.string().url().default("http://localhost:8000"),
  OPENAI_API_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  WEATHERAPI_KEY: optionalString,
  OPEN_METEO_API_KEY: optionalString,
  WEATHER_PROVIDER_DEFAULT: z.enum(["weatherapi", "open-meteo"]).optional(),
  BILLING_PROVIDER: z.enum(["stripe"]).optional(),
  BILLING_SYNC_SECRET: optionalString
});

const billingEnvSchema = z.object({
  BILLING_PROVIDER: z.enum(["stripe"]).optional(),
  BILLING_SYNC_SECRET: optionalString,
  ADMIN_EMAILS: optionalCsvString
});

export type PublicEnv = z.infer<typeof publicEnvSchema>;
export type ServerEnv = z.infer<typeof serverEnvSchema>;
export type BillingEnv = z.infer<typeof billingEnvSchema>;

export function getPublicEnv(): PublicEnv {
  return publicEnvSchema.parse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_PREMIUM_UPGRADE_URL: process.env.NEXT_PUBLIC_PREMIUM_UPGRADE_URL
  });
}

export function getServerEnv(): ServerEnv {
  return serverEnvSchema.parse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    PIPELINE_SERVICE_URL: process.env.PIPELINE_SERVICE_URL,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    WEATHERAPI_KEY: process.env.WEATHERAPI_KEY,
    OPEN_METEO_API_KEY: process.env.OPEN_METEO_API_KEY,
    WEATHER_PROVIDER_DEFAULT: process.env.WEATHER_PROVIDER_DEFAULT,
    NEXT_PUBLIC_PREMIUM_UPGRADE_URL: process.env.NEXT_PUBLIC_PREMIUM_UPGRADE_URL,
    BILLING_PROVIDER: process.env.BILLING_PROVIDER,
    BILLING_SYNC_SECRET: process.env.BILLING_SYNC_SECRET
  });
}

export function getBillingEnv(): BillingEnv {
  return billingEnvSchema.parse({
    BILLING_PROVIDER: process.env.BILLING_PROVIDER,
    BILLING_SYNC_SECRET: process.env.BILLING_SYNC_SECRET,
    ADMIN_EMAILS: process.env.ADMIN_EMAILS
  });
}
