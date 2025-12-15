import dotenv from "dotenv";
import { z } from "zod";

// Load .env file
dotenv.config({ path: "./.env" });

// Define the schema for your environment variables
const envSchema = z.object({
  // Server Config
  PORT: z.string().default("8001"),
  CORS_ORIGIN: z.string().default("*"),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),

  // Database (Postgres)
  DATABASE_URL: z.string().url({ message: "DATABASE_URL must be a valid URL" }),

  // Auth (JWT)
  ACCESS_TOKEN_SECRET: z.string().min(1, "Access Token Secret is required"),
  ACCESS_TOKEN_EXPIRY: z.string().default("1d"),
  REFRESH_TOKEN_SECRET: z.string().min(1, "Refresh Token Secret is required"),
  REFRESH_TOKEN_EXPIRY: z.string().default("10d"),

  // Cloudinary
  CLOUDINARY_CLOUD_NAME: z.string().min(1, "Cloud Name is required"),
  CLOUDINARY_API_KEY: z.string().min(1, "API Key is required"),
  CLOUDINARY_API_SECRET: z.string().min(1, "API Secret is required"),
});

// Validate process.env
const _env = envSchema.safeParse(process.env);

if (!_env.success) {
  console.error("❌ Invalid environment variables:", _env.error.format());
  process.exit(1);
}

// Export the validated variables
export const env = _env.data;