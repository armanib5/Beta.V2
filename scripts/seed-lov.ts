/**
 * Bulk-seeds this month's "List of Vendors & Events" (LOV) into the
 * `lov_entries` table (and creates any missing categories).
 *
 * Usage:
 *   npm run seed:lov -- seed/lov.json
 *   (defaults to seed/lov.json if no path is given)
 *
 * Paste your month's raw list into a JSON file matching the shape in
 * seed/lov.example.json, then run this script. Safe to re-run: rows are
 * matched by (type, name, date) — or just (type, name) for recurring rows
 * with no fixed date, like a weekly farmers market — and updated in place.
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { config as loadEnv } from "dotenv";
import { z } from "zod";

loadEnv({ path: ".env.local" });

const lovRowSchema = z.object({
  type: z.enum(["event", "vendor"]),
  name: z.string().min(1),
  date: z.string().nullable().optional(),
  location: z.string().nullable().optional(),
  lat: z.number().nullable().optional(),
  lng: z.number().nullable().optional(),
  instagram_handle: z.string().nullable().optional(),
  category: z.string().nullable().optional(),
  booth_tier: z.enum(["top", "regular"]).default("regular"),
  flyer_image_url: z.string().nullable().optional(),
  recurrence: z.string().nullable().optional(),
  website_url: z.string().nullable().optional(),
});

function slugify(input: string): string {
  return (
    input
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "category"
  );
}

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY (check .env.local).",
    );
  }
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const filePath = process.argv[2] ?? "seed/lov.json";
  const raw = JSON.parse(readFileSync(filePath, "utf-8"));
  const rows = z.array(lovRowSchema).parse(raw);

  console.log(`Loaded ${rows.length} LOV rows from ${filePath}`);

  const categoryCache = new Map<string, string>();

  async function resolveCategoryId(name: string | null | undefined): Promise<string | null> {
    if (!name) return null;
    const key = name.trim().toLowerCase();
    if (categoryCache.has(key)) return categoryCache.get(key)!;

    const { data: existing } = await supabase
      .from("categories")
      .select("id")
      .ilike("name", name.trim())
      .maybeSingle();

    if (existing) {
      categoryCache.set(key, existing.id);
      return existing.id;
    }

    const { data: created, error } = await supabase
      .from("categories")
      .insert({ name: name.trim(), slug: slugify(name) })
      .select("id")
      .single();

    if (error || !created) {
      throw new Error(`Could not create category "${name}": ${error?.message}`);
    }
    categoryCache.set(key, created.id);
    return created.id;
  }

  let succeeded = 0;
  let failed = 0;

  for (const row of rows) {
    const categoryId = await resolveCategoryId(row.category);
    const record = {
      type: row.type,
      name: row.name,
      event_date: row.date ?? null,
      location: row.location ?? null,
      lat: row.lat ?? null,
      lng: row.lng ?? null,
      instagram_handle: row.instagram_handle ?? null,
      category_id: categoryId,
      booth_tier: row.booth_tier,
      flyer_image_url: row.flyer_image_url ?? null,
      recurrence: row.recurrence ?? null,
      website_url: row.website_url ?? null,
    };

    const { error } = await supabase
      .from("lov_entries")
      .upsert(record, { onConflict: "type,name,event_date_key" });

    if (error) {
      failed++;
      console.error(`✗ ${row.type} "${row.name}": ${error.message}`);
      continue;
    }

    succeeded++;
    console.log(`✓ ${row.type} "${row.name}"`);
  }

  console.log(`\nDone. ${succeeded} upserted, ${failed} failed.`);
  if (failed > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
