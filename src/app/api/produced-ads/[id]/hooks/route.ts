import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hooks } from "@/lib/db/schema";
import { getOrCreateUser } from "@/lib/auth";
import { eq } from "drizzle-orm";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getOrCreateUser();
  if (!user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { id: producedAdId } = await params;
  const body = await req.json();

  // Accept single hook or array of hooks
  const hooksData = Array.isArray(body) ? body : [body];

  const created = [];
  for (const h of hooksData) {
    if (!h.hookText || !h.creativeDirection) {
      return NextResponse.json(
        { error: "hookText and creativeDirection are required for each hook" },
        { status: 400 }
      );
    }

    const [hook] = await db
      .insert(hooks)
      .values({
        producedAdId,
        hookNumber: h.hookNumber,
        hookText: h.hookText,
        creativeDirection: h.creativeDirection,
      })
      .returning();

    created.push(hook);
  }

  return NextResponse.json(created, { status: 201 });
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getOrCreateUser();
  if (!user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { id: producedAdId } = await params;

  const result = await db
    .select()
    .from(hooks)
    .where(eq(hooks.producedAdId, producedAdId))
    .orderBy(hooks.hookNumber);

  return NextResponse.json(result);
}
