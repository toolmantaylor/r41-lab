import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { assets } from "@/lib/db/schema";
import { getOrCreateUser } from "@/lib/auth";
import { getSignedDownloadUrl } from "@/lib/r2";
import { eq } from "drizzle-orm";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getOrCreateUser();
  if (!user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { id } = await params;

  const [asset] = await db
    .select()
    .from(assets)
    .where(eq(assets.id, id))
    .limit(1);

  if (!asset) {
    return NextResponse.json({ error: "Asset not found" }, { status: 404 });
  }

  const url = await getSignedDownloadUrl(asset.r2Key);
  let thumbnailUrl: string | null = null;
  if (asset.thumbnailR2Key) {
    thumbnailUrl = await getSignedDownloadUrl(asset.thumbnailR2Key);
  }

  return NextResponse.json({ url, thumbnailUrl });
}
