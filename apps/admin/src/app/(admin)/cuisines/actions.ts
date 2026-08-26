"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseClient } from "@/lib/supabase";

export interface CuisineFormState {
  error?: string;
  // Distinct from the initial {} state — without this, a just-succeeded
  // submission is indistinguishable from "never submitted yet", and the
  // form can't tell when to fire its success toast.
  successAt?: number;
}

export async function createCuisine(_prevState: CuisineFormState, formData: FormData): Promise<CuisineFormState> {
  const name = String(formData.get("name") ?? "").trim();
  const sortOrder = Number(formData.get("sort_order") ?? 0);
  if (!name) return { error: "Enter a name." };

  const supabase = await getSupabaseClient();
  const { error } = await supabase.from("cuisines").insert({ name, sort_order: sortOrder });
  if (error) return { error: error.message };

  revalidatePath("/cuisines");
  return { successAt: Date.now() };
}

export async function updateCuisine(
  id: string,
  values: { name: string; sortOrder: number },
): Promise<{ error?: string }> {
  const name = values.name.trim();
  if (!name) return { error: "Enter a name." };

  const supabase = await getSupabaseClient();
  const { error } = await supabase.from("cuisines").update({ name, sort_order: values.sortOrder }).eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/cuisines");
  return {};
}

export async function deleteCuisine(id: string): Promise<{ error?: string }> {
  const supabase = await getSupabaseClient();
  const { error } = await supabase.from("cuisines").delete().eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/cuisines");
  return {};
}
