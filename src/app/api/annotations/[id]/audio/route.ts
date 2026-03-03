import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { annotations } from "@/lib/db/schema";
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

  const [annotation] = await db
    .select()
    .from(annotations)
    .where(eq(annotations.id, id))
    .limit(1);

  if (!annotation) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (!annotation.audioR2Key) {
    return NextResponse.json({ error: "No audio for this annotation" }, { status: 404 });
  }

  const url = await getSignedDownloadUrl(annotation.audioR2Key);
  return NextResponse.json({ url });
}
