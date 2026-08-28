// Presigns Cloudflare R2 PUT/DELETE URLs for apps/admin's Promos page —
// same R2 bucket/credentials as r2-presign, but a completely different
// authorization model (platform super-admin, not restaurant/org
// ownership), so kept as its own function rather than adding a second
// auth branch to r2-presign's vendor-scoped checks.

import { AwsClient } from "https://esm.sh/aws4fetch@1.0.20";
import { createRemoteJWKSet, jwtVerify } from "https://esm.sh/jose@6.2.4";

const R2_ACCOUNT_ID = Deno.env.get("R2_ACCOUNT_ID")!;
const R2_ACCESS_KEY_ID = Deno.env.get("R2_ACCESS_KEY_ID")!;
const R2_SECRET_ACCESS_KEY = Deno.env.get("R2_SECRET_ACCESS_KEY")!;
const R2_BUCKET_NAME = Deno.env.get("R2_BUCKET_NAME")!;
const R2_PUBLIC_URL = Deno.env.get("R2_PUBLIC_URL")!.replace(/\/+$/, "");

const R2_ENDPOINT = `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;

const r2Client = new AwsClient({
  accessKeyId: R2_ACCESS_KEY_ID,
  secretAccessKey: R2_SECRET_ACCESS_KEY,
  service: "s3",
  region: "auto",
});

// Same Clerk dev-instance domain as r2-presign/extract-menu-pdf. verify_jwt
// is off for this function too (see config.toml) — it verifies the token
// itself against Clerk's real JWKS.
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

// Mirrors is_super_admin()'s own dependency (see CLAUDE.md's Clerk JWT
// section): the `superAdmin` custom session claim, only present once
// configured in Clerk Dashboard → Sessions → Customize session token.
// Fails closed (false) if it's missing or the token doesn't verify.
async function isSuperAdmin(authHeader: string | null): Promise<boolean> {
  if (!authHeader) return false;
  const token = authHeader.replace(/^Bearer\s+/i, "");
  try {
    const { payload } = await jwtVerify(token, clerkJwks, {
      issuer: `https://${CLERK_DOMAIN}`,
    });
    return payload.superAdmin === true;
  } catch {
    return false;
  }
}

// Every path must live under this prefix — the actual security boundary,
// not just the JWT check above. No restaurant/org segment: platform
// promos aren't owned by any one restaurant.
function isValidPath(path: string): boolean {
  if (path.includes("..") || path.startsWith("/") || /[?#%\s]/.test(path)) return false;
  const [prefix, ...rest] = path.split("/");
  return prefix === "platform-promos" && rest.length > 0 && rest.every((segment) => segment.length > 0);
}

interface PresignItem {
  path: string;
  contentType?: string;
}

// Unlike r2-presign's vendor bucket (images only), platform promos
// explicitly support video too (apps/admin's Promos page media types).
const ALLOWED_CONTENT_TYPES = ["image/jpeg", "image/png", "image/webp", "video/mp4", "video/webm", "video/quicktime"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  try {
    const { action, items } = await req.json();

    if (action !== "upload" && action !== "delete") {
      return jsonResponse({ error: "action must be 'upload' or 'delete'" }, 400);
    }
    if (!Array.isArray(items) || items.length === 0 || items.length > 5) {
      return jsonResponse({ error: "items must be a non-empty array of at most 5 entries" }, 400);
    }

    if (!(await isSuperAdmin(req.headers.get("Authorization")))) {
      return jsonResponse({ error: "Forbidden: platform admin access required" }, 403);
    }

    const results: { path: string; url: string; publicUrl: string }[] = [];
    for (const item of items as PresignItem[]) {
      if (!item || typeof item.path !== "string" || !isValidPath(item.path)) {
        return jsonResponse({ error: `Invalid path: ${item?.path}` }, 403);
      }

      if (action === "upload" && item.contentType && !ALLOWED_CONTENT_TYPES.includes(item.contentType)) {
        return jsonResponse({ error: `Unsupported content type: ${item.contentType}` }, 400);
      }

      const objectUrl = new URL(`${R2_ENDPOINT}/${R2_BUCKET_NAME}/${item.path}`);
      objectUrl.search = "";
      objectUrl.searchParams.set("X-Amz-Expires", "300");
      const method = action === "upload" ? "PUT" : "DELETE";
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
    console.error("[platform-promo-presign]", err);
    const detail = err instanceof Error ? err.message : String(err);
    return jsonResponse({ error: `Unexpected error: ${detail}` }, 500);
  }
});
