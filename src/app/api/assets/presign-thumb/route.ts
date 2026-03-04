import { NextRequest, NextResponse } from "next/server";
import { getOrCreateUser } from "@/lib/auth";
import { getSignedUploadUrl } from "@/lib/r2";

export async function POST(req: NextRequest) {
  try {
    const user = await getOrCreateUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
    }

    const body = await req.json();
    const { inspirationId, assetId } = body;

    if (!inspirationId || !assetId) {
      return NextResponse.json(
        { error: "inspirationId and assetId are required" },
        { status: 400 }
      );
    }

    const thumbnailR2Key = `inspirations/${inspirationId}/${assetId}_thumb.jpg`;
    const uploadUrl = await getSignedUploadUrl(thumbnailR2Key, "image/jpeg", 3600);

    return NextResponse.json({ thumbnailR2Key, uploadUrl });
  } catch (error: any) {
    console.error("Presign-thumb error:", error);
    return NextResponse.json(
      { error: "Internal server error: " + (error.message || "Unknown error") },
      { status: 500 }
    );
  }
}
