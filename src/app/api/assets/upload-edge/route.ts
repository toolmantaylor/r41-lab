/**
 * Edge Runtime upload proxy.
 *
 * The browser sends the raw file body here with the presigned R2 URL as a
 * query parameter. This Edge Function streams the bytes straight through to R2
 * using the presigned PUT URL. Edge Functions have no request body size limit
 * (unlike Vercel Serverless Functions which cap at 4.5 MB).
 *
 * Flow:
 *   1. Client calls POST /api/assets/presign  -> gets { uploadUrl, assetId, r2Key, assetType }
 *   2. Client calls POST /api/assets/upload-edge?url=<uploadUrl>  with raw file body
 *   3. Client calls POST /api/assets/upload  with JSON metadata to register in DB
 */
export const runtime = "edge";

export async function POST(request: Request) {
  const { searchParams } = new URL(request.url);
  const uploadUrl = searchParams.get("url");
  const contentType = request.headers.get("content-type") || "application/octet-stream";

  if (!uploadUrl) {
    return new Response(JSON.stringify({ error: "url query parameter is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Validate that the URL points to our R2 bucket (security check)
  if (!uploadUrl.includes("r2.cloudflarestorage.com")) {
    return new Response(JSON.stringify({ error: "Invalid upload destination" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Stream the request body directly to R2 via the presigned PUT URL
  const r2Response = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Type": contentType,
    },
    body: request.body,
    // @ts-ignore - duplex is required for streaming in some environments
    duplex: "half",
  });

  if (!r2Response.ok) {
    const errorText = await r2Response.text();
    return new Response(
      JSON.stringify({
        error: "R2 upload failed",
        status: r2Response.status,
        detail: errorText,
      }),
      {
        status: 502,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
