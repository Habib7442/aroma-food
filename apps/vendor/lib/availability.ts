// Mirrors the exact formula in the menu_items_select_public_available RLS
// policy (supabase/migrations/20260826192847_menu_item_scheduled_availability.sql)
// — a scheduled pause never needs a follow-up write to "expire": once real
// time passes unavailable_until, this returns true purely by comparing
// against Date.now(), same as the policy compares against now() in Postgres.
export function isEffectivelyAvailable(item: { is_available: boolean; unavailable_until: string | null }): boolean {
  if (item.is_available) return true;
  if (!item.unavailable_until) return false;
  return new Date(item.unavailable_until).getTime() <= Date.now();
}

/**
 * "Live" or "Paused until 12:45 PM" (same day) / "Paused until Aug 28, 12:45
 * PM" (a custom date further out) for a status badge. Only ever shows a
 * resolved future time — isEffectivelyAvailable() already covers "the
 * scheduled time has passed", so by the time this would say "Paused until"
 * a past time, isEffectivelyAvailable() is already true and the caller
 * shows "Live" instead.
 */
export function describeAvailability(item: { is_available: boolean; unavailable_until: string | null }): string {
  if (isEffectivelyAvailable(item)) return "Live";
  if (item.unavailable_until) {
    const until = new Date(item.unavailable_until);
    const now = new Date();
    const time = until.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    const isSameDay =
      until.getFullYear() === now.getFullYear() && until.getMonth() === now.getMonth() && until.getDate() === now.getDate();
    if (isSameDay) return `Paused until ${time}`;
    const date = until.toLocaleDateString([], { month: "short", day: "numeric" });
    return `Paused until ${date}, ${time}`;
  }
  return "Paused";
}

// Three distinct badge states rather than a plain live/paused boolean — a
// scheduled pause reads as a temporary, less-alarming state (amber) than an
// indefinite one a vendor has to remember to undo (gray).
export type AvailabilityStatus = "live" | "scheduled" | "paused";

export function getAvailabilityStatus(item: { is_available: boolean; unavailable_until: string | null }): AvailabilityStatus {
  if (isEffectivelyAvailable(item)) return "live";
  return item.unavailable_until ? "scheduled" : "paused";
}
