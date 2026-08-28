"use client";

import { useState } from "react";
import { toast } from "sonner";
import { createPlatformBanner, presignPromoUpload, type PlatformBannerMediaType } from "./actions";

const MEDIA_TYPE_OPTIONS: { value: PlatformBannerMediaType; label: string }[] = [
  { value: "image", label: "Image" },
  { value: "video", label: "Video file" },
  { value: "youtube", label: "YouTube link" },
];

// Images are shown small (a carousel card), 2MB is plenty. Video keeps the
// bucket's own working limit. Both are client-side-only checks — with a
// direct-to-R2 presigned upload, the file's bytes never pass through our
// server at all, so there's no server-side point to check size against.
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const MAX_VIDEO_BYTES = 50 * 1024 * 1024;

// Mirrors platform-promo-presign's ALLOWED_CONTENT_TYPES exactly — every
// value here is something the Edge Function will actually accept.
const MIME_BY_EXTENSION: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  mp4: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",
};
const ALLOWED_CONTENT_TYPES = new Set(Object.values(MIME_BY_EXTENSION));
const DEFAULT_EXTENSION = { image: "jpg", video: "mp4" } as const;

/**
 * Resolves one {extension, contentType} pair used for BOTH the presign
 * request and the actual PUT — they have to match exactly, or R2's
 * signature check fails (Content-Type is a signed header). Previously
 * `file.type` was reused for the PUT but the presign call could fall back
 * to "application/octet-stream" server-side when it was empty — a value
 * that isn't even in the allowlist above, so that fallback was always
 * going to fail one way or another.
 *
 * Also never trusts the filename's raw suffix as a URL path segment — a
 * duplicated file named e.g. "poster.jpg copy" has ".jpg copy" as its
 * "extension", and the space in it makes platform-promo-presign's
 * isValidPath reject the whole path. Only a sanitized, allowlisted
 * extension is used.
 */
function resolveUpload(file: File, mediaType: "image" | "video"): { extension: string; contentType: string } {
  const rawExtension = file.name.includes(".") ? (file.name.split(".").pop() ?? "") : "";
  const sanitizedExtension = rawExtension.toLowerCase().replace(/[^a-z0-9]/g, "");

  if (file.type && ALLOWED_CONTENT_TYPES.has(file.type)) {
    return { extension: sanitizedExtension || DEFAULT_EXTENSION[mediaType], contentType: file.type };
  }
  if (sanitizedExtension && MIME_BY_EXTENSION[sanitizedExtension]) {
    return { extension: sanitizedExtension, contentType: MIME_BY_EXTENSION[sanitizedExtension] };
  }
  const extension = DEFAULT_EXTENSION[mediaType];
  return { extension, contentType: MIME_BY_EXTENSION[extension] };
}

export function CreatePromoForm() {
  // Remount-on-success (key bump) resets every field at once, including the
  // native file input — simpler and more reliable than trying to clear a
  // File out of controlled state by hand.
  const [formKey, setFormKey] = useState(0);
  return <PromoFormFields key={formKey} onSuccess={() => setFormKey((k) => k + 1)} />;
}

function PromoFormFields({ onSuccess }: { onSuccess: () => void }) {
  const [mediaType, setMediaType] = useState<PlatformBannerMediaType>("image");
  const [file, setFile] = useState<File | null>(null);
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [sortOrder, setSortOrder] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Checked immediately on pick, not just on submit — an oversized file is
  // rejected (and the input cleared) before the admin fills out the rest
  // of the form.
  const onFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const picked = event.target.files?.[0];
    if (!picked) return;
    const maxBytes = mediaType === "image" ? MAX_IMAGE_BYTES : MAX_VIDEO_BYTES;
    if (picked.size > maxBytes) {
      toast.error(`File is too large — the limit is ${mediaType === "image" ? "2MB" : "50MB"}.`);
      event.target.value = "";
      setFile(null);
      return;
    }
    setFile(picked);
  };

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      let mediaUrl: string;

      if (mediaType === "youtube") {
        mediaUrl = youtubeUrl.trim();
      } else {
        if (!file) throw new Error(`Choose ${mediaType === "image" ? "an" : "a"} ${mediaType} file to upload.`);

        // Uploaded straight from this browser to R2 via a presigned URL —
        // see actions.ts's presignPromoUpload for why (Next.js Server
        // Actions cap request bodies, and this avoids raising that limit
        // just to re-upload a 50MB video through our own server).
        const { extension, contentType } = resolveUpload(file, mediaType);
        const path = `platform-promos/${mediaType}/${crypto.randomUUID()}.${extension}`;
        const presigned = await presignPromoUpload([{ path, contentType }], "upload");
        if (presigned.error || !presigned.results?.[0]) throw new Error(presigned.error ?? "Couldn't get an upload URL.");

        const uploadResponse = await fetch(presigned.results[0].url, {
          method: "PUT",
          headers: { "Content-Type": contentType },
          body: file,
        });
        if (!uploadResponse.ok) throw new Error(`Upload failed (status ${uploadResponse.status}).`);
        mediaUrl = presigned.results[0].publicUrl;
      }

      const result = await createPlatformBanner({ mediaType, mediaUrl, sortOrder: Number(sortOrder) || 0 });
      if (result.error) throw new Error(result.error);

      toast.success("Promo added.");
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't add this promo.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="mt-5 flex flex-col gap-4 rounded-card border border-border bg-card p-5">
      <div className="flex gap-2">
        {MEDIA_TYPE_OPTIONS.map((option) => (
          <label
            key={option.value}
            className={`flex-1 cursor-pointer rounded-xl border px-3.5 py-2.5 text-center text-sm font-medium transition-colors ${
              mediaType === option.value ? "border-primary bg-primary/10 text-primary" : "border-border text-primary-dark hover:bg-background"
            }`}
          >
            <input
              type="radio"
              name="media_type"
              value={option.value}
              checked={mediaType === option.value}
              onChange={() => {
                setMediaType(option.value);
                setFile(null);
              }}
              className="sr-only"
            />
            {option.label}
          </label>
        ))}
      </div>

      {mediaType === "youtube" ? (
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium text-primary-dark">YouTube URL</span>
          <input
            value={youtubeUrl}
            onChange={(event) => setYoutubeUrl(event.target.value)}
            type="url"
            required
            placeholder="https://www.youtube.com/watch?v=..."
            className="rounded-xl border border-border bg-background px-3.5 py-2.5 text-primary focus:border-primary focus:outline-none"
          />
        </label>
      ) : (
        // key={mediaType} remounts this input on type switch — otherwise a
        // file already picked for "image" would silently still be attached
        // after switching to "video".
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium text-primary-dark">{mediaType === "image" ? "Image" : "Video"} file</span>
          <input
            key={mediaType}
            type="file"
            required
            accept={mediaType === "image" ? "image/jpeg,image/png,image/webp" : "video/mp4,video/webm,video/quicktime"}
            onChange={onFileChange}
            className="rounded-xl border border-border bg-background px-3.5 py-2.5 text-primary file:mr-3 file:rounded-lg file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-white"
          />
          <span className="text-xs text-primary-dark/70">
            {mediaType === "video" ? "MP4, WebM, or MOV — up to 50MB." : "JPG, PNG, or WebP — up to 2MB."}
          </span>
        </label>
      )}

      <label className="flex w-32 flex-col gap-1.5 text-sm">
        <span className="font-medium text-primary-dark">Sort order</span>
        <input
          value={sortOrder}
          onChange={(event) => setSortOrder(event.target.value)}
          type="number"
          placeholder="0"
          className="rounded-xl border border-border bg-background px-3.5 py-2.5 text-primary focus:border-primary focus:outline-none"
        />
      </label>

      <button
        type="submit"
        disabled={isSubmitting}
        className="self-start rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSubmitting ? "Saving…" : "Add Promo"}
      </button>

      {error ? <p className="text-xs text-non-veg">{error}</p> : null}
    </form>
  );
}
