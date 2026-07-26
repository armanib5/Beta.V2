import { createClient } from "@/lib/supabase/server";
import type { LovEntry, Vendor } from "@/lib/types";
import { VendorDirectory } from "@/components/vendor-directory";

export const dynamic = "force-dynamic";

export default async function VendorDirectoryPage() {
  const supabase = await createClient();
  const [{ data: vendors }, { data: guestListings }] = await Promise.all([
    supabase
      .from("vendors")
      .select("*")
      .eq("status", "active")
      .returns<Vendor[]>(),
    supabase
      .from("lov_entries")
      .select("*")
      .eq("type", "vendor")
      .returns<LovEntry[]>(),
  ]);

  return (
    <VendorDirectory vendors={vendors ?? []} guestListings={guestListings ?? []} />
  );
}
