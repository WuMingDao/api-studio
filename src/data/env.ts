import "dotenv/config";
import z from "zod";

const envSchema = z.object({
    OPENAI_VIDEO_KEY: z.string(),
    OPENAI_VIDEO_MODEL: z.string(),
    OPENAI_VIDEO_BASE_URL: z.string().url(),
    PORT: z.coerce.number().default(3000),
    CORS_ORIGIN: z.string().url(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  throw new Error(`Invalid env: ${parsed.error.message}`);
}

export const env = parsed.data;