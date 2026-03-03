import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { producedAds, hooks, performanceLogs } from "@/lib/db/schema";
import { getOrCreateUser } from "@/lib/auth";
import { eq, desc } from "drizzle-orm";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getOrCreateUser();
  if (!user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { id } = await params;

  const [ad] = await db
    .select()
    .from(producedAds)
    .where(eq(producedAds.id, id))
    .limit(1);

  if (!ad) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const adHooks = await db
    .select()
    .from(hooks)
    .where(eq(hooks.producedAdId, id))
    .orderBy(hooks.hookNumber);

  const perfLogs = await db
    .select()
    .from(performanceLogs)
    .where(eq(performanceLogs.producedAdId, id))
    .orderBy(desc(performanceLogs.dateEnd));

  return NextResponse.json({
    ...ad,
    hooks: adHooks,
    performanceLogs: perfLogs,
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getOrCreateUser();
  if (!user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();

  const updateData: Record<string, any> = {};
  const allowedFields = [
    "internalName",
    "publicName",
    "scriptUrl",
    "editor",
    "status",
    "platform",
    "liveDate",
    "campaign",
  ];

  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      updateData[field] = body[field];
    }
  }

  const [updated] = await db
    .update(producedAds)
    .set(updateData)
    .where(eq(producedAds.id, id))
    .returning();

  return NextResponse.json(updated);
}
