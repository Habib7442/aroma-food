import { FunctionsHttpError } from "@supabase/supabase-js";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { useState } from "react";

import { useSupabase } from "./supabase";

export type ImageEntityType = "menu" | "categories" | "banners" | "logo";

interface SizeConfig {
  width: number;
  suffix: string;
}

// Two sizes for dishes/categories (full for detail views, thumb for
// list/grid views — never fetch more bytes than the screen needs), one size
// for the promo banner (landscape) and the logo (small, square — never
// shown large enough to need a second size).
const ENTITY_CONFIG: Record<ImageEntityType, { sizes: SizeConfig[]; aspect: [number, number] }> = {
  menu: {
    sizes: [
      { width: 1200, suffix: "full" },
      { width: 400, suffix: "thumb" },
    ],
    aspect: [1, 1],
  },
  categories: {
    sizes: [
      { width: 1200, suffix: "full" },
      { width: 400, suffix: "thumb" },
    ],
    aspect: [1, 1],
  },
  banners: {
    sizes: [{ width: 1200, suffix: "full" }],
    aspect: [3, 1],
  },
  logo: {
    sizes: [{ width: 512, suffix: "full" }],
    aspect: [1, 1],
  },
};

/**
 * Human-readable size hint for the upload UI, derived from the same config
 * used to actually compress the image — so the label shown to a vendor can
 * never drift out of sync with what's really produced.
 */
export function getImageSizeLabel(entityType: ImageEntityType): string {
  const config = ENTITY_CONFIG[entityType];
  const fullSize = config.sizes.find((size) => size.suffix === "full") ?? config.sizes[0];
  const [aspectW, aspectH] = config.aspect;
  const height = Math.round((fullSize.width * aspectH) / aspectW);
  const shape = aspectW === aspectH ? "Square" : `${aspectW}:${aspectH} Landscape`;
  return `Recommended: ${fullSize.width} × ${height}px (${shape})`;
}

/**
 * A non-cryptographic client-side id for a new entity that doesn't have a
 * database row yet (e.g. a new banner) — needed as the R2 path's entityId
 * before the row exists. Inserted as that same row's real primary key
 * afterward (Postgres accepts a client-supplied value for a `default
 * gen_random_uuid()` column — the default only applies when omitted).
 */
export function generateEntityId(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export interface UploadedImageUrls {
  fullUrl: string;
  thumbnailUrl: string | null;
}

interface PresignResultItem {
  path: string;
  url: string;
  publicUrl: string;
}

const BASE64_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

// Dependency-free base64 decoder — deliberately not relying on a global
// atob/Buffer (not guaranteed present in every RN/Hermes setup) or on
// re-reading the manipulator's output file via fetch(localUri), which on
// this app's Android build silently returned a 14-byte "File not found"
// stand-in instead of the actual image bytes (confirmed live: the object
// that landed in R2 was literally that string). Getting the bytes directly
// from ImageManipulator's own base64 output sidesteps that file read
// entirely.
function base64ToUint8Array(base64: string): Uint8Array {
  const cleaned = base64.replace(/=+$/, "");
  const bytes = new Uint8Array(Math.floor((cleaned.length * 6) / 8));
  let byteIndex = 0;
  let buffer = 0;
  let bitsInBuffer = 0;
  for (let i = 0; i < cleaned.length; i++) {
    const value = BASE64_ALPHABET.indexOf(cleaned[i]);
    if (value === -1) continue;
    buffer = (buffer << 6) | value;
    bitsInBuffer += 6;
    if (bitsInBuffer >= 8) {
      bitsInBuffer -= 8;
      bytes[byteIndex++] = (buffer >> bitsInBuffer) & 0xff;
    }
  }
  return bytes;
}

export function useImageUpload() {
  const supabase = useSupabase();
  const [isUploading, setIsUploading] = useState(false);

  const presign = async (
    restaurantId: string,
    action: "upload" | "delete",
    items: { path: string; contentType?: string }[],
  ): Promise<PresignResultItem[]> => {
    const { data, error } = await supabase.functions.invoke<{
      success?: true;
      results?: PresignResultItem[];
      error?: string;
    }>("r2-presign", { body: { restaurantId, action, items } });

    if (error) {
      // FunctionsHttpError's own `.message` is always the generic "Edge
      // Function returned a non-2xx status code" — the real reason is in
      // `.context`, the raw Response the function sent.
      let detail: string | undefined;
      if (error instanceof FunctionsHttpError) {
        detail = await error.context
          .json()
          .then((body: { error?: string }) => body.error)
          .catch(() => undefined);
      }
      throw new Error(detail ?? error.message ?? "Couldn't reach the image upload service.");
    }
    if (!data?.success || !data.results) {
      throw new Error(data?.error ?? "Couldn't reach the image upload service.");
    }
    return data.results;
  };

  /**
   * Picks a photo, compresses it to the sizes this entity type needs (WebP,
   * quality 80), uploads each size directly to R2 via a presigned URL, and
   * returns the resulting public URLs. Returns null if the vendor cancelled
   * the picker. Does not touch the database — the caller saves the URLs and
   * is responsible for calling `deleteExisting` on whatever URLs they're
   * replacing.
   */
  const pickAndUpload = async (params: {
    restaurantId: string;
    entityType: ImageEntityType;
    entityId: string;
  }): Promise<UploadedImageUrls | null> => {
    const config = ENTITY_CONFIG[params.entityType];

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      throw new Error("Photo library permission is required to upload an image.");
    }

    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: config.aspect,
      quality: 1,
    });
    if (picked.canceled || !picked.assets?.[0]) return null;

    setIsUploading(true);
    try {
      const sourceUri = picked.assets[0].uri;
      const timestamp = Date.now();

      const renderedBytes: Uint8Array[] = [];
      for (const size of config.sizes) {
        const rendered = await ImageManipulator.manipulate(sourceUri).resize({ width: size.width }).renderAsync();
        const saved = await rendered.saveAsync({ format: SaveFormat.WEBP, compress: 0.8, base64: true });
        if (!saved.base64) throw new Error("Couldn't compress the image.");
        renderedBytes.push(base64ToUint8Array(saved.base64));
      }

      const presignItems = config.sizes.map((size) => ({
        path: `${params.entityType}/${params.restaurantId}/${params.entityId}-${timestamp}-${size.suffix}.webp`,
        contentType: "image/webp",
      }));
      const presigned = await presign(params.restaurantId, "upload", presignItems);

      for (let i = 0; i < config.sizes.length; i++) {
        const uploadResponse = await fetch(presigned[i].url, {
          method: "PUT",
          headers: { "Content-Type": "image/webp" },
          // Always a plain ArrayBuffer at runtime — base64ToUint8Array always
          // allocates a fresh, non-shared buffer — TS just can't express that
          // through TypedArray's now-generic `.buffer` type.
          body: renderedBytes[i].buffer as ArrayBuffer,
        });
        if (!uploadResponse.ok) {
          throw new Error(`Couldn't upload the image (status ${uploadResponse.status}).`);
        }
      }

      const bySuffix = new Map(config.sizes.map((size, i) => [size.suffix, presigned[i].publicUrl]));
      return {
        fullUrl: bySuffix.get("full")!,
        thumbnailUrl: bySuffix.get("thumb") ?? null,
      };
    } finally {
      setIsUploading(false);
    }
  };

  /**
   * Best-effort cleanup of previously-uploaded images being replaced —
   * derives each object's path from its stored public URL, requests
   * presigned DELETE URLs, and calls them. Never throws: a failed cleanup
   * shouldn't block the screen that's saving a new image over an old one,
   * it just means a harmless orphaned object sits in the bucket.
   */
  const deleteExisting = async (restaurantId: string, urls: (string | null | undefined)[]): Promise<void> => {
    const validUrls = urls.filter((url): url is string => !!url);
    if (validUrls.length === 0) return;
    try {
      const items = validUrls.map((url) => ({ path: new URL(url).pathname.replace(/^\/+/, "") }));
      const presigned = await presign(restaurantId, "delete", items);
      await Promise.all(presigned.map((item) => fetch(item.url, { method: "DELETE" })));
    } catch (err) {
      console.warn("[useImageUpload] couldn't delete previous image(s):", err);
    }
  };

  return { pickAndUpload, deleteExisting, isUploading };
}
