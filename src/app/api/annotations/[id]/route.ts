import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { annotations } from "@/lib/db/schema";
import { getOrCreateUser } from "@/lib/auth";
import { deleteFromR2 } from "@/lib/r2";
import { eq } from "drizzle-orm";

export async function DELETE(
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

  if (annotation.audioR2Key) {
    try {
      await deleteFromR2(annotation.audioR2Key);
    } catch (e) {
      console.error("Failed to delete audio from R2:", e);
    }
  }

  await db.delete(annotations).where(eq(annotations.id, id));

  return NextResponse.json({ success: true });
}
