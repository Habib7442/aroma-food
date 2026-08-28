"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { getSupabaseClient } from "@/lib/supabase";

interface AdminSessionClaims {
  superAdmin?: boolean;
}

const MEDIA_TYPES = ["image", "video", "youtube"] as const;
export type PlatformBannerMediaType = (typeof MEDIA_TYPES)[number];

function isMediaType(value: unknown): value is PlatformBannerMediaType {
  return typeof value === "string" && (MEDIA_TYPES as readonly string[]).includes(value);
}

function isValidYoutubeUrl(url: string): boolean {
  return /^https:\/\/(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)[\w-]+/.test(url);
}

interface PresignResultItem {
  path: string;
  url: string;
  publicUrl: string;
}

// Requests a presigned R2 URL from the platform-promo-presign Edge
// Function (super-admin-gated there too — this check is belt-and-suspenders,
// same reasoning as restaurants/[id]/actions.ts's identical comment). The
// actual PUT of the file happens client-side, straight from the browser to
// R2 — never through this server, which is the whole point: Next.js Server
// Actions cap request bodies (1MB by default), and routing a 50MB video
// through one just to re-upload it to R2 would need raising that limit for
// no reason when a presigned URL avoids the server hop entirely.
export async function presignPromoUpload(
  items: { path: string; contentType: string }[],
  action: "upload" | "delete",
): Promise<{ results?: PresignResultItem[]; error?: string }> {
  const { sessionClaims } = await auth();
  const claims = sessionClaims as AdminSessionClaims | null;
  if (!claims?.superAdmin) return { error: "Not authorized." };

  const supabase = await getSupabaseClient();
  const { data, error } = await supabase.functions.invoke<{
    success?: true;
    results?: PresignResultItem[];
    error?: string;
  }>("platform-promo-presign", { body: { action, items } });

  if (error) return { error: error.message ?? "Couldn't reach the upload service." };
  if (!data?.success || !data.results) return { error: data?.error ?? "Couldn't reach the upload service." };
  return { results: data.results };
}

export async function createPlatformBanner(input: {
  mediaType: PlatformBannerMediaType;
  mediaUrl: string;
  sortOrder: number;
}): Promise<{ error?: string }> {
  if (!isMediaType(input.mediaType)) return { error: "Choose a media type." };
  if (input.mediaType === "youtube" && !isValidYoutubeUrl(input.mediaUrl)) {
    return { error: "Enter a valid youtube.com or youtu.be video URL." };
  }
  if (!input.mediaUrl) return { error: "Missing media URL." };

  const supabase = await getSupabaseClient();
  const { error } = await supabase.from("platform_banners").insert({
    media_type: input.mediaType,
    media_url: input.mediaUrl,
    sort_order: Number.isFinite(input.sortOrder) ? input.sortOrder : 0,
  });
  if (error) return { error: error.message };

  revalidatePath("/promos");
  return {};
}

export async function deletePlatformBanner(
  id: string,
  mediaType: PlatformBannerMediaType,
  mediaUrl: string,
): Promise<{ error?: string }> {
  // Best-effort R2 cleanup for uploaded files — a youtube banner has
  // nothing in the bucket to remove. The row still gets deleted even if
  // this fails; a leftover object in R2 is a far smaller problem than a
  // delete button that silently does nothing on a storage hiccup.
  if (mediaType !== "youtube") {
    const path = new URL(mediaUrl).pathname.replace(/^\/+/, "");
    if (path.startsWith("platform-promos/")) {
      const { results } = await presignPromoUpload([{ path, contentType: "" }], "delete");
      if (results?.[0]) await fetch(results[0].url, { method: "DELETE" }).catch(() => undefined);
    }
  }

  const supabase = await getSupabaseClient();
  const { error } = await supabase.from("platform_banners").delete().eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/promos");
  return {};
}

export async function togglePlatformBannerActive(id: string, isActive: boolean): Promise<{ error?: string }> {
  const supabase = await getSupabaseClient();
  const { error } = await supabase.from("platform_banners").update({ is_active: isActive }).eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/promos");
  return {};
}
