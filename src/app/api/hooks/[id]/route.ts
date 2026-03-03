import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hooks } from "@/lib/db/schema";
import { getOrCreateUser } from "@/lib/auth";
import { eq } from "drizzle-orm";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getOrCreateUser();
  if (!user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();

  const updateData: Record<string, any> = {};
  if (body.hookText !== undefined) updateData.hookText = body.hookText;
  if (body.creativeDirection !== undefined)
    updateData.creativeDirection = body.creativeDirection;
  if (body.hookNumber !== undefined) updateData.hookNumber = body.hookNumber;

  const [updated] = await db
    .update(hooks)
    .set(updateData)
    .where(eq(hooks.id, id))
    .returning();

  return NextResponse.json(updated);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getOrCreateUser();
  if (!user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { id } = await params;

  await db.delete(hooks).where(eq(hooks.id, id));

  return NextResponse.json({ success: true });
}
