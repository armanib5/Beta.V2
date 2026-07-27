import type { SupabaseClient } from "@supabase/supabase-js";
import type { ActivityEntityType } from "@/lib/types";

/** Fire-and-forget: an admin action getting logged shouldn't block or
 * fail the action itself if the log write has a problem. */
export function logActivity(
  supabase: SupabaseClient,
  entityType: ActivityEntityType,
  entityId: string,
  entityName: string,
  action: string,
  detail?: string,
): void {
  supabase
    .from("activity_log")
    .insert({ entity_type: entityType, entity_id: entityId, entity_name: entityName, action, detail: detail ?? null })
    .then(() => {});
}
