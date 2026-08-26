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

  const status = formData.get("status") as RestaurantStatus;
  const gstStatus = formData.get("gst_status") as GstStatus;
  const isPureVeg = formData.get("is_pure_veg") === "on";
  const commissionRatePercent = Number(formData.get("commission_rate_percent"));

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
