/**
 * Next.js can only inline a public env var when the property is read
 * *statically* — `process.env.NEXT_PUBLIC_FOO`. A dynamic lookup like
 * `process.env[name]` is left untouched by the bundler and resolves to
 * undefined in the browser, which is why these two reads must stay
 * literal and live at module scope.
 *
 * Same variable names, same public API, same "missing variable" error as
 * before — only the property access changed.
 */
const NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const NEXT_PUBLIC_SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function requireEnv(value: string | undefined, name: string): string {
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const supabaseUrl = () => requireEnv(NEXT_PUBLIC_SUPABASE_URL, "NEXT_PUBLIC_SUPABASE_URL");
export const supabaseAnonKey = () =>
  requireEnv(NEXT_PUBLIC_SUPABASE_ANON_KEY, "NEXT_PUBLIC_SUPABASE_ANON_KEY");
