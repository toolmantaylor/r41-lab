import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { assets } from "@/lib/db/schema";
import { getOrCreateUser } from "@/lib/auth";
import { uploadToR2 } from "@/lib/r2";
import { v4 as uuidv4 } from "uuid";

const ALLOWED_VIDEO = ["video/webm", "video/mp4", "video/quicktime"];
const ALLOWED_IMAGE = ["image/jpeg", "image/png", "image/webp"];
const MAX_SIZE = 200 * 1024 * 1024; // 200MB

export async function POST(req: NextRequest) {
  const user = await getOrCreateUser();
  if (!user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const inspirationId = formData.get("inspirationId") as string;
  const thumbnail = formData.get("thumbnail") as File | null;

  if (!file || !inspirationId) {
    return NextResponse.json(
      { error: "file and inspirationId are required" },
      { status: 400 }
    );
  }

  if (file.size > MAX_SIZE) {
    return NextResponse.json(
      { error: "File exceeds 200MB limit" },
      { status: 400 }
    );
  }

  const isVideo = ALLOWED_VIDEO.includes(file.type);
  const isImage = ALLOWED_IMAGE.includes(file.type);

  if (!isVideo && !isImage) {
    return NextResponse.json(
      { error: "Unsupported file type" },
      { status: 400 }
    );
  }

  const assetId = uuidv4();
  const ext = file.name.split(".").pop() || (isVideo ? "mp4" : "jpg");
  const r2Key = `inspirations/${inspirationId}/${assetId}.${ext}`;

  const buffer = Buffer.from(await file.arrayBuffer());
  await uploadToR2(r2Key, buffer, file.type);

  // Upload thumbnail if provided
  let thumbnailR2Key: string | null = null;
  if (thumbnail) {
    thumbnailR2Key = `inspirations/${inspirationId}/${assetId}_thumb.jpg`;
    const thumbBuffer = Buffer.from(await thumbnail.arrayBuffer());
    await uploadToR2(thumbnailR2Key, thumbBuffer, "image/jpeg");
  }

  const [asset] = await db
    .insert(assets)
    .values({
      id: assetId,
      inspirationId,
      type: isVideo ? "video" : "image",
      r2Key,
      mimeType: file.type,
      fileSizeBytes: file.size,
      durationSeconds: formData.get("duration")
        ? parseInt(formData.get("duration") as string)
        : null,
      width: formData.get("width")
        ? parseInt(formData.get("width") as string)
        : null,
      height: formData.get("height")
        ? parseInt(formData.get("height") as string)
        : null,
      thumbnailR2Key,
    })
    .returning();

  return NextResponse.json(asset, { status: 201 });
}
