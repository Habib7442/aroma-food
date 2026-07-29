// Parses a vendor-uploaded menu PDF/image with Gemini and returns the
// extracted items as JSON — it does NOT write to the database. The vendor
// app shows every field for review (diet_type especially — this app never
// silently defaults it) before inserting through the normal, RLS-protected
// client path. See docs/DESIGN.md / apps/vendor/AGENTS.md for why.
//
// Model/request shape confirmed against a working reference implementation
// (not guessed from docs, which were inconsistent across sources when
// checked): gemini-3.5-flash, generateContent, inlineData + responseMimeType.

import { createRemoteJWKSet, jwtVerify } from "https://esm.sh/jose@6.2.4";
import { encodeBase64 } from "jsr:@std/encoding@1/base64";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const geminiApiKey = Deno.env.get("GEMINI_API_KEY")!;

// The menu-pdfs bucket is public-read by design (see the migration comment:
// menu PDFs aren't sensitive, and public read is what lets this function
// fetch them with a plain GET) — so this check isn't a confidentiality
// boundary, anyone with the URL could already read the raw file directly.
// It exists to stop a vendor's client from pointing pdfUrl at a DIFFERENT
// restaurant's upload and spending *our* Gemini quota parsing it — the same
// ownership shape as r2-presign's isPathOwnedBy, adapted for a full URL.
const MENU_PDFS_PREFIX = `${supabaseUrl}/storage/v1/object/public/menu-pdfs/`;

function isPdfUrlOwnedBy(pdfUrl: string, restaurantId: string): boolean {
  if (!pdfUrl.startsWith(MENU_PDFS_PREFIX)) return false;
  const path = pdfUrl.slice(MENU_PDFS_PREFIX.length);
  if (path.includes("..")) return false;
  const [orgSegment, ...rest] = path.split("/");
  return orgSegment === restaurantId && rest.length > 0 && rest.every((segment) => segment.length > 0);
}

// Not a secret — Clerk's public dev-instance domain, same value as
// supabase/config.toml's [auth.third_party.clerk] domain. Needed here to
// build the JWKS URL: verify_jwt is off for this function (confirmed live
// that Edge Functions' own gate doesn't accept our Clerk third-party token
// the way PostgREST/RLS does), so this function verifies the JWT itself.
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

async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = 15000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

// Verifies the Clerk JWT's RS256 signature against Clerk's real JWKS before
// trusting anything in it — verify_jwt is off for this function (see the
// config.toml comment), so nothing upstream has checked this token. Returns
// the org id from the V2 claim shape (o.id) on success, null on any failure
// (missing header, expired, bad signature, wrong issuer, no active org).
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  try {
    const { pdfUrl, restaurantId } = await req.json();
    if (!pdfUrl || !restaurantId) {
      return jsonResponse({ error: "Missing pdfUrl or restaurantId in request body" }, 400);
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

    if (!geminiApiKey) {
      return jsonResponse({ error: "GEMINI_API_KEY is not configured for this project" }, 500);
    }

    if (!isPdfUrlOwnedBy(pdfUrl, restaurantId)) {
      return jsonResponse(
        { error: "Forbidden: pdfUrl must be a menu-pdfs object under the caller's own restaurant folder" },
        403,
      );
    }

    let mimeType = "application/pdf";
    const lowerUrl = pdfUrl.toLowerCase();
    if (lowerUrl.includes(".png")) mimeType = "image/png";
    else if (lowerUrl.includes(".jpg") || lowerUrl.includes(".jpeg")) mimeType = "image/jpeg";
    else if (lowerUrl.includes(".webp")) mimeType = "image/webp";

    const fileResponse = await fetchWithTimeout(pdfUrl, {}, 30000);
    if (!fileResponse.ok) {
      throw new Error(`Failed to download file from storage. Status: ${fileResponse.status}`);
    }
    const fileBuffer = await fileResponse.arrayBuffer();
    const base64Data = encodeBase64(fileBuffer);

    const prompt = `
First, inspect this document or image to determine if it is a food, drink, or restaurant menu.
If it is NOT a menu (e.g. a utility bill, resume, ID card, receipt, invoice, or unrelated document/photo), return EXACTLY this JSON object and nothing else:
{"error": "The uploaded document or image does not appear to be a valid food or beverage menu. Please upload a menu PDF or menu photo containing food items and prices."}

If it IS a menu, extract every dish or drink listed. Return a JSON array where each object has exactly these properties:
{
  "name": "string (name of the dish/drink)",
  "description": "string (ingredients/description, empty string if not present)",
  "price": number (numeric rupee price, e.g. 150 for "Rs 150" or "150.00"),
  "menu_category": "string (the section header this item is listed under, e.g. Starters, Mains, Breads, Desserts, Beverages — empty string if the menu has no visible section headers)",
  "diet_type": "one of exactly: veg, egg, non_veg"
}
Be precise with diet_type: any item containing meat, chicken, fish, or seafood is non_veg. An item containing egg but no meat/fish is egg. Only use veg when certain no meat, fish, or egg is present.
`;

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${geminiApiKey}`;
    const requestBody = {
      contents: [
        {
          parts: [{ text: prompt }, { inlineData: { mimeType, data: base64Data } }],
        },
      ],
      generationConfig: { responseMimeType: "application/json" },
    };

    // A real multi-page menu can take Gemini well over 30s to fully parse —
    // this only bounds wall-clock wait on an external call, not CPU time, so
    // it's safe to sit close to (but under) the platform's 150s/400s
    // wall-clock function limit.
    const geminiResponse = await fetchWithTimeout(
      geminiUrl,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(requestBody) },
      100000,
    );

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      throw new Error(`Gemini API call failed with status ${geminiResponse.status}: ${errorText}`);
    }

    const geminiResult = await geminiResponse.json();
    const responseText = geminiResult.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!responseText) {
      throw new Error("Gemini API returned an empty or invalid response structure");
    }

    const parsed = JSON.parse(responseText.trim());

    if (parsed && typeof parsed === "object" && !Array.isArray(parsed) && parsed.error) {
      return jsonResponse({ error: parsed.error }, 400);
    }

    if (!Array.isArray(parsed)) {
      return jsonResponse(
        { error: "Failed to extract menu items. The uploaded file is either not a menu or has an unsupported layout." },
        400,
      );
    }

    // Never trust the model's types blindly — responseMimeType forces valid
    // JSON syntax, not our schema. diet_type falls through to null (not a
    // guess) when the model returns anything outside our 3 exact values, so
    // the review screen genuinely shows "unset," never a silently-wrong pick.
    const items = parsed.map((item: Record<string, unknown>) => ({
      name: typeof item.name === "string" ? item.name : "Unnamed item",
      description: typeof item.description === "string" ? item.description : "",
      price: typeof item.price === "number" ? item.price : parseFloat(String(item.price)) || 0,
      menu_category: typeof item.menu_category === "string" ? item.menu_category.trim() : "",
      diet_type: ["veg", "egg", "non_veg"].includes(item.diet_type as string) ? item.diet_type : null,
    }));

    return jsonResponse({ success: true, items });
  } catch (err) {
    console.error("[extract-menu-pdf]", err);
    // TODO(debug): surfacing err.message temporarily to diagnose a live
    // failure on a large real-world menu PDF — revert to a fixed generic
    // message once the root cause (likely Gemini-call timeout or truncated
    // JSON on a large item count) is confirmed and fixed.
    const detail = err instanceof Error ? err.message : String(err);
    return jsonResponse({ error: `An unexpected error occurred while parsing the menu: ${detail}` }, 500);
  }
});
