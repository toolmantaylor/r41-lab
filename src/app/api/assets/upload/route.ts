import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { assets } from "@/lib/db/schema";
import { getOrCreateUser } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const user = await getOrCreateUser();
  if (!user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  try {
    const body = await req.json();
    const {
      assetId,
      inspirationId,
      r2Key,
      thumbnailR2Key,
      mimeType,
      assetType,
      fileSizeBytes,
    } = body;

    if (!assetId || !inspirationId || !r2Key) {
      return NextResponse.json(
        { error: "assetId, inspirationId, and r2Key are required" },
        { status: 400 }
      );
    }

    const [asset] = await db
      .insert(assets)
      .values({
        id: assetId,
        inspirationId,
        type: assetType || "image",
        r2Key,
        mimeType: mimeType || "application/octet-stream",
        fileSizeBytes: fileSizeBytes || 0,
        thumbnailR2Key: thumbnailR2Key || null,
      })
      .returning();

    return NextResponse.json(asset, { status: 201 });
  } catch (e: any) {
    console.error("Asset registration error:", e);
    return NextResponse.json(
      { error: "Failed to register asset: " + (e.message || "Unknown error") },
      { status: 500 }
    );
  }
}
