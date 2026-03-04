import { NextRequest, NextResponse } from "next/server";
import { getOrCreateUser } from "@/lib/auth";
import { getSignedUploadUrl } from "@/lib/r2";
import { v4 as uuidv4 } from "uuid";

const ALLOWED_VIDEO = ["video/webm", "video/mp4", "video/quicktime"];
const ALLOWED_IMAGE = ["image/jpeg", "image/png", "image/webp"];

export async function POST(req: NextRequest) {
  try {
    const user = await getOrCreateUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
    }

    const body = await req.json();
    const { inspirationId, mimeType, filename } = body;

    if (!inspirationId || !mimeType) {
      return NextResponse.json(
        { error: "inspirationId and mimeType are required" },
        { status: 400 }
      );
    }

    const isVideo = ALLOWED_VIDEO.includes(mimeType);
    const isImage = ALLOWED_IMAGE.includes(mimeType);

    if (!isVideo && !isImage) {
      return NextResponse.json(
        { error: "Unsupported file type: " + mimeType },
        { status: 400 }
      );
    }

    const assetId = uuidv4();
    const ext = (filename || "").split(".").pop() || (isVideo ? "mp4" : "jpg");
    const r2Key = `inspirations/${inspirationId}/${assetId}.${ext}`;

    const uploadUrl = await getSignedUploadUrl(r2Key, mimeType, 3600);

    return NextResponse.json({
      assetId,
      r2Key,
      uploadUrl,
      assetType: isVideo ? "video" : "image",
    });
  } catch (error: any) {
    console.error("Presign error:", error);
    return NextResponse.json(
      { error: "Internal server error: " + (error.message || "Unknown error") },
      { status: 500 }
    );
  }
}
