// Presigns Cloudflare R2 (S3-compatible) PUT/DELETE URLs for vendor image
// uploads — dish photos, category photos, the per-restaurant promo banner.
// The vendor app never holds R2 credentials: it asks this function for a
// presigned URL, uploads/deletes directly against R2 with it, then saves
// the resulting public URL through the normal RLS-protected client path.
//
// aws4fetch, not the full AWS SDK — it's the library Cloudflare's own R2
// docs point to for presigning from an edge runtime (Workers/Deno), avoids
// the full SDK's heavier Node-oriented dependency surface.

import { AwsClient } from "https://esm.sh/aws4fetch@1.0.20";
import { createRemoteJWKSet, jwtVerify } from "https://esm.sh/jose@6.2.4";

const R2_ACCOUNT_ID = Deno.env.get("R2_ACCOUNT_ID")!;
const R2_ACCESS_KEY_ID = Deno.env.get("R2_ACCESS_KEY_ID")!;
const R2_SECRET_ACCESS_KEY = Deno.env.get("R2_SECRET_ACCESS_KEY")!;
const R2_BUCKET_NAME = Deno.env.get("R2_BUCKET_NAME")!;
// Not secret in principle (it's a public bucket URL), but kept server-side
// anyway — the function returns the finished public URL per item, so the
// app never needs its own copy of this to construct one.
const R2_PUBLIC_URL = Deno.env.get("R2_PUBLIC_URL")!.replace(/\/+$/, "");

const R2_ENDPOINT = `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;

const r2Client = new AwsClient({
  accessKeyId: R2_ACCESS_KEY_ID,
  secretAccessKey: R2_SECRET_ACCESS_KEY,
  service: "s3",
  region: "auto",
});

// Not a secret — same Clerk dev-instance domain used by extract-menu-pdf.
// verify_jwt is off for this function too (see config.toml): confirmed live
// in this project that Edge Functions' own gate rejects a real Clerk
// third-party JWT before the function's own code runs, so this function
// verifies the token itself against Clerk's real JWKS.
const CLERK_DOMAIN = "possible-deer-16.clerk.accounts.dev";
const clerkJwks = createRemoteJWKSet(new URL(`https://${CLERK_DOMAIN}/.well-known/jwks.json`));

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

async function verifiedOrgId(authHeader: string | null): Promise<string | null> {
  if (!authHeader) return null;
  const token = authHeader.replace(/^Bearer\s+/i, "");
  try {
    const { payload } = await jwtVerify(token, clerkJwks, {
      issuer: `https://${CLERK_DOMAIN}`,
    });
    const org = payload.o as { id?: string } | undefined;
    return org?.id ?? null;
  } catch {
    return null;
  }
}

// Every path must live under one of these prefixes, immediately followed by
// the caller's own restaurant id — this is the actual security boundary,
// not just the JWT check above: without it, a valid vendor could request a
// presigned URL for a path under a DIFFERENT restaurant's folder.
const ALLOWED_PREFIXES = ["menu", "categories", "banners", "logo"];

function isPathOwnedBy(path: string, restaurantId: string): boolean {
  if (path.includes("..") || path.startsWith("/")) return false;
  const [prefix, orgSegment, ...rest] = path.split("/");
  return (
    ALLOWED_PREFIXES.includes(prefix) &&
    orgSegment === restaurantId &&
    rest.length > 0 &&
    rest.every((segment) => segment.length > 0)
  );
}

interface PresignItem {
  path: string;
  contentType?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  try {
    const { restaurantId, action, items } = await req.json();

    if (!restaurantId || typeof restaurantId !== "string") {
      return jsonResponse({ error: "Missing restaurantId" }, 400);
    }
    if (action !== "upload" && action !== "delete") {
      return jsonResponse({ error: "action must be 'upload' or 'delete'" }, 400);
    }
    if (!Array.isArray(items) || items.length === 0 || items.length > 10) {
      return jsonResponse({ error: "items must be a non-empty array of at most 10 entries" }, 400);
    }

    const callerOrgId = await verifiedOrgId(req.headers.get("Authorization"));
    if (!callerOrgId) {
      return jsonResponse({ error: "Unauthorized: missing or invalid session" }, 401);
    }
    if (callerOrgId !== restaurantId) {
      return jsonResponse(
        { error: "Forbidden: restaurantId does not match the caller's active organization" },
        403,
      );
    }

    const results: { path: string; url: string; publicUrl: string }[] = [];
    for (const item of items as PresignItem[]) {
      if (!item || typeof item.path !== "string" || !isPathOwnedBy(item.path, restaurantId)) {
        return jsonResponse({ error: `Invalid or unauthorized path: ${item?.path}` }, 403);
      }

      const objectUrl = `${R2_ENDPOINT}/${R2_BUCKET_NAME}/${item.path}`;
      const method = action === "upload" ? "PUT" : "DELETE";
      // Content-Type is a signed header on upload — the client's actual PUT
      // must send this exact value or R2 rejects the signature. This is
      // deliberate: it stops a vendor's client from uploading a mismatched
      // or spoofed content type through an otherwise-valid presigned URL.
      const headers = action === "upload" ? { "content-type": item.contentType || "application/octet-stream" } : {};

      const signedRequest = await r2Client.sign(objectUrl, {
        method,
        headers,
        aws: { signQuery: true },
      });
      results.push({ path: item.path, url: signedRequest.url, publicUrl: `${R2_PUBLIC_URL}/${item.path}` });
    }

    return jsonResponse({ success: true, results });
  } catch (err) {
    console.error("[r2-presign]", err);
    const detail = err instanceof Error ? err.message : String(err);
    return jsonResponse({ error: `Unexpected error: ${detail}` }, 500);
  }
});
