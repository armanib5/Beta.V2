function requireEnv(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

// Next.js only inlines NEXT_PUBLIC_* vars into the static export when the
// literal `process.env.NEXT_PUBLIC_X` expression appears in the source —
// dynamic access like `process.env[name]` can't be statically replaced and
// is always undefined in the browser bundle.
export const supabaseUrl = () =>
  requireEnv("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL);
export const supabaseAnonKey = () =>
  requireEnv(
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
