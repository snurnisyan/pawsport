import dotenv from "dotenv";
import { z } from "zod";

const nodeEnv = process.env.NODE_ENV ?? "development";
dotenv.config({ path: `.env.${nodeEnv}` });
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

const booleanFromString = z.preprocess((value) => {
  if (typeof value === "string") {
    return value.toLowerCase() === "true";
  }

  return value;
}, z.boolean());

const envSchema = z
  .object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  API_PREFIX: z.string().default("/api"),
  CORS_ORIGIN: z.string().default("http://localhost:3000"),
  FRONTEND_URL: z.string().url().default("http://localhost:3000"),

  MONGODB_URI: z.string().min(1),

  JWT_SECRET: z.string().min(1),
  JWT_EXPIRES_IN: z.string().default("7d"),

  SMTP_HOST: z.string().min(1),
  SMTP_PORT: z.coerce.number().int().positive(),
  SMTP_SECURE: booleanFromString.default(true),
  SMTP_USER: z.string().min(1),
  SMTP_PASSWORD: z.string().min(1),
  SMTP_FROM: z.string().min(1),

  S3_ENDPOINT: z.string().min(1),
  S3_REGION: z.string().min(1),
  S3_BUCKET: z.string().min(1),
  S3_ACCESS_KEY_ID: z.string().min(1),
  S3_SECRET_ACCESS_KEY: z.string().min(1),

  REMINDER_SCHEDULER_ENABLED: booleanFromString.default(false),
  REMINDER_POLL_INTERVAL_MS: z.coerce.number().int().positive().default(60000),

  BACKGROUND_JOB_RUNNER_ENABLED: booleanFromString.default(false),
  BACKGROUND_JOB_POLL_INTERVAL_MS: z.coerce.number().int().positive().default(5000),
  BACKGROUND_JOB_CONCURRENCY: z.coerce.number().int().positive().default(2),
  BACKGROUND_JOB_VISIBILITY_TIMEOUT_MS: z.coerce.number().int().positive().default(60000),
  BACKGROUND_JOB_DEFAULT_MAX_ATTEMPTS: z.coerce.number().int().positive().default(5),

  EXPORT_RETENTION_DAYS: z.coerce.number().positive().default(7),
  EXPORT_CLEANUP_INTERVAL_HOURS: z.coerce.number().positive().default(24),
  EXPORT_CLEANUP_BATCH_SIZE: z.coerce.number().int().positive().default(100),

  GOTENBERG_URL: z.string().url().optional(),
  GOTENBERG_TIMEOUT_MS: z.coerce.number().int().positive().default(60000),

  SWAGGER_ENABLED: booleanFromString.default(false)
  })
  .superRefine((value, context) => {
    if (
      value.NODE_ENV === "production" &&
      value.BACKGROUND_JOB_RUNNER_ENABLED &&
      !value.GOTENBERG_URL
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["GOTENBERG_URL"],
        message: "GOTENBERG_URL is required when BACKGROUND_JOB_RUNNER_ENABLED=true in production"
      });
    }
  });

export const env = envSchema.parse(process.env);

export type Env = typeof env;
