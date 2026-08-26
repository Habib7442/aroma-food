"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { getServiceRoleSupabaseClient } from "@/lib/supabaseServiceRole";
import type { GstStatus, RestaurantStatus } from "@zaavo/shared";

interface AdminSessionClaims {
  superAdmin?: boolean;
}

export interface UpdateRestaurantState {
  error?: string;
  savedAt?: number;
}

const STATUSES: RestaurantStatus[] = ["pending", "approved", "rejected", "suspended"];
const GST_STATUSES: GstStatus[] = ["registered", "composition", "unregistered"];

function isRestaurantStatus(value: unknown): value is RestaurantStatus {
  return typeof value === "string" && STATUSES.includes(value as RestaurantStatus);
}

function isGstStatus(value: unknown): value is GstStatus {
  return typeof value === "string" && GST_STATUSES.includes(value as GstStatus);
}

export async function updateRestaurant(
  id: string,
  _prevState: UpdateRestaurantState,
  formData: FormData,
): Promise<UpdateRestaurantState> {
  // status/commission_rate_bps/gst_status/is_pure_veg have no grantable RLS
  // path for `authenticated` (see the two migrations dated 2026-08-26) — this
  // action uses the service-role key, which bypasses RLS entirely, so this
  // check is the *only* thing standing between "anyone signed in" and these
  // writes. The (admin) layout already gates page renders on this same
  // claim, but a Server Action is invoked directly and doesn't re-run that
  // render — don't rely on the layout alone.
  const { sessionClaims } = await auth();
  const claims = sessionClaims as AdminSessionClaims | null;
  if (!claims?.superAdmin) {
    return { error: "Not authorized." };
  }

  // This action writes with the service-role key (bypasses RLS entirely —
  // see §6), so unlike an RLS-backed write, nothing downstream double-checks
  // these values are actually valid. The <select>s only offer valid options
  // and the commission input has min/max, but that's client-side only — a
  // direct Server Action invocation (or a future refactor of the form) could
  // send anything, and without this check it'd surface as a raw Postgres
  // NOT NULL/CHECK/enum-coercion error instead of a message this form can
  // actually render.
  const status = formData.get("status");
  const gstStatus = formData.get("gst_status");
  const isPureVeg = formData.get("is_pure_veg") === "on";
  const commissionRatePercent = Number(formData.get("commission_rate_percent"));

  if (!isRestaurantStatus(status)) {
    return { error: "Invalid status." };
  }
  if (!isGstStatus(gstStatus)) {
    return { error: "Invalid GST status." };
  }
  if (!Number.isFinite(commissionRatePercent) || commissionRatePercent < 0 || commissionRatePercent > 100) {
    return { error: "Commission rate must be a number between 0 and 100." };
  }

  const supabase = getServiceRoleSupabaseClient();
  const { error } = await supabase
    .from("restaurants")
    .update({
      status,
      gst_status: gstStatus,
      is_pure_veg: isPureVeg,
      commission_rate_bps: Math.round(commissionRatePercent * 100),
    })
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/restaurants");
  revalidatePath(`/restaurants/${id}`);
  return { savedAt: Date.now() };
}
